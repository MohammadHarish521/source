"""Load the official MCNS v1.0 traced-only connectome weights into SQLite."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pyarrow.compute as pc
import pyarrow.feather as feather

MIN_SYN = 5
BATCH = 50000

PRE_ALIASES = ("pre", "body_pre", "bodyid_pre", "bodypre", "src", "source")
POST_ALIASES = ("post", "body_post", "bodyid_post", "bodypost", "dst", "target")
COUNT_ALIASES = ("count", "weight", "synapses", "n", "syn_count", "connection_weight")


def pick_column(names: list[str], aliases: tuple[str, ...]) -> str:
    lower = {name.lower(): name for name in names}
    for alias in aliases:
        if alias in lower:
            return lower[alias]
    raise SystemExit(f"edgelist missing columns {aliases}; have {names}")


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("usage: load_edgelist.py <feather> <sqlite>")
    feather_path = Path(sys.argv[1])
    db_path = Path(sys.argv[2])
    raw = feather.read_table(feather_path)
    print(f"columns {' '.join(raw.column_names)} rows {raw.num_rows}", flush=True)
    pre_col = pick_column(raw.column_names, PRE_ALIASES)
    post_col = pick_column(raw.column_names, POST_ALIASES)
    count_col = pick_column(raw.column_names, COUNT_ALIASES)
    table = raw.select([pre_col, post_col, count_col])
    table = table.rename_columns(["pre", "post", "count"])
    table = table.filter(pc.greater_equal(table["count"], MIN_SYN))
    print(f"rows_kept {table.num_rows}", flush=True)

    con = sqlite3.connect(db_path, timeout=120)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=OFF")
    con.execute("PRAGMA busy_timeout=120000")
    con.execute("PRAGMA temp_store=MEMORY")
    con.execute("DROP TABLE IF EXISTS edges")
    con.execute(
        """
        CREATE TABLE edges (
          pre TEXT NOT NULL,
          post TEXT NOT NULL,
          synapses INTEGER NOT NULL
        )
        """
    )

    insert = "INSERT INTO edges (pre, post, synapses) VALUES (?, ?, ?)"
    kept = 0
    for start in range(0, table.num_rows, BATCH):
        chunk = table.slice(start, min(BATCH, table.num_rows - start))
        rows = list(
            zip(
                [str(v) for v in chunk["pre"].to_pylist()],
                [str(v) for v in chunk["post"].to_pylist()],
                [int(v) for v in chunk["count"].to_pylist()],
                strict=True,
            )
        )
        con.executemany(insert, rows)
        kept += len(rows)
        if kept % 500000 < BATCH:
            con.commit()
            print(f"inserted {kept}", flush=True)
    con.commit()
    print("creating_indexes", flush=True)
    con.execute("CREATE INDEX IF NOT EXISTS edges_pre ON edges(pre)")
    con.execute("CREATE INDEX IF NOT EXISTS edges_post ON edges(post)")
    print("computing_stats", flush=True)
    con.execute(
        """
        UPDATE neurons SET
          input_synapses = 0,
          output_synapses = 0,
          input_partners = 0,
          output_partners = 0,
          partner_count = 0
        """
    )
    con.execute(
        """
        UPDATE neurons SET
          output_synapses = s.syn,
          output_partners = s.partners
        FROM (
          SELECT pre AS root_id, SUM(synapses) AS syn, COUNT(*) AS partners
          FROM edges GROUP BY pre
        ) s
        WHERE neurons.root_id = s.root_id
        """
    )
    con.execute(
        """
        UPDATE neurons SET
          input_synapses = s.syn,
          input_partners = s.partners
        FROM (
          SELECT post AS root_id, SUM(synapses) AS syn, COUNT(*) AS partners
          FROM edges GROUP BY post
        ) s
        WHERE neurons.root_id = s.root_id
        """
    )
    con.execute(
        """
        UPDATE neurons SET
          partner_count = COALESCE(input_partners, 0) + COALESCE(output_partners, 0)
        """
    )
    con.commit()
    print(f"stats edges {kept}", flush=True)
    con.close()


if __name__ == "__main__":
    main()

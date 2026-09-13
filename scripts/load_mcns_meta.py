"""Load official MCNS v1.0 neuron annotations + neurotransmitter predictions."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pyarrow.feather as feather

TRACED = "Traced"
BATCH = 4000


def first_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def flow_from_superclass(super_class: str | None) -> str | None:
    if not super_class:
        return None
    blob = super_class.lower()
    if "intrinsic" in blob:
        return "intrinsic"
    if "sensory" in blob or blob == "visual_projection":
        return "afferent"
    if "motor" in blob or "efferent" in blob or "endocrine" in blob:
        return "efferent"
    if "descending" in blob:
        return "efferent"
    if "ascending" in blob:
        return "afferent"
    return None


def region_from(super_class: str | None, cell_class: str | None) -> str | None:
    klass = (cell_class or "").lower()
    if "kenyon" in klass:
        return "mushroom_body"
    if klass == "cx":
        return "central_complex"
    blob = f"{super_class or ''} {cell_class or ''}".lower()
    if super_class:
        sc = super_class.lower()
        if sc.startswith("ol_") or sc in {"visual_projection", "visual_centrifugal"}:
            return "optic_lobe"
        if sc.startswith("cb_"):
            return "central_brain"
        if sc.startswith("vnc_") or sc == "ens":
            return "ventral_nerve_cord"
        if "ascending" in sc:
            return "ascending"
        if "descending" in sc:
            return "descending"
    if "olfactory" in blob or "gustatory" in blob or "mechanosensory" in blob:
        return "sensory"
    return super_class


def voxel_xyz(value: object, scale: float = 8.0) -> tuple[float | None, float | None, float | None]:
    if not value:
        return (None, None, None)
    try:
        x, y, z = value[0], value[1], value[2]
    except Exception:
        return (None, None, None)
    if x is None or y is None or z is None:
        return (None, None, None)
    return (float(x) * scale, float(y) * scale, float(z) * scale)


def load_nt(path: Path) -> dict[str, tuple[str | None, float | None, str | None]]:
    table = feather.read_table(
        path,
        columns=["body", "consensus_nt", "predicted_nt", "predicted_nt_confidence", "ground_truth"],
    )
    out: dict[str, tuple[str | None, float | None, str | None]] = {}
    bodies = table["body"].to_pylist()
    consensus = table["consensus_nt"].to_pylist()
    predicted = table["predicted_nt"].to_pylist()
    conf = table["predicted_nt_confidence"].to_pylist()
    truth = table["ground_truth"].to_pylist()
    for i, body in enumerate(bodies):
        key = str(body)
        if key in out:
            continue
        nt = first_str(consensus[i]) or first_str(predicted[i])
        known = first_str(truth[i])
        score = conf[i]
        out[key] = (nt, float(score) if score is not None else None, known)
    print(f"nt_bodies {len(out)}", flush=True)
    return out


def main() -> None:
    if len(sys.argv) < 4:
        raise SystemExit("usage: load_mcns_meta.py <annotations.feather> <nt.feather> <sqlite>")
    ann_path = Path(sys.argv[1])
    nt_path = Path(sys.argv[2])
    db_path = Path(sys.argv[3])

    nt = load_nt(nt_path)
    table = feather.read_table(ann_path)
    print(f"annotation_rows {table.num_rows}", flush=True)

    cols = {name: table[name].to_pylist() for name in table.column_names}
    n = table.num_rows

    con = sqlite3.connect(db_path, timeout=120)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    con.execute("PRAGMA busy_timeout=120000")
    con.execute("DELETE FROM neurons")

    insert = """
      INSERT OR REPLACE INTO neurons (
        root_id, supervoxel_id, cell_type, hemibrain_type, super_class, cell_class,
        cell_sub_class, super_type, flow, side, nerve, hemilineage, hartenstein_hemilineage,
        neurotransmitter, nt_confidence, known_nt, known_nt_source, region, vfb_id, fbbt_id,
        status, dimorphism, fru_dsx, synonyms, soma_x, soma_y, soma_z, pos_x, pos_y, pos_z
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """

    batch: list[tuple[object, ...]] = []
    kept = 0
    for i in range(n):
        status = first_str(cols["status"][i])
        if status != TRACED:
            continue
        body = str(cols["bodyId"][i])
        super_class = first_str(cols["superclass"][i])
        cell_class = first_str(cols["class"][i])
        instance = first_str(cols["instance"][i])
        synonyms = first_str(cols["synonyms"][i])
        label = " / ".join(part for part in (instance, synonyms) if part) or None
        soma = voxel_xyz(cols["somaLocation"][i])
        tosoma = voxel_xyz(cols["tosomaLocation"][i])
        pos = soma if soma[0] is not None else tosoma
        nt_pred, nt_conf, known = nt.get(body, (None, None, None))
        entry = first_str(cols["entryNerve"][i])
        exit_n = first_str(cols["exitNerve"][i])
        nerve = entry or exit_n
        batch.append(
            (
                body,
                None,
                first_str(cols["type"][i]),
                first_str(cols["hemibrainType"][i]) or first_str(cols["flywireType"][i]),
                super_class,
                cell_class,
                first_str(cols["subclass"][i]),
                first_str(cols["supertype"][i]),
                flow_from_superclass(super_class),
                first_str(cols["somaSide"][i]) or first_str(cols["rootSide"][i]),
                nerve,
                first_str(cols["itoleeHl"][i]),
                first_str(cols["trumanHl"][i]),
                nt_pred,
                nt_conf,
                known,
                "MCNS v1.0 ground truth" if known else None,
                region_from(super_class, cell_class),
                first_str(cols["vfbId"][i]),
                None,
                status,
                first_str(cols["dimorphism"][i]),
                first_str(cols["fruDsx"][i]),
                label,
                soma[0],
                soma[1],
                soma[2],
                pos[0],
                pos[1],
                pos[2],
            )
        )
        if len(batch) >= BATCH:
            con.executemany(insert, batch)
            kept += len(batch)
            batch.clear()
            con.commit()
            print(f"neurons {kept}", flush=True)

    if batch:
        con.executemany(insert, batch)
        kept += len(batch)
        con.commit()

    print(f"neurons_ready {kept}", flush=True)
    con.close()


if __name__ == "__main__":
    main()

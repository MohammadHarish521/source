import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const DATA_DIR = path.join(process.cwd(), ".cache");
const DB_PATH = path.join(DATA_DIR, "fly-mcns-v1.db");

let sqlite: Database.Database | null = null;

function migrate(db: Database.Database) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    PRAGMA mmap_size = 30000000000;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS neurons (
      root_id TEXT PRIMARY KEY,
      supervoxel_id TEXT,
      cell_type TEXT,
      hemibrain_type TEXT,
      super_class TEXT,
      cell_class TEXT,
      cell_sub_class TEXT,
      super_type TEXT,
      flow TEXT,
      side TEXT,
      nerve TEXT,
      hemilineage TEXT,
      hartenstein_hemilineage TEXT,
      neurotransmitter TEXT,
      nt_confidence REAL,
      known_nt TEXT,
      known_nt_source TEXT,
      region TEXT,
      vfb_id TEXT,
      fbbt_id TEXT,
      status TEXT,
      dimorphism TEXT,
      fru_dsx TEXT,
      synonyms TEXT,
      soma_x REAL,
      soma_y REAL,
      soma_z REAL,
      pos_x REAL,
      pos_y REAL,
      pos_z REAL,
      input_synapses INTEGER,
      output_synapses INTEGER,
      input_partners INTEGER,
      output_partners INTEGER,
      partner_count INTEGER,
      cable_length_nm REAL,
      skeleton_nodes INTEGER
    );
    CREATE INDEX IF NOT EXISTS neurons_cell_type ON neurons(cell_type);
    CREATE INDEX IF NOT EXISTS neurons_super_class ON neurons(super_class);
    CREATE INDEX IF NOT EXISTS neurons_cell_class ON neurons(cell_class);
    CREATE INDEX IF NOT EXISTS neurons_side ON neurons(side);
    CREATE INDEX IF NOT EXISTS neurons_partners ON neurons(partner_count);

    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pre TEXT NOT NULL,
      post TEXT NOT NULL,
      synapses INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS edges_pre ON edges(pre);
    CREATE INDEX IF NOT EXISTS edges_post ON edges(post);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      handle TEXT NOT NULL UNIQUE,
      neuron_id TEXT,
      created_at INTEGER NOT NULL,
      credits INTEGER NOT NULL DEFAULT 3,
      streak INTEGER NOT NULL DEFAULT 0,
      last_puzzle_day TEXT,
      favorite_region TEXT,
      neurons_discovered INTEGER NOT NULL DEFAULT 0,
      connections_explored INTEGER NOT NULL DEFAULT 0,
      best_six_degrees INTEGER
    );

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      root_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      claim_number INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_puzzles (
      day TEXT PRIMARY KEY,
      start_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      shortest INTEGER NOT NULL,
      players INTEGER NOT NULL DEFAULT 0,
      completions INTEGER NOT NULL DEFAULT 0,
      move_sum INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS puzzle_plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moves INTEGER,
      completed INTEGER NOT NULL DEFAULT 0,
      path TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS plays_day_user ON puzzle_plays(day, user_id);

    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      message TEXT NOT NULL,
      root_id TEXT,
      user_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS activity_created ON activity(created_at);

    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      root_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS visits_user ON visits(user_id);
    CREATE INDEX IF NOT EXISTS visits_root ON visits(root_id);

    CREATE TABLE IF NOT EXISTS daily_runs (
      day TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_weights (
      pre TEXT NOT NULL,
      post TEXT NOT NULL,
      bonus INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (pre, post)
    );
  `);
}

export function getSqlite() {
  if (sqlite) return sqlite;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  sqlite = new Database(DB_PATH);
  migrate(sqlite);
  return sqlite;
}

export function getMeta(key: string) {
  const row = getSqlite().prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string) {
  getSqlite()
    .prepare("INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export { DB_PATH, DATA_DIR };

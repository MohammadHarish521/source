import { Binary, MongoClient, type Db, type Document } from "mongodb";
import { loadEnv } from "@/lib/env";

const g = globalThis as typeof globalThis & {
  __flyMongo?: { client: MongoClient; db: Db; connecting?: Promise<Db> };
};

export function mongoUri() {
  loadEnv();
  return (process.env.MONGODB_URI || "").trim();
}

export function mongoConfigured() {
  return mongoUri().startsWith("mongodb");
}

export async function closeMongo() {
  const client = g.__flyMongo?.client;
  g.__flyMongo = undefined;
  if (client) await client.close();
}

export async function getMongo(): Promise<Db> {
  if (g.__flyMongo?.db) return g.__flyMongo.db;
  if (g.__flyMongo?.connecting) return g.__flyMongo.connecting;

  const uri = mongoUri();
  if (!uri) {
    throw new Error("MONGODB_URI is missing. Create a free Atlas cluster and put the connection string in .env.");
  }

  const connecting = (async () => {
    const client = new MongoClient(uri, { maxPoolSize: 5, minPoolSize: 0 });
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || "fly");
    await ensureIndexes(db);
    g.__flyMongo = { client, db };
    return db;
  })();

  g.__flyMongo = { ...(g.__flyMongo ?? {}), connecting } as typeof g.__flyMongo;
  return connecting;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("neurons").createIndexes([
      { key: { cell_type: 1 } },
      { key: { super_class: 1 } },
      { key: { partner_count: -1 } },
      { key: { region: 1 } },
      { key: { flow: 1 } },
    ]),
    db.collection("users").createIndex({ handle: 1 }, { unique: true, sparse: true }),
    db.collection("claims").createIndex({ root_id: 1 }, { unique: true }),
    db.collection("claims").createIndex({ user_id: 1 }),
    db.collection("daily_weights").createIndex({ pre: 1, post: 1 }, { unique: true }),
    db.collection("puzzle_plays").createIndex({ day: 1, user_id: 1 }),
    db.collection("activity").createIndex({ created_at: -1 }),
    db.collection("visits").createIndex({ user_id: 1, root_id: 1 }),
    db.collection("analytics").createIndex({ event: 1, day: 1 }, { unique: true }),
    db.collection("graph_packs").createIndex({ i: 1 }),
  ]);
}

export type Doc = { _id?: string; [key: string]: any };

export type UserRow = {
  id: string;
  _id: string;
  handle: string;
  neuron_id?: string | null;
  created_at?: number;
  credits: number;
  streak: number;
  last_puzzle_day?: string | null;
  favorite_region?: string | null;
  neurons_discovered?: number;
  connections_explored?: number;
  best_six_degrees?: number | null;
};

export async function collections() {
  const db = await getMongo();
  return {
    meta: db.collection<Doc>("meta"),
    neurons: db.collection<Doc>("neurons"),
    users: db.collection<Doc>("users"),
    claims: db.collection<Doc>("claims"),
    dailyPuzzles: db.collection<Doc>("daily_puzzles"),
    puzzlePlays: db.collection<Doc>("puzzle_plays"),
    activity: db.collection<Doc>("activity"),
    analytics: db.collection<Doc>("analytics"),
    visits: db.collection<Doc>("visits"),
    dailyRuns: db.collection<Doc>("daily_runs"),
    dailyWeights: db.collection<Doc>("daily_weights"),
    graphPacks: db.collection<{ _id?: string; i: number; bytes: Binary }>("graph_packs"),
  };
}

export async function getMeta(key: string) {
  const { meta } = await collections();
  const row = await meta.findOne({ _id: key });
  return typeof row?.value === "string" ? row.value : null;
}

export async function setMeta(key: string, value: string) {
  const { meta } = await collections();
  await meta.updateOne({ _id: key }, { $set: { value } }, { upsert: true });
}

export function asUser(doc: Record<string, unknown> | null | undefined): UserRow | null {
  if (!doc) return null;
  const id = String(doc._id ?? doc.id);
  return { ...doc, id, _id: id } as UserRow;
}

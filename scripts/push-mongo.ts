import { Binary } from "mongodb";
import Database from "better-sqlite3";
import { loadEnv } from "../lib/env";
import { closeMongo, collections, mongoConfigured, setMeta } from "../lib/db";
import { buildCsr, encodeCsr } from "../lib/connectome/csr";
import { DATASET } from "../lib/connectome/sources";
import { DB_PATH } from "../lib/db";

const CHUNK = 12 * 1024 * 1024;

function leanNeuron(row: Record<string, unknown>) {
  const doc: Record<string, unknown> = { _id: row.root_id, root_id: row.root_id };
  for (const [key, value] of Object.entries(row)) {
    if (value == null || value === "") continue;
    doc[key] = value;
  }
  return doc;
}

async function main() {
  loadEnv();
  if (!mongoConfigured()) {
    throw new Error("Set MONGODB_URI in .env first (Atlas free cluster connection string).");
  }
  const local = new Database(DB_PATH, { readonly: true });
  const neuronRows = local.prepare("SELECT * FROM neurons").all() as Array<Record<string, unknown>>;
  const edgeRows = local.prepare("SELECT pre, post, synapses FROM edges").all() as Array<{
    pre: string;
    post: string;
    synapses: number;
  }>;
  if (!neuronRows.length || !edgeRows.length) {
    throw new Error(`Local SQLite at ${DB_PATH} is empty. You still need that file once, to push.`);
  }

  const { neurons, graphPacks, dailyRuns } = await collections();
  console.log(`Uploading ${neuronRows.length.toLocaleString()} neurons…`);
  await neurons.deleteMany({});
  for (let i = 0; i < neuronRows.length; i += 1000) {
    const batch = neuronRows.slice(i, i + 1000).map(leanNeuron);
    await neurons.insertMany(batch as Array<{ _id: string }>, { ordered: false });
    if (i % 20000 === 0) console.log(`  neurons ${i.toLocaleString()}`);
  }

  console.log(`Packing ${edgeRows.length.toLocaleString()} edges into a compact graph…`);
  const graph = buildCsr(
    edgeRows,
    neuronRows.map((row) => ({
      id: String(row.root_id),
      type: typeof row.cell_type === "string" ? row.cell_type : null,
      partners: Number(row.partner_count ?? 0),
    })),
  );
  const gz = encodeCsr(graph);
  console.log(`Graph pack ${Math.round(gz.length / 1024 / 1024)} MB gzipped`);
  await graphPacks.deleteMany({});
  const packs = [];
  for (let i = 0, n = 0; i < gz.length; i += CHUNK, n += 1) {
    packs.push({ i: n, bytes: new Binary(gz.subarray(i, i + CHUNK)) });
  }
  await graphPacks.insertMany(packs);

  const runRows = local.prepare("SELECT day, payload, created_at FROM daily_runs").all() as Array<{
    day: string;
    payload: string;
    created_at: number;
  }>;
  for (const row of runRows) {
    await dailyRuns.updateOne(
      { _id: row.day },
      { $set: { day: row.day, payload: row.payload, created_at: row.created_at } },
      { upsert: true },
    );
  }

  await setMeta("dataset_id", DATASET.id);
  await setMeta("metadata_ready", "1");
  await setMeta("graph_ready", "1");
  await setMeta("neuron_count", String(neuronRows.length));
  await setMeta("edge_count", String(edgeRows.length));
  await setMeta(
    "ingest_status",
    JSON.stringify({
      stage: "ready",
      message: "Official Male CNS v1.0 is on MongoDB Atlas.",
      metadataReady: true,
      graphReady: true,
      neuronCount: neuronRows.length,
      edgeCount: edgeRows.length,
      error: null,
      updatedAt: Date.now(),
    }),
  );
  local.close();
  await closeMongo();
  console.log("Done. Atlas now holds neurons + compact graph. You can deploy without a disk.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

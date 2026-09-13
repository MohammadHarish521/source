import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, DB_PATH, getMeta, getSqlite, setMeta } from "@/lib/db";
import { DATASET, MIN_SYNAPSES, REMOTE } from "./sources";
import type { IngestStatus } from "./types";

const ANN_PATH = path.join(DATA_DIR, "body-annotations-male-cns-v1.0-minconf-0.5.feather");
const NT_PATH = path.join(DATA_DIR, "body-neurotransmitters-male-cns-v1.0.feather");
const EDGE_PATH = path.join(DATA_DIR, "connectome-weights-male-cns-v1.0-minconf-0.5-traced-only.feather");

let status: IngestStatus = {
  stage: "idle",
  message: "Waiting to load official Male CNS v1.0 files.",
  metadataReady: false,
  graphReady: false,
  neuronCount: 0,
  edgeCount: 0,
  error: null,
  updatedAt: Date.now(),
};

function setStatus(patch: Partial<IngestStatus>) {
  status = { ...status, ...patch, updatedAt: Date.now() };
  setMeta("ingest_status", JSON.stringify(status));
}

function resetIfWrongDataset() {
  const current = getMeta("dataset_id");
  if (current === DATASET.id) return;
  const db = getSqlite();
  db.exec("DELETE FROM neurons; DELETE FROM edges;");
  setMeta("metadata_ready", "0");
  setMeta("graph_ready", "0");
  setMeta("dataset_id", DATASET.id);
  setStatus({
    stage: "idle",
    metadataReady: false,
    graphReady: false,
    neuronCount: 0,
    edgeCount: 0,
    error: null,
    message: "Switching the local index to official Male CNS v1.0.",
  });
}

export function getIngestStatus(): IngestStatus {
  resetIfWrongDataset();
  if (status.stage === "idle") {
    const cached = getMeta("ingest_status");
    if (cached) {
      try {
        status = JSON.parse(cached) as IngestStatus;
      } catch {
        /* keep default */
      }
    }
  }
  status.metadataReady = getMeta("metadata_ready") === "1";
  status.graphReady = getMeta("graph_ready") === "1";
  const db = getSqlite();
  status.neuronCount = (db.prepare("SELECT COUNT(*) AS n FROM neurons").get() as { n: number }).n;
  status.edgeCount = (db.prepare("SELECT COUNT(*) AS n FROM edges").get() as { n: number }).n;
  if (status.metadataReady && status.graphReady) {
    status.stage = "ready";
    status.error = null;
    status.message = "Official Male CNS v1.0 metadata and connectivity are indexed.";
  }
  return status;
}

async function download(url: string, dest: string, label: string) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    setStatus({ message: `Using cached ${label}.` });
    return;
  }
  setStatus({ message: `Downloading official ${label}…` });
  const res = await fetch(url, { headers: { "User-Agent": "FLY-connectome/0.1 (scientific explorer)" } });
  if (!res.ok) {
    throw new Error(`${label} download failed: HTTP ${res.status} from ${url}`);
  }
  const tmp = `${dest}.part`;
  const file = fs.createWriteStream(tmp);
  if (!res.body) throw new Error(`${label} response had no body`);
  const reader = res.body.getReader();
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    file.write(Buffer.from(value));
    if (received % (8 * 1024 * 1024) < value.byteLength) {
      setStatus({ message: `Downloading official ${label} (${Math.round(received / 1_000_000)} MB)…` });
    }
  }
  await new Promise<void>((resolve, reject) => {
    file.end(() => resolve());
    file.on("error", reject);
  });
  fs.renameSync(tmp, dest);
}

function runPython(scriptName: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const script = path.join(process.cwd(), "scripts", scriptName);
    const child = spawn("python", [script, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) setStatus({ message: `Indexing official Male CNS files: ${line}` });
    });
    let err = "";
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `${scriptName} exited ${code}`));
    });
  });
}

async function ingestAnnotations() {
  await runPython("load_mcns_meta.py", [ANN_PATH, NT_PATH, DB_PATH]);
  const db = getSqlite();
  const count = (db.prepare("SELECT COUNT(*) AS n FROM neurons").get() as { n: number }).n;
  setMeta("metadata_ready", "1");
  setStatus({
    metadataReady: true,
    neuronCount: count,
    message: `Indexed ${count.toLocaleString()} official Traced neurons from Male CNS v1.0.`,
  });
}

async function ingestEdges() {
  await runPython("load_edgelist.py", [EDGE_PATH, DB_PATH]);
  const db = getSqlite();
  const kept = (db.prepare("SELECT COUNT(*) AS n FROM edges").get() as { n: number }).n;
  setMeta("graph_ready", "1");
  setStatus({
    graphReady: true,
    edgeCount: kept,
    message: `Indexed ${kept.toLocaleString()} directed connections at the ${MIN_SYNAPSES}+ synapse threshold.`,
  });
}

let metadataRunning: Promise<void> | null = null;
let graphRunning: Promise<void> | null = null;

async function runMetadata() {
  resetIfWrongDataset();
  if (getMeta("metadata_ready") === "1") return;
  setStatus({ stage: "metadata", error: null, message: "Fetching official Male CNS v1.0 annotations…" });
  await download(REMOTE.annotationsFeather, ANN_PATH, "Male CNS v1.0 body annotations");
  await download(REMOTE.neurotransmittersFeather, NT_PATH, "Male CNS v1.0 neurotransmitter predictions");
  await ingestAnnotations();
}

async function runGraph() {
  resetIfWrongDataset();
  if (getMeta("graph_ready") === "1") return;
  const lock = path.join(DATA_DIR, "graph.lock");
  if (fs.existsSync(lock)) {
    const age = Date.now() - fs.statSync(lock).mtimeMs;
    if (age < 30 * 60 * 1000) {
      setStatus({ stage: "graph", message: "Another official graph ingest is already running." });
      return;
    }
  }
  fs.writeFileSync(lock, String(process.pid));
  setStatus({ stage: "graph", message: "Fetching the official Male CNS v1.0 traced-only weights…" });
  await download(REMOTE.tracedWeights, EDGE_PATH, "Male CNS v1.0 traced-only connectome weights");
  setStatus({ stage: "graph", message: "Reading official connectivity table…" });
  try {
    await ingestEdges();
    setStatus({
      stage: "ready",
      metadataReady: true,
      graphReady: true,
      message: "Official Male CNS v1.0 index is ready.",
      error: null,
    });
  } finally {
    if (fs.existsSync(lock)) fs.unlinkSync(lock);
  }
}

export function ensureMetadata() {
  resetIfWrongDataset();
  if (getMeta("metadata_ready") === "1") return Promise.resolve();
  if (!metadataRunning) {
    metadataRunning = runMetadata()
      .then(() => {
        void ensureIngest();
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown ingest error";
        setStatus({ stage: "error", error: message, message });
        throw error;
      })
      .finally(() => {
        metadataRunning = null;
      });
  }
  return metadataRunning;
}

export function ensureIngest() {
  resetIfWrongDataset();
  if (getMeta("metadata_ready") === "1" && getMeta("graph_ready") === "1") {
    return Promise.resolve();
  }
  if (!graphRunning) {
    graphRunning = ensureMetadata()
      .then(() => runGraph())
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown ingest error";
        setStatus({ stage: "error", error: message, message });
        throw error;
      })
      .finally(() => {
        graphRunning = null;
      });
  }
  return graphRunning;
}

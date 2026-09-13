import { collections, getMeta, mongoConfigured } from "@/lib/db";
import { loadCsr } from "./csr";
import { PUBLIC_STATS } from "./sources";
import type { IngestStatus } from "./types";

let status: IngestStatus = {
  stage: "idle",
  message: "Waiting for MongoDB Atlas.",
  metadataReady: false,
  graphReady: false,
  neuronCount: PUBLIC_STATS.neurons,
  edgeCount: PUBLIC_STATS.connections || 0,
  error: null,
  updatedAt: Date.now(),
};

function setStatus(patch: Partial<IngestStatus>) {
  status = { ...status, ...patch, updatedAt: Date.now() };
}

export function getIngestStatus(): IngestStatus {
  return status;
}

export async function refreshIngestStatus() {
  if (!mongoConfigured()) {
    setStatus({
      stage: "error",
      error: "MONGODB_URI missing",
      message: "Add a free Atlas URI to .env, then run npm run push-mongo.",
      metadataReady: false,
      graphReady: false,
    });
    return status;
  }
  const metadataReady = (await getMeta("metadata_ready")) === "1";
  const graphReady = (await getMeta("graph_ready")) === "1";
  const neuronCount = Number((await getMeta("neuron_count")) ?? PUBLIC_STATS.neurons);
  const edgeCount = Number((await getMeta("edge_count")) ?? PUBLIC_STATS.connections ?? 0);
  setStatus({
    metadataReady,
    graphReady,
    neuronCount,
    edgeCount,
    stage: metadataReady && graphReady ? "ready" : "idle",
    error: null,
    message:
      metadataReady && graphReady
        ? "Official Male CNS v1.0 metadata and connectivity are on MongoDB."
        : "Mongo is connected but empty. Run npm run push-mongo once from this machine.",
  });
  return status;
}

async function ready() {
  await refreshIngestStatus();
  if (status.metadataReady && status.graphReady) {
    await loadCsr();
    return;
  }
  throw new Error(status.message);
}

export function ensureMetadata() {
  return ready();
}

export function ensureIngest() {
  return ready();
}

export async function neuronCount() {
  const { neurons } = await collections();
  return neurons.estimatedDocumentCount();
}

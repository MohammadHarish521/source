import { gunzipSync, gzipSync } from "node:zlib";
import { collections } from "@/lib/db";
import { MIN_SYNAPSES } from "./sources";

export type CsrGraph = {
  ids: string[];
  index: Map<string, number>;
  types: Array<string | null>;
  partners: Uint16Array;
  downOff: Uint32Array;
  downTo: Uint32Array;
  downSyn: Uint16Array;
  upOff: Uint32Array;
  upTo: Uint32Array;
  upSyn: Uint16Array;
};

const g = globalThis as typeof globalThis & {
  __flyCsr?: CsrGraph;
  __flyCsrLoad?: Promise<CsrGraph>;
};

function writeStrings(strings: string[]) {
  const payload = strings.map((s) => Buffer.from(s, "utf8"));
  const bytes = payload.reduce((n, b) => n + 2 + b.length, 0);
  const buf = Buffer.allocUnsafe(bytes);
  let o = 0;
  for (const b of payload) {
    buf.writeUInt16LE(b.length, o);
    o += 2;
    b.copy(buf, o);
    o += b.length;
  }
  return buf;
}

function readStrings(buf: Buffer, offset: number, n: number) {
  const out: string[] = [];
  let o = offset;
  for (let i = 0; i < n; i++) {
    const len = buf.readUInt16LE(o);
    o += 2;
    out.push(buf.subarray(o, o + len).toString("utf8"));
    o += len;
  }
  return { out, offset: o };
}

export function encodeCsr(graph: Omit<CsrGraph, "index">) {
  const n = graph.ids.length;
  const eDown = graph.downTo.length;
  const eUp = graph.upTo.length;
  const idBuf = writeStrings(graph.ids);
  const typeBuf = writeStrings(graph.types.map((t) => t ?? ""));
  const head = Buffer.allocUnsafe(16);
  head.write("FLYG", 0);
  head.writeUInt32LE(1, 4);
  head.writeUInt32LE(n, 8);
  head.writeUInt32LE(eDown, 12);
  const eUpBuf = Buffer.allocUnsafe(4);
  eUpBuf.writeUInt32LE(eUp, 0);
  const partners = Buffer.from(graph.partners.buffer, graph.partners.byteOffset, graph.partners.byteLength);
  const downOff = Buffer.from(graph.downOff.buffer, graph.downOff.byteOffset, graph.downOff.byteLength);
  const downTo = Buffer.from(graph.downTo.buffer, graph.downTo.byteOffset, graph.downTo.byteLength);
  const downSyn = Buffer.from(graph.downSyn.buffer, graph.downSyn.byteOffset, graph.downSyn.byteLength);
  const upOff = Buffer.from(graph.upOff.buffer, graph.upOff.byteOffset, graph.upOff.byteLength);
  const upTo = Buffer.from(graph.upTo.buffer, graph.upTo.byteOffset, graph.upTo.byteLength);
  const upSyn = Buffer.from(graph.upSyn.buffer, graph.upSyn.byteOffset, graph.upSyn.byteLength);
  return gzipSync(Buffer.concat([head, eUpBuf, idBuf, typeBuf, partners, downOff, downTo, downSyn, upOff, upTo, upSyn]), {
    level: 9,
  });
}

function packToBuffer(bytes: unknown) {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (bytes instanceof Uint8Array) return Buffer.from(bytes);
  if (bytes && typeof bytes === "object") {
    const raw = bytes as { buffer?: ArrayBuffer | Uint8Array; value?: () => Uint8Array };
    if (typeof raw.value === "function") return Buffer.from(raw.value());
    if (raw.buffer) return Buffer.from(raw.buffer as ArrayBuffer);
  }
  throw new Error("Mongo graph pack is not binary");
}

export function decodeCsr(gz: Buffer): CsrGraph {
  const buf = gunzipSync(gz);
  if (buf.toString("utf8", 0, 4) !== "FLYG") throw new Error("Bad graph pack magic");
  const n = buf.readUInt32LE(8);
  const eDown = buf.readUInt32LE(12);
  const eUp = buf.readUInt32LE(16);
  let o = 20;
  const ids = readStrings(buf, o, n);
  o = ids.offset;
  const typesRaw = readStrings(buf, o, n);
  o = typesRaw.offset;
  const partners = new Uint16Array(n);
  for (let i = 0; i < n; i++) partners[i] = buf.readUInt16LE(o + i * 2);
  o += n * 2;
  const copyU32 = (count: number) => {
    const arr = new Uint32Array(count);
    for (let i = 0; i < count; i++) arr[i] = buf.readUInt32LE(o + i * 4);
    o += count * 4;
    return arr;
  };
  const copyU16 = (count: number) => {
    const arr = new Uint16Array(count);
    for (let i = 0; i < count; i++) arr[i] = buf.readUInt16LE(o + i * 2);
    o += count * 2;
    return arr;
  };
  const downOff = copyU32(n + 1);
  const downTo = copyU32(eDown);
  const downSyn = copyU16(eDown);
  const upOff = copyU32(n + 1);
  const upTo = copyU32(eUp);
  const upSyn = copyU16(eUp);
  return {
    ids: ids.out,
    index: new Map(ids.out.map((id, i) => [id, i])),
    types: typesRaw.out.map((t) => t || null),
    partners,
    downOff,
    downTo,
    downSyn,
    upOff,
    upTo,
    upSyn,
  };
}

export function buildCsr(edges: Array<{ pre: string; post: string; synapses: number }>, neurons: Array<{ id: string; type: string | null; partners: number }>) {
  const ids = neurons.map((n) => n.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const down: Array<Array<{ to: number; syn: number }>> = ids.map(() => []);
  const up: Array<Array<{ to: number; syn: number }>> = ids.map(() => []);
  for (const edge of edges) {
    const a = index.get(edge.pre);
    const b = index.get(edge.post);
    if (a == null || b == null || a === b) continue;
    const syn = Math.min(65535, Math.max(0, edge.synapses | 0));
    down[a].push({ to: b, syn });
    up[b].push({ to: a, syn });
  }
  let eDown = 0;
  let eUp = 0;
  for (const list of down) eDown += list.length;
  for (const list of up) eUp += list.length;
  const downOff = new Uint32Array(ids.length + 1);
  const downTo = new Uint32Array(eDown);
  const downSyn = new Uint16Array(eDown);
  const upOff = new Uint32Array(ids.length + 1);
  const upTo = new Uint32Array(eUp);
  const upSyn = new Uint16Array(eUp);
  let od = 0;
  let ou = 0;
  for (let i = 0; i < ids.length; i++) {
    downOff[i] = od;
    for (const e of down[i]) {
      downTo[od] = e.to;
      downSyn[od] = e.syn;
      od += 1;
    }
    upOff[i] = ou;
    for (const e of up[i]) {
      upTo[ou] = e.to;
      upSyn[ou] = e.syn;
      ou += 1;
    }
  }
  downOff[ids.length] = od;
  upOff[ids.length] = ou;
  const partners = new Uint16Array(ids.length);
  neurons.forEach((n, i) => {
    partners[i] = Math.min(65535, Math.max(0, n.partners | 0));
  });
  return {
    ids,
    index,
    types: neurons.map((n) => n.type),
    partners,
    downOff,
    downTo,
    downSyn,
    upOff,
    upTo,
    upSyn,
  } satisfies CsrGraph;
}

export async function loadCsr(force = false): Promise<CsrGraph> {
  if (g.__flyCsr && !force) return g.__flyCsr;
  if (g.__flyCsrLoad && !force) return g.__flyCsrLoad;
  g.__flyCsrLoad = (async () => {
    const { graphPacks } = await collections();
    const packs = await graphPacks.find({}).toArray();
    packs.sort((a, b) => Number(a.i ?? 0) - Number(b.i ?? 0));
    if (!packs.length) {
      throw new Error("Mongo has no connectome graph yet. Run npm run push-mongo from a machine that has .cache/fly-mcns-v1.db.");
    }
    const gz = Buffer.concat(packs.map((p) => packToBuffer(p.bytes)));
    const graph = decodeCsr(gz);
    g.__flyCsr = graph;
    return graph;
  })();
  try {
    return await g.__flyCsrLoad;
  } finally {
    g.__flyCsrLoad = undefined;
  }
}

export function csr(): CsrGraph {
  if (!g.__flyCsr) throw new Error("Connectome graph is not in memory yet.");
  return g.__flyCsr;
}

export function cellTypeOf(id: string) {
  const graph = csr();
  const i = graph.index.get(id);
  return i == null ? null : graph.types[i];
}

export function undirectedNeighbors(id: string, minSynapses = MIN_SYNAPSES) {
  const graph = csr();
  const i = graph.index.get(id);
  if (i == null) return [];
  const seen = new Set<string>();
  for (let e = graph.downOff[i]; e < graph.downOff[i + 1]; e++) {
    if (graph.downSyn[e] >= minSynapses) seen.add(graph.ids[graph.downTo[e]]);
  }
  for (let e = graph.upOff[i]; e < graph.upOff[i + 1]; e++) {
    if (graph.upSyn[e] >= minSynapses) seen.add(graph.ids[graph.upTo[e]]);
  }
  return [...seen];
}

export function directedNeighbors(id: string, minSynapses = MIN_SYNAPSES) {
  const graph = csr();
  const i = graph.index.get(id);
  if (i == null) return { upstream: [], downstream: [] };
  const downstream: Array<{ id: string; synapses: number }> = [];
  const upstream: Array<{ id: string; synapses: number }> = [];
  for (let e = graph.downOff[i]; e < graph.downOff[i + 1]; e++) {
    if (graph.downSyn[e] >= minSynapses) downstream.push({ id: graph.ids[graph.downTo[e]], synapses: graph.downSyn[e] });
  }
  for (let e = graph.upOff[i]; e < graph.upOff[i + 1]; e++) {
    if (graph.upSyn[e] >= minSynapses) upstream.push({ id: graph.ids[graph.upTo[e]], synapses: graph.upSyn[e] });
  }
  downstream.sort((a, b) => b.synapses - a.synapses);
  upstream.sort((a, b) => b.synapses - a.synapses);
  return { upstream, downstream };
}

export function undirectedEdges(id: string, minSynapses = MIN_SYNAPSES) {
  const graph = csr();
  const i = graph.index.get(id);
  if (i == null) return [];
  const out: Array<{ partner: string; synapses: number }> = [];
  const seen = new Set<string>();
  const push = (partner: string, synapses: number) => {
    if (seen.has(partner)) return;
    seen.add(partner);
    out.push({ partner, synapses });
  };
  for (let e = graph.downOff[i]; e < graph.downOff[i + 1]; e++) {
    if (graph.downSyn[e] >= minSynapses) push(graph.ids[graph.downTo[e]], graph.downSyn[e]);
  }
  for (let e = graph.upOff[i]; e < graph.upOff[i + 1]; e++) {
    if (graph.upSyn[e] >= minSynapses) push(graph.ids[graph.upTo[e]], graph.upSyn[e]);
  }
  return out;
}

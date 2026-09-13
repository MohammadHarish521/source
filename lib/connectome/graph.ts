import { cellTypeOf, csr, directedNeighbors, undirectedEdges, undirectedNeighbors } from "./csr";
import { MIN_SYNAPSES } from "./sources";
import type { GraphExperiment, PathHop, PathResult } from "./types";

export function getNeighbors(rootId: string, minSynapses = MIN_SYNAPSES): string[] {
  return undirectedNeighbors(rootId, minSynapses);
}

export function getDirectedNeighbors(rootId: string, minSynapses = MIN_SYNAPSES) {
  return directedNeighbors(rootId, minSynapses);
}

export function shortestPath(from: string, to: string, minSynapses = MIN_SYNAPSES, maxHops = 8): PathResult {
  if (from === to) {
    return { from, to, hops: 0, found: true, minSynapses, path: [{ rootId: from, cellType: cellTypeOf(from), synapsesFromPrev: null }] };
  }

  const prev = new Map<string, { node: string; synapses: number }>();
  const queue = [from];
  const seen = new Set([from]);
  const depth = new Map<string, number>([[from, 0]]);
  let found = false;

  while (queue.length) {
    const node = queue.shift()!;
    const hops = depth.get(node) ?? 0;
    if (hops >= maxHops) continue;

    for (const edge of undirectedEdges(node, minSynapses)) {
      if (seen.has(edge.partner)) continue;
      seen.add(edge.partner);
      prev.set(edge.partner, { node, synapses: edge.synapses });
      depth.set(edge.partner, hops + 1);
      if (edge.partner === to) {
        found = true;
        queue.length = 0;
        break;
      }
      queue.push(edge.partner);
    }
  }

  const pathIds = [to];
  if (found) {
    let cursor = to;
    while (prev.has(cursor)) {
      cursor = prev.get(cursor)!.node;
      pathIds.push(cursor);
    }
    pathIds.reverse();
    if (pathIds[0] !== from) {
      return { from, to, hops: -1, found: false, minSynapses, path: [] };
    }
  }

  const path: PathHop[] = found
    ? pathIds.map((id, i) => ({
        rootId: id,
        cellType: cellTypeOf(id),
        synapsesFromPrev: i === 0 ? null : prev.get(id)?.synapses ?? null,
      }))
    : [];

  return {
    from,
    to,
    hops: found ? path.length - 1 : -1,
    found,
    minSynapses,
    path,
  };
}

export function pickConnectedPair(seed: string, targetHops = 4) {
  const graph = csr();
  const candidates: string[] = [];
  for (let i = 0; i < graph.ids.length; i++) {
    const n = graph.partners[i];
    if (n >= 8 && n <= 80) candidates.push(graph.ids[i]);
    if (candidates.length >= 4000) break;
  }
  if (candidates.length < 2) return null;

  let hash = 0;
  for (const ch of seed) hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  const start = candidates[hash % candidates.length];

  const depth = new Map<string, number>([[start, 0]]);
  const queue = [start];
  const layer: string[] = [];

  while (queue.length) {
    const node = queue.shift()!;
    const d = depth.get(node) ?? 0;
    if (d === targetHops) layer.push(node);
    if (d >= targetHops) continue;
    for (const next of getNeighbors(node)) {
      if (depth.has(next)) continue;
      depth.set(next, d + 1);
      queue.push(next);
    }
  }

  if (!layer.length) return null;
  const target = layer[(hash >>> 8) % layer.length];
  return { start, target, shortest: targetHops };
}

export function removalExperiment(rootId: string): GraphExperiment {
  const neighbors = getNeighbors(rootId);
  const seed = new Set<string>([rootId, ...neighbors]);
  for (const id of neighbors.slice(0, 48)) {
    for (const next of getNeighbors(id).slice(0, 16)) seed.add(next);
  }
  const nodes = [...seed];
  const index = new Map(nodes.map((id, i) => [id, i]));
  const removed = index.get(rootId) ?? -1;
  const n = nodes.length;
  const adj: number[][] = Array.from({ length: n }, () => []);

  if (!nodes.length) {
    return {
      rootId,
      label: "GRAPH SIMULATION",
      disclaimer:
        "This models connectivity changes in the graph. It does not predict what would biologically happen to the fly.",
      removedNode: rootId,
      originalPartners: 0,
      affectedReachable: 0,
      componentsBefore: 0,
      componentsAfter: 0,
      avgPathDelta: null,
      sampleSize: 0,
    };
  }

  for (const id of nodes) {
    const i = index.get(id)!;
    for (const edge of undirectedEdges(id)) {
      const j = index.get(edge.partner);
      if (j == null || i === j) continue;
      adj[i].push(j);
    }
  }

  const components = (skip: number | null) => {
    const seen = new Array(n).fill(false);
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (i === skip || seen[i]) continue;
      count += 1;
      const stack = [i];
      seen[i] = true;
      while (stack.length) {
        const v = stack.pop()!;
        for (const w of adj[v]) {
          if (w === skip || seen[w]) continue;
          seen[w] = true;
          stack.push(w);
        }
      }
    }
    return count;
  };

  const reachable = (start: number, skip: number | null) => {
    const seen = new Set<number>([start]);
    const stack = [start];
    while (stack.length) {
      const v = stack.pop()!;
      for (const w of adj[v]) {
        if (w === skip || seen.has(w)) continue;
        seen.add(w);
        stack.push(w);
      }
    }
    return seen.size;
  };

  const sampleIdx = nodes
    .map((_, i) => i)
    .filter((i) => i !== removed)
    .slice(0, 16);
  let delta = 0;
  for (const i of sampleIdx) {
    delta += reachable(i, null) - reachable(i, removed);
  }

  return {
    rootId,
    label: "GRAPH SIMULATION",
    disclaimer:
      "This models connectivity changes in the graph. It does not predict what would biologically happen to the fly.",
    removedNode: rootId,
    originalPartners: neighbors.length,
    affectedReachable: Math.max(0, Math.round(delta)),
    componentsBefore: components(null),
    componentsAfter: components(removed),
    avgPathDelta: sampleIdx.length ? Number((delta / sampleIdx.length).toFixed(2)) : null,
    sampleSize: n,
  };
}

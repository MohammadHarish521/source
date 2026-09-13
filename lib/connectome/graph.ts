import { getSqlite } from "@/lib/db";
import { MIN_SYNAPSES } from "./sources";
import type { GraphExperiment, PathHop, PathResult } from "./types";

export function getNeighbors(rootId: string, minSynapses = MIN_SYNAPSES): string[] {
  const db = getSqlite();
  const rows = db
    .prepare(
      `
      SELECT DISTINCT CASE WHEN pre = ? THEN post ELSE pre END AS partner
      FROM edges
      WHERE (pre = ? OR post = ?) AND synapses >= ?
    `,
    )
    .all(rootId, rootId, rootId, minSynapses) as Array<{ partner: string }>;
  return rows.map((row) => row.partner);
}

export function getDirectedNeighbors(rootId: string, minSynapses = MIN_SYNAPSES) {
  const db = getSqlite();
  const downstream = db
    .prepare("SELECT post AS id, MAX(synapses) AS synapses FROM edges WHERE pre = ? AND synapses >= ? GROUP BY post ORDER BY synapses DESC")
    .all(rootId, minSynapses) as Array<{ id: string; synapses: number }>;
  const upstream = db
    .prepare("SELECT pre AS id, MAX(synapses) AS synapses FROM edges WHERE post = ? AND synapses >= ? GROUP BY pre ORDER BY synapses DESC")
    .all(rootId, minSynapses) as Array<{ id: string; synapses: number }>;
  return { upstream, downstream };
}

export function shortestPath(from: string, to: string, minSynapses = MIN_SYNAPSES, maxHops = 8): PathResult {
  if (from === to) {
    return { from, to, hops: 0, found: true, minSynapses, path: [{ rootId: from, cellType: null, synapsesFromPrev: null }] };
  }

  const db = getSqlite();
  const prev = new Map<string, { node: string; synapses: number }>();
  const queue = [from];
  const seen = new Set([from]);
  let found = false;

  while (queue.length) {
    const node = queue.shift()!;
    const hops = (() => {
      let n = 0;
      let cursor = node;
      while (prev.has(cursor)) {
        cursor = prev.get(cursor)!.node;
        n += 1;
      }
      return n;
    })();
    if (hops >= maxHops) continue;

    const neighbors = db
      .prepare(
        `
        SELECT CASE WHEN pre = ? THEN post ELSE pre END AS partner, synapses
        FROM edges
        WHERE (pre = ? OR post = ?) AND synapses >= ?
      `,
      )
      .all(node, node, node, minSynapses) as Array<{ partner: string; synapses: number }>;

    for (const edge of neighbors) {
      if (seen.has(edge.partner)) continue;
      seen.add(edge.partner);
      prev.set(edge.partner, { node, synapses: edge.synapses });
      if (edge.partner === to) {
        found = true;
        queue.length = 0;
        break;
      }
      queue.push(edge.partner);
    }
  }

  const lookup = db.prepare("SELECT cell_type FROM neurons WHERE root_id = ?");
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
        cellType: (lookup.get(id) as { cell_type: string | null } | undefined)?.cell_type ?? null,
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
  const db = getSqlite();
  const candidates = db
    .prepare(
      `
      SELECT root_id FROM neurons
      WHERE partner_count BETWEEN 8 AND 80
      ORDER BY root_id
      LIMIT 4000
    `,
    )
    .all() as Array<{ root_id: string }>;
  if (candidates.length < 2) return null;

  let hash = 0;
  for (const ch of seed) hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  const start = candidates[hash % candidates.length].root_id;

  const prev = new Map<string, string>();
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
      prev.set(next, node);
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

  const db = getSqlite();
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

  const edgeRows = db
    .prepare(
      `
      SELECT pre, post FROM edges
      WHERE synapses >= ? AND pre IN (${nodes.map(() => "?").join(",")}) AND post IN (${nodes.map(() => "?").join(",")})
    `,
    )
    .all(MIN_SYNAPSES, ...nodes, ...nodes) as Array<{ pre: string; post: string }>;

  for (const edge of edgeRows) {
    const i = index.get(edge.pre);
    const j = index.get(edge.post);
    if (i == null || j == null || i === j) continue;
    adj[i].push(j);
    adj[j].push(i);
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

import { getDirectedNeighbors, pickConnectedPair, shortestPath } from "@/lib/connectome/graph";
import { fetchLiveNeuron, fetchLiveTypes, neuprintConfigured } from "@/lib/connectome/neuprint";
import type { CloudPoint, PathHop } from "@/lib/connectome/types";
import { getSqlite } from "@/lib/db";
import { MIN_SYNAPSES } from "@/lib/connectome/sources";

export type DailyHop = {
  rootId: string;
  cellType: string | null;
  synapsesFromPrev: number | null;
  live: boolean;
};

export type DailySceneNode = {
  rootId: string;
  cellType: string | null;
  x: number;
  y: number;
  z: number;
};

export type DailyScene = {
  attempt: DailySceneNode[];
  lesson: DailySceneNode[];
  cloud: CloudPoint[];
};

export type DailyRun = {
  day: string;
  label: "TRAINING";
  disclaimer: string;
  neuprint: boolean;
  found: boolean;
  hops: number;
  shortest: number | null;
  learnedEdges: number;
  start: DailyHop;
  target: DailyHop;
  path: DailyHop[];
  lessonPath?: DailyHop[];
  source: string;
};

function utcDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function rowToRun(row: { day: string; payload: string }): DailyRun {
  return JSON.parse(row.payload) as DailyRun;
}

export function getDailyRun(day = utcDay()): DailyRun | null {
  const row = getSqlite()
    .prepare("SELECT day, payload FROM daily_runs WHERE day = ?")
    .get(day) as { day: string; payload: string } | undefined;
  return row ? rowToRun(row) : null;
}

function learnedBonus(pre: string, post: string) {
  const row = getSqlite()
    .prepare("SELECT bonus FROM daily_weights WHERE pre = ? AND post = ?")
    .get(pre, post) as { bonus: number } | undefined;
  return row?.bonus ?? 0;
}

function walkWithLearning(start: string, target: string, maxHops = 8) {
  const path: Array<{ rootId: string; synapsesFromPrev: number | null }> = [
    { rootId: start, synapsesFromPrev: null },
  ];
  const seen = new Set([start]);
  let current = start;
  for (let hop = 0; hop < maxHops; hop++) {
    if (current === target) break;
    const { downstream } = getDirectedNeighbors(current);
    const scored = downstream
      .filter((edge) => !seen.has(edge.id))
      .map((edge) => ({
        ...edge,
        score: edge.synapses + learnedBonus(current, edge.id) * 8,
      }))
      .sort((a, b) => b.score - a.score);
    const next = scored[0];
    if (!next) break;
    seen.add(next.id);
    path.push({ rootId: next.id, synapsesFromPrev: next.synapses });
    current = next.id;
  }
  return { path, found: current === target };
}

function rememberPath(path: Array<{ rootId: string }>) {
  const db = getSqlite();
  const upsert = db.prepare(`
    INSERT INTO daily_weights (pre, post, bonus, updated_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(pre, post) DO UPDATE SET bonus = bonus + 1, updated_at = excluded.updated_at
  `);
  const now = Date.now();
  let learned = 0;
  const tx = db.transaction(() => {
    for (let i = 1; i < path.length; i++) {
      upsert.run(path[i - 1].rootId, path[i].rootId, now);
      learned += 1;
    }
  });
  tx();
  return learned;
}

export async function runDailyTrain(day = utcDay()): Promise<DailyRun> {
  const existing = getDailyRun(day);
  if (existing) return existing;

  const pair = pickConnectedPair(`train:${day}`, 4);
  if (!pair) {
    throw new Error("Local Male CNS graph is not ready. Wait for ingest, then retry.");
  }

  const shortest = shortestPath(pair.start, pair.target, MIN_SYNAPSES, 8);
  const walked = walkWithLearning(pair.start, pair.target, 8);
  const lesson = shortest.found
    ? rememberPath(shortest.path.map((hop) => ({ rootId: hop.rootId })))
    : walked.found
      ? rememberPath(walked.path)
      : 0;
  const learnedEdges = lesson;

  const ids = [
    ...new Set([
      pair.start,
      pair.target,
      ...walked.path.map((h) => h.rootId),
      ...shortest.path.map((h) => h.rootId),
    ]),
  ];
  let liveTypes = new Map<string, string | null>();
  let liveOk = neuprintConfigured();
  if (liveOk) {
    try {
      liveTypes = await fetchLiveTypes(ids);
    } catch {
      liveOk = false;
    }
  }

  const db = getSqlite();
  const typeOf = (id: string) => {
    const live = liveTypes.get(id);
    if (live) return live;
    const row = db.prepare("SELECT cell_type FROM neurons WHERE root_id = ?").get(id) as
      | { cell_type: string | null }
      | undefined;
    return row?.cell_type ?? null;
  };

  const hops: DailyHop[] = walked.path.map((step) => ({
    rootId: step.rootId,
    cellType: typeOf(step.rootId),
    synapsesFromPrev: step.synapsesFromPrev,
    live: liveTypes.has(step.rootId),
  }));

  const run: DailyRun = {
    day,
    label: "TRAINING",
    disclaimer:
      "The walk uses official Male CNS connections. Extra path weights are our training layer, not the fly’s memory.",
    neuprint: liveOk,
    found: walked.found,
    hops: Math.max(0, hops.length - 1),
    shortest: shortest.found ? shortest.hops : null,
    learnedEdges,
    start: hops[0] ?? { rootId: pair.start, cellType: typeOf(pair.start), synapsesFromPrev: null, live: liveTypes.has(pair.start) },
    target: {
      rootId: pair.target,
      cellType: typeOf(pair.target),
      synapsesFromPrev: null,
      live: liveTypes.has(pair.target),
    },
    path: hops,
    lessonPath: hopsFromShortest(shortest.path, typeOf, liveTypes),
    source: liveOk
      ? "neuPrint male-cns:v1.0 + local 5+ synapse graph"
      : "local 5+ synapse graph (neuPrint unavailable for this run)",
  };

  db.prepare("INSERT OR REPLACE INTO daily_runs (day, payload, created_at) VALUES (?, ?, ?)").run(
    day,
    JSON.stringify(run),
    Date.now(),
  );
  return run;
}

export async function ensureDailyRun(day = utcDay()) {
  return getDailyRun(day) ?? runDailyTrain(day);
}

function hopsFromShortest(
  path: PathHop[],
  typeOf: (id: string) => string | null,
  liveTypes: Map<string, string | null>,
): DailyHop[] {
  return path.map((hop) => ({
    rootId: hop.rootId,
    cellType: typeOf(hop.rootId) ?? hop.cellType,
    synapsesFromPrev: hop.synapsesFromPrev,
    live: liveTypes.has(hop.rootId),
  }));
}

function locateNeurons(ids: string[]): DailySceneNode[] {
  const db = getSqlite();
  const stmt = db.prepare(`
    SELECT root_id, cell_type,
           COALESCE(soma_x, pos_x) AS x,
           COALESCE(soma_y, pos_y) AS y,
           COALESCE(soma_z, pos_z) AS z
    FROM neurons
    WHERE root_id = ?
  `);

  const raw = ids.map((id) => {
    const row = stmt.get(id) as
      | { root_id: string; cell_type: string | null; x: number | null; y: number | null; z: number | null }
      | undefined;
    return {
      rootId: id,
      cellType: row?.cell_type ?? null,
      x: row?.x ?? null,
      y: row?.y ?? null,
      z: row?.z ?? null,
    };
  });

  const known = raw.filter((n) => n.x != null && n.y != null && n.z != null);
  if (!known.length) return [];

  return raw.map((node, i) => {
    if (node.x != null && node.y != null && node.z != null) {
      return { rootId: node.rootId, cellType: node.cellType, x: node.x, y: node.y, z: node.z };
    }
    let prev = i - 1;
    while (prev >= 0 && raw[prev].x == null) prev -= 1;
    let next = i + 1;
    while (next < raw.length && raw[next].x == null) next += 1;
    const a = prev >= 0 ? raw[prev] : known[0];
    const b = next < raw.length ? raw[next] : known[known.length - 1];
    const span = Math.max(1, next - prev);
    const t = prev >= 0 ? (i - prev) / span : 0;
    return {
      rootId: node.rootId,
      cellType: node.cellType,
      x: (a.x ?? 0) + ((b.x ?? 0) - (a.x ?? 0)) * t,
      y: (a.y ?? 0) + ((b.y ?? 0) - (a.y ?? 0)) * t,
      z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t,
    };
  });
}

function lessonHopsFor(run: DailyRun): DailyHop[] {
  if (run.lessonPath?.length) return run.lessonPath;
  const result = shortestPath(run.start.rootId, run.target.rootId, MIN_SYNAPSES, 8);
  if (!result.found) return [];
  return result.path.map((hop) => ({
    rootId: hop.rootId,
    cellType: hop.cellType,
    synapsesFromPrev: hop.synapsesFromPrev,
    live: false,
  }));
}

function sampleCloud(limit = 4800): CloudPoint[] {
  const rows = getSqlite()
    .prepare(
      `
      SELECT root_id, COALESCE(soma_x, pos_x) AS x, COALESCE(soma_y, pos_y) AS y,
             COALESCE(soma_z, pos_z) AS z, super_class, cell_type
      FROM neurons
      WHERE COALESCE(soma_x, pos_x) IS NOT NULL
      ORDER BY COALESCE(partner_count, 0) DESC
      LIMIT ?
    `,
    )
    .all(limit) as Array<{
    root_id: string;
    x: number;
    y: number;
    z: number;
    super_class: string | null;
    cell_type: string | null;
  }>;
  return rows.map((row) => ({
    rootId: row.root_id,
    x: row.x,
    y: row.y,
    z: row.z,
    superClass: row.super_class,
    cellType: row.cell_type,
  }));
}

export function getDailyScene(run: DailyRun): DailyScene {
  return {
    attempt: locateNeurons(run.path.map((hop) => hop.rootId)),
    lesson: locateNeurons(lessonHopsFor(run).map((hop) => hop.rootId)),
    cloud: sampleCloud(),
  };
}

export async function probeNeuprint() {
  if (!neuprintConfigured()) {
    return { ok: false, error: "NEUPRINT_TOKEN missing" as string | null, neuron: null };
  }
  try {
    const neuron = await fetchLiveNeuron("10001");
    return { ok: Boolean(neuron), error: null as string | null, neuron };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "neuPrint probe failed",
      neuron: null,
    };
  }
}

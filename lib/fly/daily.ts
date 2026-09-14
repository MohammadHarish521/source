import { getDirectedNeighbors, pickConnectedPair, shortestPath } from "@/lib/connectome/graph";
import { fetchLiveNeuron, fetchLiveTypes, neuprintConfigured } from "@/lib/connectome/neuprint";
import type { CloudPoint, PathHop } from "@/lib/connectome/types";
import { collections } from "@/lib/db";
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

export async function getDailyRun(day = utcDay()): Promise<DailyRun | null> {
  const { dailyRuns } = await collections();
  const row = await dailyRuns.findOne({ _id: day });
  const payload = row && typeof row.payload === "string" ? row.payload : row ? JSON.stringify(row.payload) : null;
  return payload ? (JSON.parse(payload) as DailyRun) : null;
}

function walkWithLearning(start: string, target: string, bonuses: Map<string, number>, maxHops = 8) {
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
        score: edge.synapses + (bonuses.get(`${current}\0${edge.id}`) ?? 0) * 8,
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

async function rememberPath(path: Array<{ rootId: string }>) {
  const { dailyWeights } = await collections();
  const now = Date.now();
  let learned = 0;
  for (let i = 1; i < path.length; i++) {
    await dailyWeights.updateOne(
      { pre: path[i - 1].rootId, post: path[i].rootId },
      { $inc: { bonus: 1 }, $set: { updated_at: now } },
      { upsert: true },
    );
    learned += 1;
  }
  return learned;
}

const training = globalThis as typeof globalThis & { __dailyTraining?: Map<string, Promise<DailyRun>> };

export function runDailyTrain(day = utcDay()): Promise<DailyRun> {
  const pending = training.__dailyTraining ??= new Map();
  const existing = pending.get(day);
  if (existing) return existing;
  const task = trainDay(day).finally(() => pending.delete(day));
  pending.set(day, task);
  return task;
}

async function trainDay(day: string): Promise<DailyRun> {
  const existing = await getDailyRun(day);
  if (existing) return existing;

  const pair = pickConnectedPair(`train:${day}`, 4);
  if (!pair) {
    throw new Error("Mongo connectome graph is not loaded. Run npm run push-mongo, then retry.");
  }

  const { dailyWeights } = await collections();
  const bonusRows = await dailyWeights.find({}).toArray();
  const bonuses = new Map<string, number>();
  for (const row of bonusRows) {
    bonuses.set(`${String(row.pre)}\0${String(row.post)}`, Number(row.bonus ?? 0));
  }

  const shortest = shortestPath(pair.start, pair.target, MIN_SYNAPSES, 8);
  const walked = walkWithLearning(pair.start, pair.target, bonuses, 8);
  const learnedEdges = shortest.found
    ? await rememberPath(shortest.path.map((hop) => ({ rootId: hop.rootId })))
    : walked.found
      ? await rememberPath(walked.path)
      : 0;

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

  const { cellTypeOf } = await import("@/lib/connectome/csr");
  const typeOf = (id: string) => liveTypes.get(id) || cellTypeOf(id);

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
      ? "neuPrint male-cns:v1.0 + Male CNS graph on MongoDB"
      : "Male CNS graph on MongoDB (neuPrint unavailable for this run)",
  };

  const { dailyRuns } = await collections();
  await dailyRuns.updateOne(
    { _id: day },
    { $set: { day, payload: JSON.stringify(run), created_at: Date.now() } },
    { upsert: true },
  );
  return run;
}

export async function ensureDailyRun(day = utcDay()) {
  const { ensureIngest } = await import("@/lib/connectome/ingest");
  await ensureIngest();
  return (await getDailyRun(day)) ?? runDailyTrain(day);
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

async function locateNeurons(ids: string[]): Promise<DailySceneNode[]> {
  const { neurons } = await collections();
  const rows = await neurons.find({ _id: { $in: ids } }).toArray();
  const byId = new Map(rows.map((row) => [String(row._id), row]));
  const raw = ids.map((id) => {
    const row = byId.get(id);
    const x = (row?.soma_x ?? row?.pos_x) as number | null | undefined;
    const y = (row?.soma_y ?? row?.pos_y) as number | null | undefined;
    const z = (row?.soma_z ?? row?.pos_z) as number | null | undefined;
    return {
      rootId: id,
      cellType: typeof row?.cell_type === "string" ? row.cell_type : null,
      x: x ?? null,
      y: y ?? null,
      z: z ?? null,
    };
  });

  // Missing anatomical positions must never be interpolated into invented locations.
  return raw.flatMap((node) =>
    typeof node.x === "number" && Number.isFinite(node.x) &&
    typeof node.y === "number" && Number.isFinite(node.y) &&
    typeof node.z === "number" && Number.isFinite(node.z)
      ? [{ rootId: node.rootId, cellType: node.cellType, x: node.x, y: node.y, z: node.z }]
      : [],
  );
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

async function sampleCloud(limit = 2800): Promise<CloudPoint[]> {
  const { neurons } = await collections();
  const rows = await neurons
    .find({ $or: [{ soma_x: { $ne: null } }, { pos_x: { $ne: null } }] })
    .sort({ partner_count: -1 })
    .limit(limit)
    .project({ soma_x: 1, soma_y: 1, soma_z: 1, pos_x: 1, pos_y: 1, pos_z: 1, super_class: 1, cell_type: 1 })
    .toArray();
  return rows
    .map((row) => {
      const x = (row.soma_x ?? row.pos_x) as number | null;
      const y = (row.soma_y ?? row.pos_y) as number | null;
      const z = (row.soma_z ?? row.pos_z) as number | null;
      if (x == null || y == null || z == null) return null;
      return {
        rootId: String(row._id),
        x,
        y,
        z,
        superClass: typeof row.super_class === "string" ? row.super_class : null,
        cellType: typeof row.cell_type === "string" ? row.cell_type : null,
      };
    })
    .filter((row): row is CloudPoint => Boolean(row));
}

export async function getDailyScene(run: DailyRun): Promise<DailyScene> {
  const lessonHops = lessonHopsFor(run);
  if (!run.lessonPath?.length && lessonHops.length) {
    run.lessonPath = lessonHops;
    const { dailyRuns } = await collections();
    await dailyRuns.updateOne({ _id: run.day }, { $set: { payload: JSON.stringify(run) } });
  }
  const [attempt, lesson, cloud] = await Promise.all([
    locateNeurons(run.path.map((hop) => hop.rootId)),
    locateNeurons(lessonHops.map((hop) => hop.rootId)),
    sampleCloud(24000),
  ]);
  return { attempt, lesson, cloud };
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

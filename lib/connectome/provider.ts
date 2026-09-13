import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, collections } from "@/lib/db";
import { csr } from "./csr";
import { ARCHETYPE_TITLES, archetypeFor, defaultStats } from "./archetypes";
import { getDirectedNeighbors, getNeighbors, pickConnectedPair, removalExperiment, shortestPath } from "./graph";
import { ensureIngest, ensureMetadata, getIngestStatus } from "./ingest";
import { REGION_GUIDES } from "./regions";
import { neuprintConfigured } from "./neuprint";
import { downsampleMorphology, parseNeuroglancerSkeleton, parseSwcSkeleton } from "./skeleton";
import { DATASET, MIN_SYNAPSES, PUBLIC_STATS, REMOTE } from "./sources";
import type {
  CloudPoint,
  ConnectomeProvider,
  DatasetInfo,
  LeaderboardKind,
  Morphology,
  NeuronRecord,
  Partners,
  RankedNeuron,
  RegionRecord,
  SearchHit,
} from "./types";

function rowToNeuron(row: Record<string, unknown> | undefined | null): NeuronRecord | null {
  if (!row) return null;
  if (row.root_id == null && row._id != null) row = { ...row, root_id: row._id };
  const num = (key: string) => {
    const value = row[key];
    return typeof value === "number" ? value : value == null ? null : Number(value);
  };
  const str = (key: string) => {
    const value = row[key];
    return value == null || value === "" ? null : String(value);
  };
  const soma =
    num("soma_x") != null && num("soma_y") != null && num("soma_z") != null
      ? ([num("soma_x")!, num("soma_y")!, num("soma_z")!] as [number, number, number])
      : null;
  const position =
    num("pos_x") != null && num("pos_y") != null && num("pos_z") != null
      ? ([num("pos_x")!, num("pos_y")!, num("pos_z")!] as [number, number, number])
      : null;
  return {
    rootId: String(row.root_id),
    supervoxelId: str("supervoxel_id"),
    cellType: str("cell_type"),
    hemibrainType: str("hemibrain_type"),
    superClass: str("super_class"),
    cellClass: str("cell_class"),
    cellSubClass: str("cell_sub_class"),
    superType: str("super_type"),
    flow: str("flow"),
    side: str("side"),
    nerve: str("nerve"),
    hemilineage: str("hemilineage"),
    hartensteinHemilineage: str("hartenstein_hemilineage"),
    neurotransmitter: str("neurotransmitter"),
    neurotransmitterConfidence: num("nt_confidence"),
    knownNt: str("known_nt"),
    knownNtSource: str("known_nt_source"),
    region: str("region"),
    vfbId: str("vfb_id"),
    fbbtId: str("fbbt_id"),
    status: str("status"),
    dimorphism: str("dimorphism"),
    fruDsx: str("fru_dsx"),
    synonyms: str("synonyms"),
    soma,
    position,
    inputSynapses: num("input_synapses"),
    outputSynapses: num("output_synapses"),
    inputPartners: num("input_partners"),
    outputPartners: num("output_partners"),
    partnerCount: num("partner_count"),
    cableLengthNm: num("cable_length_nm"),
    skeletonNodes: num("skeleton_nodes"),
  };
}

const morphologyCache = new Map<string, Morphology>();

async function fetchMorphology(rootId: string): Promise<Morphology> {
  const cached = morphologyCache.get(rootId);
  if (cached) return cached;
  const swcFile = path.join(DATA_DIR, "skeletons", `${rootId}.swc`);
  const binFile = path.join(DATA_DIR, "skeletons", `${rootId}.bin`);
  let morph: Morphology;
  if (fs.existsSync(swcFile)) {
    morph = parseSwcSkeleton(fs.readFileSync(swcFile, "utf8"), rootId);
  } else if (fs.existsSync(binFile)) {
    const buf = fs.readFileSync(binFile);
    morph = parseNeuroglancerSkeleton(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), rootId);
  } else {
    const swcRes = await fetch(`${REMOTE.skeletonsSwc}/${rootId}.swc`, {
      headers: { "User-Agent": "FLY-connectome/0.1" },
    });
    if (swcRes.ok) {
      const text = await swcRes.text();
      try {
        fs.mkdirSync(path.dirname(swcFile), { recursive: true });
        fs.writeFileSync(swcFile, text);
      } catch {
        /* ephemeral hosts have no disk */
      }
      morph = parseSwcSkeleton(text, rootId);
    } else {
      const binRes = await fetch(`${REMOTE.skeletonsPrecomputed}/${rootId}`, {
        headers: { "User-Agent": "FLY-connectome/0.1" },
      });
      if (!binRes.ok) {
        throw new Error(
          `Official Male CNS v1.0 skeleton for ${rootId} is unavailable (SWC HTTP ${swcRes.status}, precomputed HTTP ${binRes.status}).`,
        );
      }
      const buffer = await binRes.arrayBuffer();
      try {
        fs.mkdirSync(path.dirname(binFile), { recursive: true });
        fs.writeFileSync(binFile, Buffer.from(buffer));
      } catch {
        /* ephemeral hosts have no disk */
      }
      morph = parseNeuroglancerSkeleton(buffer, rootId);
    }
  }
  morph = downsampleMorphology(morph);
  const { neurons } = await collections();
  await neurons.updateOne(
    { _id: rootId },
    { $set: { cable_length_nm: morph.cableLengthNm, skeleton_nodes: morph.nodeCount } },
  );
  morphologyCache.set(rootId, morph);
  return morph;
}

export class McnsProvider implements ConnectomeProvider {
  async getDatasetInfo(): Promise<DatasetInfo> {
    const { refreshIngestStatus } = await import("./ingest");
    const ingest = await refreshIngestStatus();
    void ensureIngest().catch(() => undefined);
    return {
      id: DATASET.id,
      name: `${DATASET.name} ${DATASET.version}`,
      materialization: DATASET.materialization,
      neurons: ingest.neuronCount || PUBLIC_STATS.neurons,
      connections: ingest.edgeCount || PUBLIC_STATS.connections || 0,
      synapses: null,
      minSynapses: MIN_SYNAPSES,
      ready: {
        metadata: ingest.metadataReady,
        graph: ingest.graphReady,
        morphology: true,
      },
      ingest,
      sources: [
        REMOTE.annotationsFeather,
        REMOTE.tracedWeights,
        REMOTE.skeletonsSwc,
        DATASET.explorers.neuprint,
      ],
      live: {
        neuprint: neuprintConfigured(),
        dataset: DATASET.id,
      },
    };
  }

  async getNeuron(id: string): Promise<NeuronRecord | null> {
    await ensureMetadata();
    const { neurons } = await collections();
    const row = await neurons.findOne({ _id: id });
    return rowToNeuron(row);
  }

  async getNeuronPartners(id: string, limit = 24): Promise<Partners> {
    await ensureIngest();
    const { upstream, downstream } = getDirectedNeighbors(id);
    const { neurons } = await collections();
    const decorate = async (direction: "upstream" | "downstream", list: Array<{ id: string; synapses: number }>) => {
      const slice = list.slice(0, limit);
      const rows = await neurons.find({ _id: { $in: slice.map((e) => e.id) } }).toArray();
      const byId = new Map(rows.map((row) => [String(row._id), row]));
      return slice.map((edge) => {
        const meta = byId.get(edge.id);
        return {
          rootId: edge.id,
          direction,
          synapses: edge.synapses,
          cellType: typeof meta?.cell_type === "string" ? meta.cell_type : null,
          superClass: typeof meta?.super_class === "string" ? meta.super_class : null,
          side: typeof meta?.side === "string" ? meta.side : null,
        };
      });
    };
    return {
      minSynapses: MIN_SYNAPSES,
      upstream: await decorate("upstream", upstream),
      downstream: await decorate("downstream", downstream),
      inputSynapses: upstream.reduce((sum, e) => sum + e.synapses, 0),
      outputSynapses: downstream.reduce((sum, e) => sum + e.synapses, 0),
      inputPartners: upstream.length,
      outputPartners: downstream.length,
    };
  }

  async getNeuronMorphology(id: string): Promise<Morphology> {
    return fetchMorphology(id);
  }

  async searchNeurons(query: string, limit = 24): Promise<SearchHit[]> {
    await ensureMetadata();
    const q = query.trim();
    if (!q) return [];
    const { neurons } = await collections();
    if (/^\d{4,}$/.test(q)) {
      const exact = await neurons.findOne({ _id: q });
      const like = await neurons.find({ _id: { $regex: q } }).limit(limit).toArray();
      return [exact, ...like]
        .filter(Boolean)
        .slice(0, limit)
        .map((row, i) => {
          const neuron = rowToNeuron(row)!;
          return {
            rootId: neuron.rootId,
            cellType: neuron.cellType,
            superClass: neuron.superClass,
            cellClass: neuron.cellClass,
            side: neuron.side,
            flow: neuron.flow,
            partnerCount: neuron.partnerCount,
            score: i === 0 ? 1 : 0.6,
          };
        });
    }
    const archetypeHit = ARCHETYPE_TITLES.find((title) => title.toLowerCase().includes(q.toLowerCase()));
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    const rows = await neurons
      .find({
        $or: [
          { cell_type: rx },
          { super_class: rx },
          { cell_class: rx },
          { cell_sub_class: rx },
          { flow: rx },
          { side: rx },
          { neurotransmitter: rx },
          { region: rx },
          { synonyms: rx },
          { hemilineage: rx },
          { nerve: rx },
          { dimorphism: rx },
          { fru_dsx: rx },
        ],
      })
      .sort({ partner_count: -1 })
      .limit(limit)
      .toArray();
    const hits = rows.map((row) => {
      const neuron = rowToNeuron(row)!;
      return {
        rootId: neuron.rootId,
        cellType: neuron.cellType,
        superClass: neuron.superClass,
        cellClass: neuron.cellClass,
        side: neuron.side,
        flow: neuron.flow,
        partnerCount: neuron.partnerCount,
        score: 0.8,
      };
    });
    if (archetypeHit && hits.length < limit) {
      // Archetype search is computed, not stored. Return top connected cells as a discovery set.
    }
    return hits;
  }

  async listRegions(): Promise<RegionRecord[]> {
    await ensureMetadata();
    const { neurons, claims } = await collections();
    const claimedIds = (await claims.find({}, { projection: { root_id: 1 } }).toArray()).map((c) => String(c.root_id));
    return Promise.all(
      REGION_GUIDES.map(async (guide) => {
      const columns: Record<string, string> = {
        superClass: "super_class",
        cellClass: "cell_class",
        flow: "flow",
        region: "region",
        dimorphism: "dimorphism",
      };
      const column = columns[guide.column] ?? String(guide.column);
      if (!["super_class", "cell_class", "flow", "region", "dimorphism"].includes(column)) {
        throw new Error(`Unsupported region column ${column}`);
      }
      const neuronCount = await neurons.countDocuments({ [column]: guide.value });
      const claimedCount = claimedIds.length
        ? await neurons.countDocuments({ [column]: guide.value, _id: { $in: claimedIds } })
        : 0;
      return {
        slug: guide.slug,
        name: guide.name,
        scientificName: guide.scientificName,
        field: guide.field,
        match: { column: guide.column, value: guide.value },
        playful: guide.playful,
        neuronCount,
        claimedCount,
      };
    }),
    );
  }

  async getRegion(slug: string): Promise<RegionRecord | null> {
    const regions = await this.listRegions();
    return regions.find((region) => region.slug === slug) ?? null;
  }

  async getShortestPath(a: string, b: string) {
    await ensureIngest();
    return shortestPath(a, b);
  }

  async getBrainCloud(limit = 22000): Promise<CloudPoint[]> {
    await ensureMetadata();
    const { neurons } = await collections();
    const rows = await neurons
      .find({ $or: [{ soma_x: { $ne: null } }, { pos_x: { $ne: null } }] })
      .sort({ partner_count: -1 })
      .limit(limit)
      .project({ root_id: 1, soma_x: 1, soma_y: 1, soma_z: 1, pos_x: 1, pos_y: 1, pos_z: 1, super_class: 1, cell_type: 1 })
      .toArray();
    return rows
      .map((row) => {
        const x = (row.soma_x ?? row.pos_x) as number | null;
        const y = (row.soma_y ?? row.pos_y) as number | null;
        const z = (row.soma_z ?? row.pos_z) as number | null;
        if (x == null || y == null || z == null) return null;
        return {
          rootId: String(row.root_id ?? row._id),
          x,
          y,
          z,
          superClass: typeof row.super_class === "string" ? row.super_class : null,
          cellType: typeof row.cell_type === "string" ? row.cell_type : null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }

  async getLeaderboard(kind: LeaderboardKind, limit = 25): Promise<RankedNeuron[]> {
    await ensureIngest();
    const { neurons } = await collections();
    const maps: Record<LeaderboardKind, { sort: Record<string, 1 | -1>; filter: Record<string, unknown>; label: string }> = {
      "most-connected": { sort: { partner_count: -1 }, filter: { partner_count: { $ne: null } }, label: "unique partners" },
      "most-inputs": { sort: { input_partners: -1 }, filter: { input_partners: { $ne: null } }, label: "upstream partners" },
      "most-outputs": { sort: { output_partners: -1 }, filter: { output_partners: { $ne: null } }, label: "downstream partners" },
      "biggest-broadcasters": {
        sort: { output_partners: -1 },
        filter: { output_partners: { $gt: 0 }, input_partners: { $gt: 0 } },
        label: "output / input partners",
      },
      "biggest-listeners": {
        sort: { input_partners: -1 },
        filter: { output_partners: { $gt: 0 }, input_partners: { $gt: 0 } },
        label: "input / output partners",
      },
      "most-isolated": { sort: { partner_count: 1, root_id: 1 }, filter: { partner_count: { $ne: null } }, label: "unique partners" },
      largest: { sort: { cable_length_nm: -1 }, filter: { cable_length_nm: { $ne: null } }, label: "skeleton cable (nm)" },
      bridge: { sort: { partner_count: -1 }, filter: { partner_count: { $ne: null } }, label: "hub proxy (partner count)" },
    };
    const spec = maps[kind];
    const rows = await neurons.find(spec.filter).sort(spec.sort).limit(limit).toArray();
    return rows.map((row, i) => {
      const neuron = rowToNeuron(row)!;
      const value =
        kind === "most-inputs"
          ? neuron.inputPartners ?? 0
          : kind === "most-outputs" || kind === "biggest-broadcasters"
            ? neuron.outputPartners ?? 0
            : kind === "biggest-listeners"
              ? neuron.inputPartners ?? 0
              : kind === "largest"
                ? neuron.cableLengthNm ?? 0
                : neuron.partnerCount ?? 0;
      return {
        rank: i + 1,
        rootId: neuron.rootId,
        cellType: neuron.cellType,
        superClass: neuron.superClass,
        side: neuron.side,
        value,
        valueLabel: spec.label,
      };
    });
  }

  async getNeuronBySeed(seed: string): Promise<NeuronRecord | null> {
    await ensureMetadata();
    const graph = csr();
    if (!graph.ids.length) return null;
    let hash = 2166136261;
    for (const ch of seed) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
    const id = graph.ids[Math.abs(hash) % graph.ids.length];
    return this.getNeuron(id);
  }

  async getRandomConnectedPair(seed: string) {
    await ensureIngest();
    return pickConnectedPair(seed, 4);
  }

  async getNeighbors(id: string) {
    await ensureIngest();
    return getNeighbors(id);
  }

  async runRemovalExperiment(id: string) {
    await ensureIngest();
    return removalExperiment(id);
  }
}

export const connectome: ConnectomeProvider = new McnsProvider();

export function neuronArchetype(neuron: NeuronRecord) {
  return archetypeFor(neuron, defaultStats());
}

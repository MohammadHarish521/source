import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, getSqlite } from "@/lib/db";
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

function rowToNeuron(row: Record<string, unknown> | undefined): NeuronRecord | null {
  if (!row) return null;
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
      fs.mkdirSync(path.dirname(swcFile), { recursive: true });
      fs.writeFileSync(swcFile, text);
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
      fs.mkdirSync(path.dirname(binFile), { recursive: true });
      fs.writeFileSync(binFile, Buffer.from(buffer));
      morph = parseNeuroglancerSkeleton(buffer, rootId);
    }
  }
  morph = downsampleMorphology(morph);
  const db = getSqlite();
  db.prepare("UPDATE neurons SET cable_length_nm = ?, skeleton_nodes = ? WHERE root_id = ?").run(
    morph.cableLengthNm,
    morph.nodeCount,
    rootId,
  );
  morphologyCache.set(rootId, morph);
  return morph;
}

export class McnsProvider implements ConnectomeProvider {
  async getDatasetInfo(): Promise<DatasetInfo> {
    const ingest = getIngestStatus();
    void ensureIngest();
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
    const row = getSqlite().prepare("SELECT * FROM neurons WHERE root_id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return rowToNeuron(row);
  }

  async getNeuronPartners(id: string, limit = 24): Promise<Partners> {
    await ensureIngest();
    const { upstream, downstream } = getDirectedNeighbors(id);
    const db = getSqlite();
    const lookup = db.prepare("SELECT root_id, cell_type, super_class, side FROM neurons WHERE root_id = ?");
    const decorate = (direction: "upstream" | "downstream", list: Array<{ id: string; synapses: number }>) =>
      list.slice(0, limit).map((edge) => {
        const meta = lookup.get(edge.id) as
          | { root_id: string; cell_type: string | null; super_class: string | null; side: string | null }
          | undefined;
        return {
          rootId: edge.id,
          direction,
          synapses: edge.synapses,
          cellType: meta?.cell_type ?? null,
          superClass: meta?.super_class ?? null,
          side: meta?.side ?? null,
        };
      });
    return {
      minSynapses: MIN_SYNAPSES,
      upstream: decorate("upstream", upstream),
      downstream: decorate("downstream", downstream),
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
    const db = getSqlite();
    if (/^\d{4,}$/.test(q)) {
      const exact = db.prepare("SELECT * FROM neurons WHERE root_id = ?").get(q) as Record<string, unknown> | undefined;
      const like = db
        .prepare("SELECT * FROM neurons WHERE root_id LIKE ? LIMIT ?")
        .all(`%${q}%`, limit) as Array<Record<string, unknown>>;
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
    const term = `%${q.replaceAll("%", "")}%`;
    const rows = db
      .prepare(
        `
        SELECT * FROM neurons
        WHERE cell_type LIKE ? OR super_class LIKE ? OR cell_class LIKE ?
           OR cell_sub_class LIKE ? OR flow LIKE ? OR side LIKE ?
           OR neurotransmitter LIKE ? OR region LIKE ? OR synonyms LIKE ?
           OR hemilineage LIKE ? OR nerve LIKE ? OR dimorphism LIKE ? OR fru_dsx LIKE ?
        ORDER BY partner_count DESC
        LIMIT ?
      `,
      )
      .all(term, term, term, term, term, term, term, term, term, term, term, term, term, limit) as Array<Record<string, unknown>>;
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
    const db = getSqlite();
    return REGION_GUIDES.map((guide) => {
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
      const neuronCount = (
        db.prepare(`SELECT COUNT(*) AS n FROM neurons WHERE ${column} = ?`).get(guide.value) as { n: number }
      ).n;
      const claimedCount = (
        db
          .prepare(
            `SELECT COUNT(*) AS n FROM claims c JOIN neurons n ON n.root_id = c.root_id WHERE n.${column} = ?`,
          )
          .get(guide.value) as { n: number }
      ).n;
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
    });
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
    const rows = getSqlite()
      .prepare(
        `
        SELECT root_id, COALESCE(soma_x, pos_x) AS x, COALESCE(soma_y, pos_y) AS y,
               COALESCE(soma_z, pos_z) AS z, super_class, cell_type, partner_count
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

  async getLeaderboard(kind: LeaderboardKind, limit = 25): Promise<RankedNeuron[]> {
    await ensureIngest();
    const db = getSqlite();
    const maps: Record<LeaderboardKind, { sql: string; label: string }> = {
      "most-connected": {
        sql: "SELECT * FROM neurons WHERE partner_count IS NOT NULL ORDER BY partner_count DESC LIMIT ?",
        label: "unique partners",
      },
      "most-inputs": {
        sql: "SELECT * FROM neurons WHERE input_partners IS NOT NULL ORDER BY input_partners DESC LIMIT ?",
        label: "upstream partners",
      },
      "most-outputs": {
        sql: "SELECT * FROM neurons WHERE output_partners IS NOT NULL ORDER BY output_partners DESC LIMIT ?",
        label: "downstream partners",
      },
      "biggest-broadcasters": {
        sql: "SELECT * FROM neurons WHERE output_partners > 0 AND input_partners > 0 ORDER BY CAST(output_partners AS REAL) / input_partners DESC, output_partners DESC LIMIT ?",
        label: "output / input partners",
      },
      "biggest-listeners": {
        sql: "SELECT * FROM neurons WHERE output_partners > 0 AND input_partners > 0 ORDER BY CAST(input_partners AS REAL) / output_partners DESC, input_partners DESC LIMIT ?",
        label: "input / output partners",
      },
      "most-isolated": {
        sql: "SELECT * FROM neurons WHERE partner_count IS NOT NULL ORDER BY partner_count ASC, root_id LIMIT ?",
        label: "unique partners",
      },
      largest: {
        sql: "SELECT * FROM neurons WHERE cable_length_nm IS NOT NULL ORDER BY cable_length_nm DESC LIMIT ?",
        label: "skeleton cable (nm)",
      },
      bridge: {
        sql: "SELECT * FROM neurons WHERE partner_count IS NOT NULL ORDER BY partner_count DESC LIMIT ?",
        label: "hub proxy (partner count)",
      },
    };
    const spec = maps[kind];
    const rows = db.prepare(spec.sql).all(limit) as Array<Record<string, unknown>>;
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
    const db = getSqlite();
    const count = (db.prepare("SELECT COUNT(*) AS n FROM neurons").get() as { n: number }).n;
    if (!count) return null;
    let hash = 2166136261;
    for (const ch of seed) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
    const offset = Math.abs(hash) % count;
    const row = db
      .prepare("SELECT * FROM neurons ORDER BY root_id LIMIT 1 OFFSET ?")
      .get(offset) as Record<string, unknown> | undefined;
    return rowToNeuron(row);
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

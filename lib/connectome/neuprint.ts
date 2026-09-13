import { getNeuprintConfig } from "@/lib/env";

export type LiveNeuron = {
  bodyId: string;
  type: string | null;
  instance: string | null;
  pre: number | null;
  post: number | null;
  source: string;
};

export type LivePartner = {
  bodyId: string;
  type: string | null;
  synapses: number;
  direction: "upstream" | "downstream";
};

type CypherResponse = {
  columns: string[];
  data: unknown[][];
};

export function neuprintConfigured() {
  return getNeuprintConfig().configured;
}

export async function neuprintCypher<T extends Record<string, unknown>>(
  cypher: string,
): Promise<T[]> {
  const { token, server, dataset, configured } = getNeuprintConfig();
  if (!configured) {
    throw new Error("NEUPRINT_TOKEN is missing. Add it to .env from neuprint.janelia.org → Account.");
  }
  const res = await fetch(`${server}/api/custom/custom`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ cypher, dataset }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`neuPrint HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  const payload = (await res.json()) as CypherResponse;
  return (payload.data ?? []).map((row) => {
    const out: Record<string, unknown> = {};
    payload.columns.forEach((col, i) => {
      out[col] = row[i];
    });
    return out as T;
  });
}

export async function fetchLiveNeuron(bodyId: string): Promise<LiveNeuron | null> {
  const id = Number(bodyId);
  if (!Number.isFinite(id)) return null;
  const rows = await neuprintCypher<{
    bodyId: number;
    type: string | null;
    instance: string | null;
    pre: number | null;
    post: number | null;
  }>(`
    MATCH (n:Neuron {bodyId: ${id}})
    RETURN n.bodyId AS bodyId, n.type AS type, n.instance AS instance, n.pre AS pre, n.post AS post
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    bodyId: String(row.bodyId),
    type: row.type ?? null,
    instance: row.instance ?? null,
    pre: row.pre ?? null,
    post: row.post ?? null,
    source: `${getNeuprintConfig().server} · ${getNeuprintConfig().dataset}`,
  };
}

export async function fetchLivePartners(bodyId: string, limit = 12): Promise<LivePartner[]> {
  const id = Number(bodyId);
  if (!Number.isFinite(id)) return [];
  const down = await neuprintCypher<{ bodyId: number; type: string | null; weight: number }>(`
    MATCH (a:Neuron {bodyId: ${id}})-[w:ConnectsTo]->(b:Neuron)
    WHERE w.weight >= 5
    RETURN b.bodyId AS bodyId, b.type AS type, w.weight AS weight
    ORDER BY w.weight DESC
    LIMIT ${limit}
  `);
  const up = await neuprintCypher<{ bodyId: number; type: string | null; weight: number }>(`
    MATCH (b:Neuron)-[w:ConnectsTo]->(a:Neuron {bodyId: ${id}})
    WHERE w.weight >= 5
    RETURN b.bodyId AS bodyId, b.type AS type, w.weight AS weight
    ORDER BY w.weight DESC
    LIMIT ${limit}
  `);
  return [
    ...down.map((row) => ({
      bodyId: String(row.bodyId),
      type: row.type ?? null,
      synapses: Number(row.weight),
      direction: "downstream" as const,
    })),
    ...up.map((row) => ({
      bodyId: String(row.bodyId),
      type: row.type ?? null,
      synapses: Number(row.weight),
      direction: "upstream" as const,
    })),
  ];
}

export async function fetchLiveTypes(ids: string[]): Promise<Map<string, string | null>> {
  const nums = ids.map(Number).filter((n) => Number.isFinite(n));
  const out = new Map<string, string | null>();
  if (!nums.length) return out;
  const rows = await neuprintCypher<{ bodyId: number; type: string | null }>(`
    MATCH (n:Neuron)
    WHERE n.bodyId IN [${nums.join(",")}]
    RETURN n.bodyId AS bodyId, n.type AS type
  `);
  for (const row of rows) out.set(String(row.bodyId), row.type ?? null);
  return out;
}

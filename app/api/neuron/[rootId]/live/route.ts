import { fetchLiveNeuron, fetchLivePartners, neuprintConfigured } from "@/lib/connectome/neuprint";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ rootId: string }> }) {
  const { rootId } = await params;
  if (!neuprintConfigured()) {
    return Response.json({ error: "NEUPRINT_TOKEN is not configured." }, { status: 503 });
  }
  try {
    const [neuron, partners] = await Promise.all([fetchLiveNeuron(rootId), fetchLivePartners(rootId, 8)]);
    if (!neuron) return Response.json({ error: "Not in neuPrint male-cns:v1.0." }, { status: 404 });
    return Response.json({ neuron, partners, label: "DATA" });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "neuPrint query failed." },
      { status: 502 },
    );
  }
}

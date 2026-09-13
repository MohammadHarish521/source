import { neuronArchetype, connectome } from "@/lib/connectome/provider";
import { getSqlite } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ rootId: string }> }) {
  const { rootId } = await params;
  const neuron = await connectome.getNeuron(rootId);
  if (!neuron) return Response.json({ error: "Neuron not in the Male CNS v1.0 Traced annotation snapshot." }, { status: 404 });
  const claim = getSqlite()
    .prepare(
      `SELECT c.claim_number, c.created_at, u.handle
       FROM claims c JOIN users u ON u.id = c.user_id WHERE c.root_id = ?`,
    )
    .get(rootId) as { claim_number: number; created_at: number; handle: string } | undefined;
  return Response.json({
    neuron,
    archetype: neuronArchetype(neuron),
    claim: claim
      ? { handle: claim.handle, claimNumber: claim.claim_number, claimedAt: claim.created_at }
      : null,
  });
}

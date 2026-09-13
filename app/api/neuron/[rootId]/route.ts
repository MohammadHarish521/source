import { neuronArchetype, connectome } from "@/lib/connectome/provider";
import { collections } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ rootId: string }> }) {
  const { rootId } = await params;
  const neuron = await connectome.getNeuron(rootId);
  if (!neuron) return Response.json({ error: "Neuron not in the Male CNS v1.0 Traced annotation snapshot." }, { status: 404 });
  const { claims, users } = await collections();
  const claim = await claims.findOne({ root_id: rootId });
  const owner = claim ? await users.findOne({ _id: String(claim.user_id) }) : null;
  return Response.json({
    neuron,
    archetype: neuronArchetype(neuron),
    claim: claim && owner
      ? { handle: owner.handle, claimNumber: claim.claim_number, claimedAt: claim.created_at }
      : null,
  });
}

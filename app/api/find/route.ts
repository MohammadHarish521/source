import { neuronArchetype, connectome } from "@/lib/connectome/provider";
import { addActivity, getOrCreateUser, trackEvent } from "@/lib/session";
import { collections } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getOrCreateUser();
  const { users } = await collections();
  if (user.neuron_id) {
    const neuron = await connectome.getNeuron(String(user.neuron_id));
    return Response.json({ neuron, archetype: neuron ? neuronArchetype(neuron) : null, assigned: false });
  }
  const neuron = await connectome.getNeuronBySeed(String(user.id));
  if (!neuron) return Response.json({ error: "Metadata index is not ready yet." }, { status: 503 });
  await users.updateOne({ _id: user.id }, { $set: { neuron_id: neuron.rootId } });
  await trackEvent("find_neuron");
  await addActivity("find", `${user.handle} found their neuron`, neuron.rootId, String(user.id));
  return Response.json({ neuron, archetype: neuronArchetype(neuron), assigned: true });
}

export async function GET() {
  const user = await getOrCreateUser();
  if (!user.neuron_id) return Response.json({ neuron: null });
  const neuron = await connectome.getNeuron(String(user.neuron_id));
  return Response.json({ neuron, archetype: neuron ? neuronArchetype(neuron) : null });
}

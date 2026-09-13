import { neuronArchetype, connectome } from "@/lib/connectome/provider";
import { addActivity, getOrCreateUser, trackEvent } from "@/lib/session";
import { getSqlite } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getOrCreateUser();
  const db = getSqlite();
  if (user.neuron_id) {
    const neuron = await connectome.getNeuron(String(user.neuron_id));
    return Response.json({ neuron, archetype: neuron ? neuronArchetype(neuron) : null, assigned: false });
  }
  const neuron = await connectome.getNeuronBySeed(String(user.id));
  if (!neuron) return Response.json({ error: "Metadata index is not ready yet." }, { status: 503 });
  db.prepare("UPDATE users SET neuron_id = ? WHERE id = ?").run(neuron.rootId, user.id);
  trackEvent("find_neuron");
  addActivity("find", `${user.handle} found their neuron`, neuron.rootId, String(user.id));
  return Response.json({ neuron, archetype: neuronArchetype(neuron), assigned: true });
}

export async function GET() {
  const user = await getOrCreateUser();
  if (!user.neuron_id) return Response.json({ neuron: null });
  const neuron = await connectome.getNeuron(String(user.neuron_id));
  return Response.json({ neuron, archetype: neuron ? neuronArchetype(neuron) : null });
}

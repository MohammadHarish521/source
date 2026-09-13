import { addActivity, getOrCreateUser, trackEvent } from "@/lib/session";
import { collections } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { rootId, from } = (await req.json()) as { rootId?: string; from?: string };
  if (!rootId) return Response.json({ error: "rootId required" }, { status: 400 });
  const user = await getOrCreateUser();
  const { visits, users } = await collections();
  const seen = await visits.findOne({ user_id: user.id, root_id: rootId });
  await visits.insertOne({ user_id: user.id, root_id: rootId, created_at: Date.now() });
  if (!seen) await users.updateOne({ _id: user.id }, { $inc: { neurons_discovered: 1 } });
  if (from) {
    await users.updateOne({ _id: user.id }, { $inc: { connections_explored: 1 } });
    await trackEvent("connection_traverse");
  }
  await trackEvent("neuron_view");
  if (!seen) await addActivity("visit", `${user.handle} discovered a neuron`, rootId, String(user.id));
  return Response.json({ ok: true, first: !seen });
}

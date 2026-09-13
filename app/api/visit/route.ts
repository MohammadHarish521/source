import { addActivity, getOrCreateUser, trackEvent } from "@/lib/session";
import { getSqlite } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { rootId, from } = (await req.json()) as { rootId?: string; from?: string };
  if (!rootId) return Response.json({ error: "rootId required" }, { status: 400 });
  const user = await getOrCreateUser();
  const db = getSqlite();
  const seen = db.prepare("SELECT id FROM visits WHERE user_id = ? AND root_id = ?").get(user.id, rootId);
  db.prepare("INSERT INTO visits (user_id, root_id, created_at) VALUES (?, ?, ?)").run(user.id, rootId, Date.now());
  if (!seen) {
    db.prepare("UPDATE users SET neurons_discovered = neurons_discovered + 1 WHERE id = ?").run(user.id);
  }
  if (from) {
    db.prepare("UPDATE users SET connections_explored = connections_explored + 1 WHERE id = ?").run(user.id);
    trackEvent("connection_traverse");
  }
  trackEvent("neuron_view");
  if (!seen) addActivity("visit", `${user.handle} discovered a neuron`, rootId, String(user.id));
  return Response.json({ ok: true, first: !seen });
}

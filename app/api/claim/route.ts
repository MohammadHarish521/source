import { addActivity, getOrCreateUser, trackEvent } from "@/lib/session";
import { getSqlite } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { rootId } = (await req.json()) as { rootId: string };
  const user = await getOrCreateUser();
  const db = getSqlite();
  const existing = db.prepare("SELECT * FROM claims WHERE root_id = ?").get(rootId);
  if (existing) return Response.json({ error: "Already claimed." }, { status: 409 });
  if (Number(user.credits) < 1) return Response.json({ error: "No claim credits left." }, { status: 402 });
  const claimNumber = (db.prepare("SELECT COUNT(*) AS n FROM claims").get() as { n: number }).n + 1;
  db.prepare("INSERT INTO claims (root_id, user_id, claim_number, created_at) VALUES (?, ?, ?, ?)").run(
    rootId,
    user.id,
    claimNumber,
    Date.now(),
  );
  db.prepare("UPDATE users SET credits = credits - 1 WHERE id = ?").run(user.id);
  trackEvent("claim");
  addActivity("claim", `${user.handle} claimed a neuron`, rootId, String(user.id));
  return Response.json({
    ok: true,
    claimNumber,
    notice: "This is a profile slot inside FLY, not ownership of scientific data or biological material.",
  });
}

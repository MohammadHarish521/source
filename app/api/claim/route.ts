import { addActivity, getOrCreateUser, trackEvent } from "@/lib/session";
import { collections } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { rootId } = (await req.json()) as { rootId: string };
  const user = await getOrCreateUser();
  const { claims, users } = await collections();
  const existing = await claims.findOne({ root_id: rootId });
  if (existing) return Response.json({ error: "Already claimed." }, { status: 409 });
  if (Number(user.credits) < 1) return Response.json({ error: "No claim credits left." }, { status: 402 });
  const claimNumber = (await claims.countDocuments()) + 1;
  await claims.insertOne({ root_id: rootId, user_id: user.id, claim_number: claimNumber, created_at: Date.now() });
  await users.updateOne({ _id: user.id }, { $inc: { credits: -1 } });
  await trackEvent("claim");
  await addActivity("claim", `${user.handle} claimed a neuron`, rootId, String(user.id));
  return Response.json({
    ok: true,
    claimNumber,
    notice: "This is a profile slot inside FLY, not ownership of scientific data or biological material.",
  });
}

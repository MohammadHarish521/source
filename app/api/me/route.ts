import { connectome } from "@/lib/connectome/provider";
import { getOrCreateUser } from "@/lib/session";
import { collections } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOrCreateUser();
  const { claims } = await collections();
  const claimed = await claims.find({ user_id: user.id }).sort({ created_at: -1 }).toArray();
  const neuron = user.neuron_id ? await connectome.getNeuron(String(user.neuron_id)) : null;
  return Response.json({
    user,
    neuron,
    claimed: claimed.map((c) => ({ root_id: c.root_id, claim_number: c.claim_number, created_at: c.created_at })),
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as { handle?: string; favoriteRegion?: string };
  const user = await getOrCreateUser();
  const { users } = await collections();
  const patch: Record<string, string> = {};
  if (body.handle && /^[a-zA-Z0-9_\-]{3,24}$/.test(body.handle)) patch.handle = body.handle;
  if (body.favoriteRegion && /^[a-z0-9\-]{2,40}$/.test(body.favoriteRegion)) patch.favorite_region = body.favoriteRegion;
  if (Object.keys(patch).length) await users.updateOne({ _id: user.id }, { $set: patch });
  return Response.json({ ok: true });
}

import { connectome } from "@/lib/connectome/provider";
import { getOrCreateUser } from "@/lib/session";
import { getSqlite } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOrCreateUser();
  const claimed = getSqlite()
    .prepare("SELECT root_id, claim_number, created_at FROM claims WHERE user_id = ? ORDER BY id DESC")
    .all(user.id);
  const neuron = user.neuron_id ? await connectome.getNeuron(String(user.neuron_id)) : null;
  return Response.json({ user, neuron, claimed });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as { handle?: string; favoriteRegion?: string };
  const user = await getOrCreateUser();
  if (body.handle && /^[a-zA-Z0-9_\-]{3,24}$/.test(body.handle)) {
    getSqlite().prepare("UPDATE users SET handle = ? WHERE id = ?").run(body.handle, user.id);
  }
  if (body.favoriteRegion && /^[a-z0-9\-]{2,40}$/.test(body.favoriteRegion)) {
    getSqlite().prepare("UPDATE users SET favorite_region = ? WHERE id = ?").run(body.favoriteRegion, user.id);
  }
  return Response.json({ ok: true });
}

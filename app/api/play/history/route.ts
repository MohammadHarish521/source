import { getOrCreateUser } from "@/lib/session";
import { collections } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOrCreateUser();
  const { puzzlePlays } = await collections();
  const rows = await puzzlePlays
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .limit(21)
    .project({ day: 1, moves: 1, completed: 1, path: 1, created_at: 1 })
    .toArray();
  return Response.json({
    streak: user.streak,
    best: user.best_six_degrees,
    plays: rows,
  });
}

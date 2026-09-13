import { getOrCreateUser } from "@/lib/session";
import { getSqlite } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOrCreateUser();
  const rows = getSqlite()
    .prepare(
      `SELECT day, moves, completed, path, created_at
       FROM puzzle_plays
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 21`,
    )
    .all(user.id);
  return Response.json({
    streak: user.streak,
    best: user.best_six_degrees,
    plays: rows,
  });
}

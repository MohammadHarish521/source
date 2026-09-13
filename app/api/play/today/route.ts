import { connectome } from "@/lib/connectome/provider";
import { getOrCreateUser, todayKey } from "@/lib/session";
import { getSqlite } from "@/lib/db";
import { hashDayNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const day = todayKey();
  const db = getSqlite();
  let puzzle = db.prepare("SELECT * FROM daily_puzzles WHERE day = ?").get(day) as
    | {
        day: string;
        start_id: string;
        target_id: string;
        shortest: number;
        players: number;
        completions: number;
        move_sum: number;
      }
    | undefined;
  if (!puzzle) {
    const pair = await connectome.getRandomConnectedPair(day);
    if (!pair) return Response.json({ error: "Graph index is still building." }, { status: 503 });
    db.prepare("INSERT INTO daily_puzzles (day, start_id, target_id, shortest) VALUES (?, ?, ?, ?)").run(
      day,
      pair.start,
      pair.target,
      pair.shortest,
    );
    puzzle = db.prepare("SELECT * FROM daily_puzzles WHERE day = ?").get(day) as typeof puzzle;
  }
  const user = await getOrCreateUser();
  const play = db
    .prepare("SELECT * FROM puzzle_plays WHERE day = ? AND user_id = ? ORDER BY id DESC LIMIT 1")
    .get(day, user.id) as { completed: number; moves: number | null; path: string | null } | undefined;
  const history = db
    .prepare(
      "SELECT day, moves, completed FROM puzzle_plays WHERE user_id = ? ORDER BY created_at DESC LIMIT 14",
    )
    .all(user.id);
  const start = await connectome.getNeuron(puzzle!.start_id);
  const target = await connectome.getNeuron(puzzle!.target_id);
  return Response.json({
    number: hashDayNumber(day),
    day,
    start,
    target,
    shortestHidden: true,
    shortest: play?.completed ? puzzle!.shortest : null,
    stats: {
      players: puzzle!.players,
      completions: puzzle!.completions,
      averageMoves: puzzle!.completions ? puzzle!.move_sum / puzzle!.completions : null,
      completionRate: puzzle!.players ? puzzle!.completions / puzzle!.players : null,
    },
    user: {
      handle: user.handle,
      streak: user.streak,
      bestSixDegrees: user.best_six_degrees,
    },
    history,
    play,
  });
}

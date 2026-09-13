import { connectome } from "@/lib/connectome/provider";
import { getOrCreateUser, todayKey } from "@/lib/session";
import { collections } from "@/lib/db";
import { hashDayNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const day = todayKey();
  const { dailyPuzzles, puzzlePlays } = await collections();
  let puzzle = await dailyPuzzles.findOne({ _id: day });
  if (!puzzle) {
    const pair = await connectome.getRandomConnectedPair(day);
    if (!pair) return Response.json({ error: "Graph index is still building." }, { status: 503 });
    await dailyPuzzles.updateOne(
      { _id: day },
      {
        $setOnInsert: {
          day,
          start_id: pair.start,
          target_id: pair.target,
          shortest: pair.shortest,
          players: 0,
          completions: 0,
          move_sum: 0,
        },
      },
      { upsert: true },
    );
    puzzle = await dailyPuzzles.findOne({ _id: day });
  }
  const user = await getOrCreateUser();
  const play = await puzzlePlays.find({ day, user_id: user.id }).sort({ created_at: -1 }).limit(1).next();
  const history = await puzzlePlays
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .limit(14)
    .project({ day: 1, moves: 1, completed: 1 })
    .toArray();
  const start = await connectome.getNeuron(String(puzzle!.start_id));
  const target = await connectome.getNeuron(String(puzzle!.target_id));
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
      averageMoves: puzzle!.completions ? Number(puzzle!.move_sum) / Number(puzzle!.completions) : null,
      completionRate: puzzle!.players ? Number(puzzle!.completions) / Number(puzzle!.players) : null,
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

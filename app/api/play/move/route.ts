import { connectome } from "@/lib/connectome/provider";
import { addActivity, getOrCreateUser, todayKey, trackEvent } from "@/lib/session";
import { collections } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { current?: string; next?: string; path?: string[]; failed?: boolean };
  const user = await getOrCreateUser();
  const day = todayKey();
  const { dailyPuzzles, puzzlePlays, users } = await collections();
  const puzzle = await dailyPuzzles.findOne({ _id: day });
  if (!puzzle) return Response.json({ error: "No daily puzzle." }, { status: 404 });

  if (body.failed) {
    const path = body.path ?? [];
    await puzzlePlays.insertOne({
      day,
      user_id: user.id,
      moves: Math.max(0, path.length - 1),
      completed: 0,
      path: JSON.stringify(path),
      created_at: Date.now(),
    });
    return Response.json({ ok: true, failed: true, shortest: null });
  }

  if (!body.current || !body.next || !body.path) {
    return Response.json({ error: "Missing move." }, { status: 400 });
  }

  const neighbors = await connectome.getNeighbors(body.current);
  if (!neighbors.includes(body.next)) {
    return Response.json({ error: "That neuron is not a recorded partner." }, { status: 400 });
  }

  const path = [...body.path, body.next];
  const completed = body.next === puzzle.target_id;
  const moves = path.length - 1;
  if (completed) {
    const already = await puzzlePlays.findOne({ day, user_id: user.id, completed: 1 });
    await puzzlePlays.insertOne({
      day,
      user_id: user.id,
      moves,
      completed: 1,
      path: JSON.stringify(path),
      created_at: Date.now(),
    });
    if (!already) {
      await dailyPuzzles.updateOne({ _id: day }, { $inc: { completions: 1, move_sum: moves } });
      await trackEvent("daily_complete");
      await addActivity("play", `${user.handle} completed Fly daily in ${moves} moves`, String(puzzle.target_id), String(user.id));
    }
    const best = user.best_six_degrees == null ? moves : Math.min(Number(user.best_six_degrees), moves);
    const last = String(user.last_puzzle_day ?? "");
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const streak = last === yesterday ? Number(user.streak) + 1 : last === day ? Number(user.streak) : 1;
    await users.updateOne({ _id: user.id }, { $set: { best_six_degrees: best, streak, last_puzzle_day: day } });
  }
  await trackEvent("daily_move");
  return Response.json({
    ok: true,
    completed,
    moves,
    shortest: completed ? puzzle.shortest : null,
    partners: completed ? [] : await connectome.getNeuronPartners(body.next, 30),
  });
}

export async function PUT() {
  const user = await getOrCreateUser();
  const day = todayKey();
  const { dailyPuzzles, puzzlePlays } = await collections();
  const started = await puzzlePlays.findOne({ day, user_id: user.id });
  if (!started) {
    await dailyPuzzles.updateOne({ _id: day }, { $inc: { players: 1 } });
    await trackEvent("daily_start");
  }
  return Response.json({ ok: true, userId: user.id });
}

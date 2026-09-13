import { connectome } from "@/lib/connectome/provider";
import { addActivity, getOrCreateUser, todayKey, trackEvent } from "@/lib/session";
import { getSqlite } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { current?: string; next?: string; path?: string[]; failed?: boolean };
  const user = await getOrCreateUser();
  const day = todayKey();
  const db = getSqlite();
  const puzzle = db.prepare("SELECT * FROM daily_puzzles WHERE day = ?").get(day) as
    | { start_id: string; target_id: string; shortest: number }
    | undefined;
  if (!puzzle) return Response.json({ error: "No daily puzzle." }, { status: 404 });

  if (body.failed) {
    const path = body.path ?? [];
    db.prepare(
      "INSERT INTO puzzle_plays (day, user_id, moves, completed, path, created_at) VALUES (?, ?, ?, 0, ?, ?)",
    ).run(day, user.id, Math.max(0, path.length - 1), JSON.stringify(path), Date.now());
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
    const already = db
      .prepare("SELECT id FROM puzzle_plays WHERE day = ? AND user_id = ? AND completed = 1")
      .get(day, user.id);
    db.prepare(
      "INSERT INTO puzzle_plays (day, user_id, moves, completed, path, created_at) VALUES (?, ?, ?, 1, ?, ?)",
    ).run(day, user.id, moves, JSON.stringify(path), Date.now());
    if (!already) {
      db.prepare("UPDATE daily_puzzles SET completions = completions + 1, move_sum = move_sum + ? WHERE day = ?").run(
        moves,
        day,
      );
      trackEvent("daily_complete");
      addActivity("play", `${user.handle} completed Fly daily in ${moves} moves`, puzzle.target_id, String(user.id));
    }
    const best = user.best_six_degrees == null ? moves : Math.min(Number(user.best_six_degrees), moves);
    const last = String(user.last_puzzle_day ?? "");
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const streak = last === yesterday ? Number(user.streak) + 1 : last === day ? Number(user.streak) : 1;
    db.prepare("UPDATE users SET best_six_degrees = ?, streak = ?, last_puzzle_day = ? WHERE id = ?").run(
      best,
      streak,
      day,
      user.id,
    );
  }
  trackEvent("daily_move");
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
  const db = getSqlite();
  const started = db.prepare("SELECT id FROM puzzle_plays WHERE day = ? AND user_id = ?").get(day, user.id);
  if (!started) {
    db.prepare("UPDATE daily_puzzles SET players = players + 1 WHERE day = ?").run(day);
    trackEvent("daily_start");
  }
  return Response.json({ ok: true, userId: user.id });
}

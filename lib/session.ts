import { cookies } from "next/headers";
import { getSqlite } from "./db";

const COOKIE = "fly_id";

function handleFromId(id: string) {
  return `traveler-${id.slice(0, 6)}`;
}

export async function getOrCreateUser() {
  const jar = await cookies();
  let id = jar.get(COOKIE)?.value;
  const db = getSqlite();
  if (!id) {
    id = crypto.randomUUID();
    jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 400 });
  }
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (existing) return existing;
  const now = Date.now();
  db.prepare("INSERT INTO users (id, handle, created_at) VALUES (?, ?, ?)").run(id, handleFromId(id), now);
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown>;
}

export function trackEvent(event: string) {
  const day = new Date().toISOString().slice(0, 10);
  const db = getSqlite();
  const row = db.prepare("SELECT id, count FROM analytics WHERE event = ? AND day = ?").get(event, day) as
    | { id: number; count: number }
    | undefined;
  if (row) db.prepare("UPDATE analytics SET count = count + 1 WHERE id = ?").run(row.id);
  else db.prepare("INSERT INTO analytics (event, day, count) VALUES (?, ?, 1)").run(event, day);
}

export function addActivity(kind: string, message: string, rootId?: string, userId?: string) {
  getSqlite()
    .prepare("INSERT INTO activity (kind, message, root_id, user_id, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(kind, message, rootId ?? null, userId ?? null, Date.now());
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

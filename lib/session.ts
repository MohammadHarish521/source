import { cookies } from "next/headers";
import { asUser, collections } from "./db";

const COOKIE = "fly_id";

function handleFromId(id: string) {
  return `traveler-${id.slice(0, 6)}`;
}

export async function getOrCreateUser() {
  const jar = await cookies();
  let id = jar.get(COOKIE)?.value;
  const { users } = await collections();
  if (!id) {
    id = crypto.randomUUID();
    jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 400 });
  }
  const existing = await users.findOne({ _id: id });
  if (existing) return asUser(existing)!;
  const now = Date.now();
  const doc = {
    _id: id,
    handle: handleFromId(id),
    neuron_id: null,
    created_at: now,
    credits: 3,
    streak: 0,
    last_puzzle_day: null,
    favorite_region: null,
    neurons_discovered: 0,
    connections_explored: 0,
    best_six_degrees: null,
  };
  await users.updateOne({ _id: id }, { $setOnInsert: doc }, { upsert: true });
  const created = await users.findOne({ _id: id });
  return asUser(created)!;
}

export async function trackEvent(event: string) {
  const day = new Date().toISOString().slice(0, 10);
  const { analytics } = await collections();
  await analytics.updateOne({ event, day }, { $inc: { count: 1 }, $setOnInsert: { event, day } }, { upsert: true });
}

export async function addActivity(kind: string, message: string, rootId?: string, userId?: string) {
  const { activity } = await collections();
  await activity.insertOne({
    kind,
    message,
    root_id: rootId ?? null,
    user_id: userId ?? null,
    created_at: Date.now(),
  });
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

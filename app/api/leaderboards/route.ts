import { connectome } from "@/lib/connectome/provider";
import type { LeaderboardKind } from "@/lib/connectome/types";

export const dynamic = "force-dynamic";

const KINDS: LeaderboardKind[] = [
  "most-connected",
  "most-inputs",
  "most-outputs",
  "biggest-broadcasters",
  "biggest-listeners",
  "most-isolated",
  "largest",
  "bridge",
];

export async function GET(req: Request) {
  const kind = (new URL(req.url).searchParams.get("kind") ?? "most-connected") as LeaderboardKind;
  if (!KINDS.includes(kind)) return Response.json({ error: "Unknown board" }, { status: 400 });
  return Response.json({ kind, rows: await connectome.getLeaderboard(kind, 40) });
}

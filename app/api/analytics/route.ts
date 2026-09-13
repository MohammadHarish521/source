import { trackEvent } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { event } = (await req.json()) as { event?: string };
  const allowed = new Set([
    "brain_enter",
    "neuron_view",
    "connection_traverse",
    "share_click",
    "find_neuron",
    "daily_start",
    "daily_complete",
    "claim",
    "daily_move",
  ]);
  if (event && allowed.has(event)) await trackEvent(event);
  return Response.json({ ok: true });
}

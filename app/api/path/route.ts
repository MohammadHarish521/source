import { connectome } from "@/lib/connectome/provider";
import { addActivity, getOrCreateUser, trackEvent } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const a = url.searchParams.get("a") ?? "";
  const b = url.searchParams.get("b") ?? "";
  const result = await connectome.getShortestPath(a, b);
  if (result.found) {
    const user = await getOrCreateUser();
    await trackEvent("path_found");
    await addActivity("path", `Someone found a ${result.hops} hop connection`, a, String(user.id));
  }
  return Response.json(result);
}

import { connectome } from "@/lib/connectome/provider";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return Response.json({ results: await connectome.searchNeurons(q, 30) });
}

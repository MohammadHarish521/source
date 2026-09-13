import { connectome } from "@/lib/connectome/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  const points = await connectome.getBrainCloud(18000);
  return Response.json({ points, count: points.length });
}

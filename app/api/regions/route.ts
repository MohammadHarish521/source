import { connectome } from "@/lib/connectome/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ regions: await connectome.listRegions() });
}

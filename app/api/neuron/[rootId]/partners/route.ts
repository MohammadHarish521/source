import { connectome } from "@/lib/connectome/provider";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ rootId: string }> }) {
  const { rootId } = await params;
  return Response.json(await connectome.getNeuronPartners(rootId, 40));
}

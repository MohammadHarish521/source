import { connectome } from "@/lib/connectome/provider";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ rootId: string }> }) {
  const { rootId } = await params;
  try {
    const morph = await connectome.getNeuronMorphology(rootId);
    return Response.json(morph);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Morphology unavailable" },
      { status: 404 },
    );
  }
}

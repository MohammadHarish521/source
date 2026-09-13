import { connectome } from "@/lib/connectome/provider";
import { collections } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const region = await connectome.getRegion(slug);
  if (!region) return Response.json({ error: "Unknown region" }, { status: 404 });
  const column =
    region.match.column === "superClass"
      ? "super_class"
      : region.match.column === "cellClass"
        ? "cell_class"
        : region.match.column;
  const { neurons, claims, users } = await collections();
  const neuronRows = await neurons
    .find({ [column]: region.match.value })
    .sort({ partner_count: -1 })
    .limit(40)
    .project({ root_id: 1, cell_type: 1, super_class: 1, side: 1, partner_count: 1 })
    .toArray();
  const claimRows = await claims.find({}).sort({ created_at: -1 }).limit(80).toArray();
  const claimed = [];
  for (const claim of claimRows) {
    const neuron = await neurons.findOne({ _id: String(claim.root_id), [column]: region.match.value });
    if (!neuron) continue;
    const user = await users.findOne({ _id: String(claim.user_id) });
    claimed.push({ root_id: claim.root_id, handle: user?.handle, claim_number: claim.claim_number });
    if (claimed.length >= 12) break;
  }
  return Response.json({
    region,
    neurons: neuronRows.map((row) => ({
      root_id: row.root_id ?? row._id,
      cell_type: row.cell_type,
      super_class: row.super_class,
      side: row.side,
      partner_count: row.partner_count,
    })),
    claimed,
  });
}

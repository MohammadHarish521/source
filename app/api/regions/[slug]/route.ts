import { connectome } from "@/lib/connectome/provider";
import { getSqlite } from "@/lib/db";

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
  const neurons = getSqlite()
    .prepare(
      `SELECT root_id, cell_type, super_class, side, partner_count FROM neurons WHERE ${column} = ? ORDER BY partner_count DESC LIMIT 40`,
    )
    .all(region.match.value);
  const claimed = getSqlite()
    .prepare(
      `SELECT c.root_id, u.handle, c.claim_number FROM claims c
       JOIN neurons n ON n.root_id = c.root_id
       JOIN users u ON u.id = c.user_id
       WHERE n.${column} = ? ORDER BY c.id DESC LIMIT 12`,
    )
    .all(region.match.value);
  return Response.json({ region, neurons, claimed });
}

import { collections } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { activity } = await collections();
  const rows = await activity.find({}).sort({ created_at: -1 }).limit(30).toArray();
  return Response.json({ activity: rows });
}

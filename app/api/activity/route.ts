import { getSqlite } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = getSqlite()
    .prepare("SELECT * FROM activity ORDER BY created_at DESC LIMIT 30")
    .all();
  return Response.json({ activity: rows });
}

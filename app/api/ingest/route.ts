import { ensureIngest, getIngestStatus } from "@/lib/connectome/ingest";

export const dynamic = "force-dynamic";

export async function GET() {
  void ensureIngest();
  return Response.json(getIngestStatus());
}

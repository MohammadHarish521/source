import { ensureDailyRun, getDailyScene, probeNeuprint } from "@/lib/fly/daily";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [run, probe] = await Promise.all([ensureDailyRun(), probeNeuprint()]);
    return Response.json({ run, scene: await getDailyScene(run), probe });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Daily train failed." },
      { status: 503 },
    );
  }
}

export async function POST() {
  return GET();
}

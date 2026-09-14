"use client";

import { useQuery } from "@tanstack/react-query";
import { TrainingObservatory } from "@/components/training-observatory";
import type { DailyRun, DailyScene } from "@/lib/fly/daily";

export default function TodayPage() {
  const today = useQuery({
    queryKey: ["today-run"],
    queryFn: async () => {
      const response = await fetch("/api/today");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Daily training unavailable");
      return data as { run: DailyRun; scene: DailyScene };
    },
    refetchInterval: 60000,
  });
  return <main className="mx-auto max-w-7xl px-5 py-12">
    <p className="label">THE DAILY OBSERVATORY</p>
    <h1 className="mt-3 text-4xl md:text-5xl">Follow the learning. Inspect the wiring.</h1>
    <p className="mb-8 mt-4 max-w-3xl text-[var(--muted)]">A new graph-training run each UTC day, with saved weights carried into future runs. Training checks automatically while this server is running.</p>
    {today.data ? <TrainingObservatory key={today.data.run.day} run={today.data.run} scene={today.data.scene} /> : <div className="panel p-8" role="status">{today.error?.message ?? "Loading the recorded anatomy and daily run…"}</div>}
    {today.error && today.data && <p role="alert" className="mt-4 text-[var(--danger)]">Refresh failed. Showing the last loaded run: {today.error.message}</p>}
  </main>;
}

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { DailyFlyScene } from "@/components/daily-fly-scene";
import { LabelChip } from "@/components/label-chip";
import type { DailyRun, DailyScene } from "@/lib/fly/daily";

type TodayPayload = {
  run?: DailyRun;
  scene?: DailyScene;
  probe?: { ok: boolean; neuron: { type: string | null; instance: string | null } | null };
  error?: string;
};

export default function TodayPage() {
  const today = useQuery({
    queryKey: ["today-run"],
    queryFn: () => fetch("/api/today").then((r) => r.json() as Promise<TodayPayload>),
  });
  const run = today.data?.run;
  const scene = today.data?.scene;
  const probe = today.data?.probe;

  return (
    <main className="relative min-h-[92vh] overflow-hidden">
      <div className="absolute inset-0">
        {scene && (scene.attempt.length || scene.cloud.length) ? (
          <DailyFlyScene scene={scene} />
        ) : (
          <div className="grid h-full place-items-center text-[var(--muted)]">
            <p className="label">{today.data?.error ?? "Plotting today’s walk on real somas…"}</p>
          </div>
        )}
      </div>

      <div className="relative mx-auto flex min-h-[92vh] max-w-7xl flex-col justify-end px-5 pb-10 pt-24">
        <div className="panel max-w-xl p-6">
          <p className="label">TODAY THE FLY RAN</p>
          <h1 className="mt-2 text-4xl md:text-5xl">A walk on real wiring.</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Green is the greedy attempt. Cyan is the official shortest path we reinforce. The fly body is a model. The
            coordinates are real somas.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LabelChip kind="GRAPH SIMULATION" />
            {run?.neuprint ? <LabelChip kind="DATA" /> : null}
          </div>

          {today.data?.error ? <p className="mt-6 text-[var(--danger)]">{today.data.error}</p> : null}

          {run ? (
            <>
              <p className="mt-6 font-mono text-sm">
                {run.start.cellType ?? run.start.rootId}
                <span className="text-[var(--muted)]"> → </span>
                {run.target.cellType ?? run.target.rootId}
              </p>
              <h2 className="mt-2 text-2xl">{run.found ? `REACHED IN ${run.hops}` : "DID NOT REACH"}</h2>
              <ul className="mt-4 max-h-48 space-y-1 overflow-auto">
                {run.path.map((hop, i) => (
                  <li key={`${hop.rootId}-${i}`}>
                    <Link href={`/neuron/${hop.rootId}`} className="flex justify-between gap-4 border-b border-[var(--line)] py-1.5 text-sm">
                      <span>
                        <span className="font-mono text-[10px] text-[var(--muted)]">{i === 0 ? "START" : `HOP ${i}`}</span>{" "}
                        {hop.cellType ?? hop.rootId}
                      </span>
                      <span className="font-mono text-xs text-[var(--accent)]">
                        {hop.synapsesFromPrev != null ? `${hop.synapsesFromPrev} syn` : hop.rootId}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-5 grid grid-cols-2 gap-4 font-mono text-sm">
                <div>
                  <div className="label">SHORTEST KNOWN</div>
                  <div>{run.shortest ?? "—"}</div>
                </div>
                <div>
                  <div className="label">EDGES REINFORCED</div>
                  <div>{run.learnedEdges}</div>
                </div>
              </div>
              <p className="mt-4 text-xs text-[var(--muted)]">{run.disclaimer}</p>
            </>
          ) : null}

          <p className="mt-4 text-[11px] text-[var(--muted)]">
            Live neuPrint: {probe?.neuron?.instance ?? probe?.neuron?.type ?? (probe?.ok ? "up" : "not answering")}.
          </p>
        </div>
      </div>
    </main>
  );
}

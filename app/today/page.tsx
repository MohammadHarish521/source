"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { LabelChip } from "@/components/label-chip";
import type { DailyRun } from "@/lib/fly/daily";

export default function TodayPage() {
  const today = useQuery({
    queryKey: ["today-run"],
    queryFn: () =>
      fetch("/api/today").then((r) => r.json() as Promise<{ run?: DailyRun; probe?: { ok: boolean; neuron: { type: string | null; instance: string | null } | null }; error?: string }>),
  });
  const run = today.data?.run;
  const probe = today.data?.probe;

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <p className="label">TODAY THE FLY RAN</p>
      <h1 className="mt-3 text-5xl">A walk on real wiring.</h1>
      <p className="mt-4 text-[var(--muted)]">
        Official Male CNS connections. Extra path weights are our training layer, labeled as such.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        <LabelChip kind="GRAPH SIMULATION" />
        {run?.neuprint ? <LabelChip kind="DATA" /> : null}
      </div>

      {today.data?.error ? <p className="mt-8 text-[var(--danger)]">{today.data.error}</p> : null}
      {!run && !today.data?.error ? <p className="mt-8 label">Running today’s walk…</p> : null}

      {run ? (
        <section className="panel mt-10 p-6">
          <p className="label">{run.day}</p>
          <h2 className="mt-2 text-3xl">{run.found ? `REACHED IN ${run.hops}` : "DID NOT REACH"}</h2>
          <p className="mt-3 font-mono text-sm">
            {run.start.cellType ?? run.start.rootId}
            <span className="text-[var(--muted)]"> → </span>
            {run.target.cellType ?? run.target.rootId}
          </p>
          <p className="mt-4 text-sm text-[var(--muted)]">{run.disclaimer}</p>
          <ul className="mt-6 space-y-2">
            {run.path.map((hop, i) => (
              <li key={`${hop.rootId}-${i}`}>
                <Link href={`/neuron/${hop.rootId}`} className="flex justify-between gap-4 border-b border-[var(--line)] py-2">
                  <span>
                    <span className="font-mono text-xs text-[var(--muted)]">{i === 0 ? "START" : `HOP ${i}`}</span>{" "}
                    {hop.cellType ?? hop.rootId}
                    {hop.live ? <span className="ml-2 text-[10px] text-[var(--accent)]">LIVE</span> : null}
                  </span>
                  <span className="font-mono text-xs text-[var(--accent)]">
                    {hop.synapsesFromPrev != null ? `${hop.synapsesFromPrev} syn` : hop.rootId}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid grid-cols-2 gap-4 font-mono text-sm">
            <div>
              <div className="label">SHORTEST KNOWN</div>
              <div>{run.shortest ?? "—"}</div>
            </div>
            <div>
              <div className="label">EDGES REINFORCED</div>
              <div>{run.learnedEdges}</div>
            </div>
          </div>
          <p className="mt-6 break-all font-mono text-[10px] text-[var(--muted)]">{run.source}</p>
        </section>
      ) : null}

      {probe?.neuron ? (
        <p className="mt-8 text-sm text-[var(--muted)]">
          Live neuPrint check: {probe.neuron.instance ?? probe.neuron.type ?? "ok"}.
        </p>
      ) : (
        <p className="mt-8 text-sm text-[var(--muted)]">
          Live neuPrint is {probe?.ok ? "up" : "not answering this request"}.
        </p>
      )}
    </main>
  );
}

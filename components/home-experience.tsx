"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BrainScene } from "./brain-scene";
import { DailyFlyScene } from "./daily-fly-scene";
import { LabelChip } from "./label-chip";
import { formatNumber } from "@/lib/utils";
import type { CloudPoint, DatasetInfo, RankedNeuron } from "@/lib/connectome/types";
import type { DailyRun, DailyScene } from "@/lib/fly/daily";

export function HomeExperience() {
  const dataset = useQuery({
    queryKey: ["dataset"],
    queryFn: () => fetch("/api/dataset").then((r) => r.json() as Promise<DatasetInfo>),
    refetchInterval: 4000,
  });
  const today = useQuery({
    queryKey: ["today-run"],
    queryFn: () =>
      fetch("/api/today").then((r) => r.json() as Promise<{ run?: DailyRun; scene?: DailyScene }>),
    enabled: Boolean(dataset.data?.ready.graph),
  });
  const cloud = useQuery({
    queryKey: ["cloud"],
    queryFn: () => fetch("/api/brain/cloud").then((r) => r.json() as Promise<{ points: CloudPoint[] }>),
    enabled: Boolean(dataset.data?.ready.metadata) && !today.data?.scene?.attempt.length,
  });
  const board = useQuery({
    queryKey: ["board", "most-connected"],
    queryFn: () => fetch("/api/leaderboards?kind=most-connected").then((r) => r.json() as Promise<{ rows: RankedNeuron[] }>),
    enabled: Boolean(dataset.data?.ready.graph),
  });
  const activity = useQuery({
    queryKey: ["activity"],
    queryFn: () => fetch("/api/activity").then((r) => r.json() as Promise<{ activity: Array<{ message: string; created_at: number }> }>),
    refetchInterval: 8000,
  });
  const play = useQuery({
    queryKey: ["play"],
    queryFn: () => fetch("/api/play/today").then((r) => r.json()),
    enabled: Boolean(dataset.data?.ready.graph),
  });

  const info = dataset.data;
  const points = cloud.data?.points ?? [];
  const scene = today.data?.scene;
  const run = today.data?.run;

  return (
    <main>
      <section className="relative min-h-[92vh] overflow-hidden">
        <div className="absolute inset-0">
          {scene && (scene.attempt.length || scene.cloud.length) ? (
            <DailyFlyScene scene={scene} compact />
          ) : points.length ? (
            <BrainScene points={points} />
          ) : (
            <div className="grid h-full place-items-center text-[var(--muted)]">
              <p className="label">{info?.ingest.message ?? "Opening the official Male CNS v1.0 snapshot…"}</p>
            </div>
          )}
        </div>
        <div className="relative mx-auto flex min-h-[92vh] max-w-7xl flex-col justify-end px-5 pb-16 pt-24">
          <p className="label mb-4">male cns · v1.0 · june 2026</p>
          <h1 className="max-w-4xl text-5xl leading-[0.9] tracking-tight md:text-7xl">
            THE INTERNET’S
            <br />
            <span className="glow-line text-[var(--accent)]">FLY CNS</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-[var(--paper)]/80">
            Every neuron is real.
            <br />
            Every connection is real.
            <br />
            Find yours.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/today" className="border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 font-medium text-[#070708]">
              WATCH TODAY
            </Link>
            <Link href="/explore" className="border border-[var(--paper)] px-5 py-3">
              ENTER THE BRAIN
            </Link>
            <Link href="/find" className="border border-[var(--line)] px-5 py-3">
              FIND YOUR NEURON
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-16 md:grid-cols-3">
        <Stat label="NEURONS" value={formatNumber(info?.neurons)} note="DATA" />
        <Stat label="CONNECTIONS ≥5 SYN" value={formatNumber(info?.connections)} note="DATA" />
        <Stat label="ONE MAPPED CNS" value="1" note="DATA" />
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 pb-20 md:grid-cols-2">
        <div className="panel p-6">
          <p className="label">TODAY THE FLY RAN</p>
          <h2 className="mt-2 text-3xl">{run?.found ? `Reached in ${run.hops}` : "Walking real wiring"}</h2>
          <p className="mt-3 text-[var(--muted)]">
            {run
              ? `${run.start.cellType ?? run.start.rootId} → ${run.target.cellType ?? run.target.rootId}`
              : "Official connections. Extra weights are labeled training."}
          </p>
          <Link href="/today" className="mt-6 inline-block border border-[var(--accent)] px-4 py-2 text-[var(--accent)]">
            WATCH TODAY
          </Link>
        </div>
        <div className="panel p-6">
          <p className="label">TODAY’S FLY</p>
          <h2 className="mt-2 text-3xl">Six Degrees of Fly</h2>
          <p className="mt-3 text-[var(--muted)]">Same start. Same target. Everyone on earth.</p>
          {play.data?.start ? (
            <p className="mt-6 font-mono text-sm">
              {play.data.start.cellType ?? play.data.start.rootId}
              <span className="text-[var(--muted)]"> → </span>
              {play.data.target.cellType ?? play.data.target.rootId}
            </p>
          ) : (
            <p className="mt-6 label">{play.data?.error ?? "Indexing the official graph…"}</p>
          )}
          <Link href="/play" className="mt-6 inline-block border border-[var(--accent)] px-4 py-2 text-[var(--accent)]">
            PLAY TODAY
          </Link>
        </div>
        <div className="panel p-6">
          <p className="label">STRANGEST NEURONS TODAY</p>
          <h2 className="mt-2 text-3xl">Leaderboards</h2>
          <ul className="mt-6 space-y-2">
            {(board.data?.rows ?? []).slice(0, 6).map((row) => (
              <li key={row.rootId}>
                <Link href={`/neuron/${row.rootId}`} className="flex justify-between gap-4 border-b border-[var(--line)] py-2">
                  <span className="font-mono text-xs">{row.cellType ?? row.rootId}</span>
                  <span className="font-mono text-[var(--accent)]">{formatNumber(row.value)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24">
        <p className="label">LIVE DISCOVERIES</p>
        <div className="mt-4 space-y-2">
          {(activity.data?.activity ?? []).length === 0 ? (
            <p className="text-[var(--muted)]">No user activity yet. The stream only shows real actions.</p>
          ) : (
            activity.data?.activity.map((item, i) => (
              <p key={i} className="border-b border-[var(--line)] py-2 text-sm">
                {item.message}
              </p>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: "DATA" }) {
  return (
    <div className="panel p-5">
      <LabelChip kind={note} />
      <div className="mt-4 font-mono text-4xl text-[var(--accent)]">{value}</div>
      <div className="label mt-2">{label}</div>
    </div>
  );
}

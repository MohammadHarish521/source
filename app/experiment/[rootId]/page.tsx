"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, useState } from "react";
import { LabelChip } from "@/components/label-chip";
import { formatNumber, shortId } from "@/lib/utils";

export default function ExperimentPage({ params }: { params: Promise<{ rootId: string }> }) {
  const { rootId } = use(params);
  const [removed, setRemoved] = useState(false);
  const q = useQuery({
    queryKey: ["exp", rootId],
    queryFn: () => fetch(`/api/neuron/${rootId}/experiment`).then((r) => r.json()),
    enabled: removed,
  });
  const partners = useQuery({
    queryKey: ["partners", rootId],
    queryFn: () => fetch(`/api/neuron/${rootId}/partners`).then((r) => r.json()),
  });
  const e = q.data;
  const affected = [...(partners.data?.downstream ?? []), ...(partners.data?.upstream ?? [])].slice(0, 18);

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <LabelChip kind="GRAPH SIMULATION" />
      <h1 className="mt-4 text-5xl">What if this neuron disappeared?</h1>
      <p className="mt-6 max-w-2xl text-[var(--muted)]">
        This models connectivity changes in the graph. It does not predict what would biologically happen to the fly.
      </p>
      <p className="label mt-4">{rootId}</p>

      {!removed ? (
        <button
          className="mt-10 border border-[var(--danger)] px-6 py-3 text-[var(--danger)]"
          onClick={() => setRemoved(true)}
        >
          REMOVE FROM SIMULATION
        </button>
      ) : (
        <div className="mt-10 space-y-8">
          <p className="label text-[var(--danger)]">NODE REMOVED · GRAPH ONLY</p>
          <p className="text-[var(--muted)]">{e?.disclaimer}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Compare label="PARTNERS REMOVED" before={e?.originalPartners} after={0} />
            <Compare label="AFFECTED REACHABLE" before={0} after={e?.affectedReachable} invert />
            <Compare label="COMPONENTS" before={e?.componentsBefore} after={e?.componentsAfter} />
            <Box label="LOCAL SAMPLE" value={formatNumber(e?.sampleSize)} />
          </div>
          <section>
            <p className="label">EDGES THAT WOULD LOSE THIS NODE</p>
            <ul className="mt-4 space-y-2">
              {affected.map((p: { rootId: string; cellType: string | null; synapses: number; direction: string }) => (
                <li key={`${p.rootId}-${p.direction}`}>
                  <Link href={`/neuron/${p.rootId}`} className="flex justify-between border-b border-[var(--line)] py-2">
                    <span>
                      {p.cellType ?? shortId(p.rootId)} <span className="label">{p.direction}</span>
                    </span>
                    <span className="font-mono text-[var(--accent)]">{p.synapses}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}

function Compare({
  label,
  before,
  after,
  invert,
}: {
  label: string;
  before?: number;
  after?: number;
  invert?: boolean;
}) {
  const a = before ?? 0;
  const b = after ?? 0;
  const max = Math.max(1, a, b);
  return (
    <div className="panel p-5">
      <p className="label">{label}</p>
      <p className="mt-3 font-mono text-3xl text-[var(--accent)]">
        {formatNumber(before)} → {formatNumber(after)}
      </p>
      <div className="mt-4 space-y-2">
        <Bar width={(a / max) * 100} color="var(--muted)" />
        <Bar width={(b / max) * 100} color={invert ? "var(--danger)" : "var(--accent)"} />
      </div>
    </div>
  );
}

function Bar({ width, color }: { width: number; color: string }) {
  return (
    <div className="h-px bg-[var(--line)]">
      <div className="h-px" style={{ width: `${Math.max(4, width)}%`, background: color }} />
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-5">
      <p className="label">{label}</p>
      <p className="mt-3 font-mono text-4xl text-[var(--accent)]">{value}</p>
    </div>
  );
}

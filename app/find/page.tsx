"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { LabelChip } from "@/components/label-chip";
import { NeuronViewer } from "@/components/neuron-viewer";
import { ShareCard } from "@/components/share-card";
import { findShareText } from "@/lib/share";
import { formatNumber } from "@/lib/utils";

export default function FindPage() {
  const existing = useQuery({
    queryKey: ["find"],
    queryFn: () => fetch("/api/find").then((r) => r.json()),
  });
  const assign = useMutation({
    mutationFn: () => fetch("/api/find", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => existing.refetch(),
  });
  const neuron = existing.data?.neuron ?? assign.data?.neuron;
  const archetype = existing.data?.archetype ?? assign.data?.archetype;
  const morph = useQuery({
    queryKey: ["morph", neuron?.rootId],
    queryFn: () => fetch(`/api/neuron/${neuron.rootId}/morphology`).then((r) => r.json()),
    enabled: Boolean(neuron?.rootId),
  });

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-2">
      <div>
        <p className="label">FIND YOUR NEURON</p>
        <h1 className="mt-3 text-5xl">This one is yours.</h1>
        <p className="mt-4 max-w-md text-[var(--muted)]">
          Assignment is deterministic from your visitor id. Refreshing does not reroll it.
        </p>
        {!neuron ? (
          <button
            className="mt-8 border border-[var(--accent)] bg-[var(--accent)] px-6 py-3 font-medium text-white"
            onClick={() => assign.mutate()}
          >
            FIND YOUR NEURON
          </button>
        ) : (
          <div className="mt-8 space-y-5">
            <LabelChip kind="INTERNET ARCHETYPE">{archetype?.title}</LabelChip>
            <p className="font-mono text-sm">{neuron.rootId}</p>
            <p>
              {neuron.cellType ?? "No consolidated cell type"} · {neuron.superClass} · {neuron.side}
            </p>
            <p className="font-mono">{formatNumber(neuron.partnerCount)} partners</p>
            <p className="text-sm text-[var(--muted)]">{archetype?.reason}</p>
            <ShareCard
              kicker="YOUR NEURON"
              title={archetype?.title ?? "THE CITIZEN"}
              text={findShareText({
                rootId: neuron.rootId,
                archetype: archetype?.title,
                cellType: neuron.cellType,
                partners: neuron.partnerCount,
              })}
              body={
                <div>
                  <p className="font-mono text-xs text-[var(--muted)]">#{neuron.rootId}</p>
                  <p className="mt-3">{neuron.cellType ?? "Unnamed"}</p>
                  <p className="mt-1 font-mono text-[var(--accent)]">
                    {formatNumber(neuron.partnerCount)} partners
                  </p>
                </div>
              }
            />
            <Link href={`/neuron/${neuron.rootId}`} className="inline-block border border-[var(--paper)] px-4 py-2">
              OPEN PROFILE
            </Link>
          </div>
        )}
      </div>
      <div className="panel min-h-[60vh]">
        <NeuronViewer morph={morph.data?.segments ? morph.data : null} />
      </div>
    </main>
  );
}

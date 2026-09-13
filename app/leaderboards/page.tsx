"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { LabelChip } from "@/components/label-chip";
import { formatNumber, shortId } from "@/lib/utils";
import type { LeaderboardKind } from "@/lib/connectome/types";

const BOARDS: Array<[LeaderboardKind, string]> = [
  ["most-connected", "Most Connected"],
  ["most-inputs", "Most Inputs"],
  ["most-outputs", "Most Outputs"],
  ["biggest-broadcasters", "Biggest Broadcasters"],
  ["biggest-listeners", "Biggest Listeners"],
  ["most-isolated", "Most Isolated"],
  ["largest", "Largest skeletons fetched"],
  ["bridge", "Bridge / hub proxy"],
];

export default function LeaderboardsPage() {
  const [kind, setKind] = useState<LeaderboardKind>("most-connected");
  const board = useQuery({
    queryKey: ["board", kind],
    queryFn: () => fetch(`/api/leaderboards?kind=${kind}`).then((r) => r.json()),
  });

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <p className="label">BRAIN LEADERBOARDS</p>
      <h1 className="mt-3 text-5xl">Ranked from the real graph.</h1>
      <div className="mt-4">
        <LabelChip kind="DERIVED METRIC" />
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        {BOARDS.map(([k, label]) => (
          <button key={k} onClick={() => setKind(k)} className={`label border px-3 py-2 ${kind === k ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--line)]"}`}>
            {label}
          </button>
        ))}
      </div>
      <ol className="mt-8 space-y-2">
        {(board.data?.rows ?? []).map((row: { rank: number; rootId: string; cellType: string | null; value: number; valueLabel: string }) => (
          <li key={row.rootId}>
            <Link href={`/neuron/${row.rootId}`} className="flex items-center justify-between border-b border-[var(--line)] py-3">
              <span className="font-mono text-[var(--muted)]">{String(row.rank).padStart(2, "0")}</span>
              <span className="flex-1 px-4">{row.cellType ?? shortId(row.rootId)}</span>
              <span className="font-mono text-[var(--accent)]">{row.valueLabel ?? formatNumber(row.value)}</span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}

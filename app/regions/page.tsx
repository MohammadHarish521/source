"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { LabelChip } from "@/components/label-chip";
import { formatNumber } from "@/lib/utils";

export default function RegionsPage() {
  const q = useQuery({
    queryKey: ["regions"],
    queryFn: () => fetch("/api/regions").then((r) => r.json()),
  });
  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <p className="label">BRAIN NEIGHBORHOODS</p>
      <h1 className="mt-3 text-5xl">Communities from the ontology.</h1>
      <p className="mt-4 max-w-xl text-[var(--muted)]">
        Scientific labels come from official annotations. The one-line identities are ours.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {(q.data?.regions ?? []).map((r: { slug: string; name: string; scientificName: string; playful: string; neuronCount: number; field: string }) => (
          <Link key={r.slug} href={`/region/${r.slug}`} className="panel block p-5">
            <LabelChip kind="DATA">{r.field}</LabelChip>
            <h2 className="mt-4 text-2xl">{r.name}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{r.scientificName}</p>
            <p className="mt-4">{r.playful}</p>
            <p className="label mt-4">{formatNumber(r.neuronCount)} neurons</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

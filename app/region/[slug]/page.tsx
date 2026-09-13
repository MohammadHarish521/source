"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";
import { LabelChip } from "@/components/label-chip";
import { formatNumber, shortId } from "@/lib/utils";

export default function RegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const q = useQuery({
    queryKey: ["region", slug],
    queryFn: () => fetch(`/api/regions/${slug}`).then((r) => r.json()),
  });
  const favorite = useMutation({
    mutationFn: () =>
      fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favoriteRegion: slug }),
      }),
  });
  const region = q.data?.region;
  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <p className="label">NEIGHBORHOOD</p>
      <h1 className="mt-3 text-5xl">{region?.name ?? slug}</h1>
      <p className="mt-3 text-[var(--muted)]">{region?.scientificName}</p>
      <p className="mt-6">{region?.playful}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <LabelChip kind="DATA" />
        <LabelChip kind="INTERNET ARCHETYPE">playful copy</LabelChip>
        <button className="label border border-[var(--line)] px-3 py-1" onClick={() => favorite.mutate()}>
          {favorite.isSuccess ? "FAVORITED" : "SET AS FAVORITE"}
        </button>
      </div>
      <p className="label mt-8">{formatNumber(region?.neuronCount)} neurons in this official slice</p>
      {(q.data?.claimed ?? []).length ? (
        <section className="mt-10">
          <p className="label">CLAIMED HERE</p>
          <ul className="mt-4 space-y-2">
            {(q.data.claimed as Array<{ root_id: string; handle: string; claim_number: number }>).map((c) => (
              <li key={c.root_id}>
                <Link href={`/neuron/${c.root_id}`} className="flex justify-between border-b border-[var(--line)] py-2">
                  <span>
                    #{c.claim_number} · {shortId(c.root_id)}
                  </span>
                  <span className="label">{c.handle}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ol className="mt-8 space-y-2">
        {(q.data?.neurons ?? []).map((n: { root_id: string; cell_type: string | null; partner_count: number }) => (
          <li key={n.root_id}>
            <Link href={`/neuron/${n.root_id}`} className="flex justify-between border-b border-[var(--line)] py-2">
              <span>{n.cell_type ?? shortId(n.root_id)}</span>
              <span className="font-mono text-[var(--accent)]">{formatNumber(n.partner_count)}</span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}

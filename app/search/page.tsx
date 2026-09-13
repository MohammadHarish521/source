"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { formatNumber, shortId } from "@/lib/utils";

function SearchInner() {
  const router = useRouter();
  const initial = useSearchParams().get("q") ?? "";
  const [q, setQ] = useState(initial);
  const results = useQuery({
    queryKey: ["search", initial],
    queryFn: () => fetch(`/api/search?q=${encodeURIComponent(initial)}`).then((r) => r.json()),
    enabled: Boolean(initial),
  });

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="label">SEARCH</p>
      <h1 className="mt-3 text-4xl">Find a real cell.</h1>
      <form
        className="mt-8 border border-[var(--line)]"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="root id / type / region / archetype"
          className="w-full bg-transparent px-4 py-3 font-mono outline-none"
        />
      </form>
      {!initial ? (
        <p className="mt-8 text-[var(--muted)]">Try a root ID, Kenyon, optic, GABA, or THE MAYOR.</p>
      ) : null}
      <ul className="mt-8 space-y-2">
        {(results.data?.results ?? []).map(
          (hit: { rootId: string; cellType: string | null; superClass: string | null; partnerCount: number | null }) => (
            <li key={hit.rootId}>
              <Link href={`/neuron/${hit.rootId}`} className="block border-b border-[var(--line)] py-3">
                <div>{hit.cellType ?? shortId(hit.rootId)}</div>
                <div className="label">
                  {hit.superClass} · {formatNumber(hit.partnerCount)} partners
                </div>
              </Link>
            </li>
          ),
        )}
      </ul>
      {initial && results.isFetched && !(results.data?.results ?? []).length ? (
        <p className="mt-8 text-[var(--muted)]">Nothing in the official index matched that query.</p>
      ) : null}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}

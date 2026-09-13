"use client";

import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { LabelChip } from "@/components/label-chip";
import { formatNumber, shortId } from "@/lib/utils";

export default function CollectionPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => fetch("/api/me").then((r) => r.json()) });
  const [handle, setHandle] = useState("");
  const save = useMutation({
    mutationFn: () =>
      fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      }),
    onSuccess: () => me.refetch(),
  });
  const claimed = (me.data?.claimed ?? []) as Array<{ root_id: string; claim_number: number; created_at: number }>;
  const details = useQueries({
    queries: claimed.map((c) => ({
      queryKey: ["neuron", c.root_id],
      queryFn: () => fetch(`/api/neuron/${c.root_id}`).then((r) => r.json()),
    })),
  });
  const user = me.data?.user;
  const mine = me.data?.neuron;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="label">COLLECTION</p>
      <h1 className="mt-3 text-5xl">{user?.handle ?? "Traveler"}</h1>
      <p className="mt-3 text-[var(--muted)]">
        Credits {formatNumber(user?.credits)} · profile slots, not scientific ownership.
      </p>
      <div className="mt-4 flex flex-wrap gap-4 label">
        <span>STREAK {formatNumber(user?.streak)}</span>
        <span>BEST {user?.best_six_degrees ?? "—"}</span>
        <span>FOUND {formatNumber(user?.neurons_discovered)}</span>
        <span>TRAVERSED {formatNumber(user?.connections_explored)}</span>
      </div>

      <form
        className="mt-8 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="set a public handle"
          className="flex-1 border border-[var(--line)] bg-transparent px-3 py-2 font-mono text-sm outline-none"
        />
        <button className="border border-[var(--paper)] px-4 py-2 label">SAVE</button>
      </form>
      {user?.id ? (
        <Link href={`/profile/${user.handle ?? user.id}`} className="mt-3 inline-block label text-[var(--accent)]">
          OPEN PUBLIC PROFILE
        </Link>
      ) : null}

      {mine ? (
        <Link href={`/neuron/${mine.rootId}`} className="panel mt-10 block p-5">
          <LabelChip kind="USER">your neuron</LabelChip>
          <p className="mt-3 text-2xl">{mine.cellType ?? shortId(mine.rootId)}</p>
          <p className="font-mono text-xs text-[var(--muted)]">{mine.rootId}</p>
        </Link>
      ) : (
        <Link href="/find" className="mt-10 inline-block border border-[var(--accent)] px-4 py-2 text-[var(--accent)]">
          FIND YOUR NEURON
        </Link>
      )}

      <h2 className="mt-12 text-2xl">Claimed slots</h2>
      <ul className="mt-4 space-y-2">
        {claimed.map((c, i) => {
          const neuron = details[i]?.data?.neuron;
          return (
            <li key={c.root_id}>
              <Link href={`/neuron/${c.root_id}`} className="flex justify-between border-b border-[var(--line)] py-3">
                <span>
                  #{c.claim_number} · {neuron?.cellType ?? shortId(c.root_id)}
                </span>
                <span className="label">{new Date(c.created_at).toISOString().slice(0, 10)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!claimed.length ? (
        <p className="mt-4 text-[var(--muted)]">No slots claimed yet. Open a neuron and take a profile slot.</p>
      ) : null}
    </main>
  );
}

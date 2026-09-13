"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

export default function ActivityPage() {
  const q = useQuery({
    queryKey: ["activity"],
    queryFn: () =>
      fetch("/api/activity").then((r) => r.json() as Promise<{
        activity: Array<{ message: string; created_at: number; root_id?: string; kind: string }>;
      }>),
    refetchInterval: 8000,
  });
  const items = q.data?.activity ?? [];

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="label">LIVE DISCOVERIES</p>
      <h1 className="mt-3 text-5xl">Only real actions.</h1>
      <p className="mt-4 text-[var(--muted)]">If the stream is quiet, nobody has done anything yet. We do not invent traffic.</p>
      <ul className="mt-10 space-y-3">
        {items.map((item, i) => (
          <li key={`${item.created_at}-${i}`} className="border-b border-[var(--line)] py-3">
            <p>{item.message}</p>
            <p className="label mt-1">
              {item.kind} · {new Date(item.created_at).toLocaleString()}
              {item.root_id ? (
                <>
                  {" · "}
                  <Link href={`/neuron/${item.root_id}`} className="text-[var(--accent)]">
                    open cell
                  </Link>
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
      {!items.length ? <p className="mt-8 text-[var(--muted)]">No user activity yet.</p> : null}
    </main>
  );
}

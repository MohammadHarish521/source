"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BrainScene } from "@/components/brain-scene";
import type { CloudPoint, DatasetInfo } from "@/lib/connectome/types";

export default function ExplorePage() {
  const dataset = useQuery({
    queryKey: ["dataset"],
    queryFn: () => fetch("/api/dataset").then((r) => r.json() as Promise<DatasetInfo>),
    refetchInterval: 4000,
  });
  const cloud = useQuery({
    queryKey: ["cloud"],
    queryFn: () => fetch("/api/brain/cloud").then((r) => r.json() as Promise<{ points: CloudPoint[] }>),
    enabled: Boolean(dataset.data?.ready.metadata),
  });

  return (
    <main className="relative min-h-[calc(100vh-64px)]">
      <div className="absolute inset-0">
        {cloud.data?.points?.length ? (
          <BrainScene points={cloud.data.points} />
        ) : (
          <div className="grid h-full place-items-center">
            <p className="label">{dataset.data?.ingest.message ?? "Loading official coordinates…"}</p>
          </div>
        )}
      </div>
      <div className="relative z-10 mx-auto max-w-7xl px-5 py-6">
        <div className="panel max-w-md p-5">
          <p className="label">ENTER THE CNS</p>
          <h1 className="mt-2 text-3xl">Click a real soma.</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Each point is an official Male CNS v1.0 soma coordinate. Morphology loads when you open a cell.
          </p>
          <Link href="/find" className="mt-4 inline-block text-[var(--accent)]">
            Or receive one →
          </Link>
        </div>
      </div>
    </main>
  );
}

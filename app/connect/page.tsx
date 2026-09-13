"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { HopRail } from "@/components/hop-rail";
import { NeuronTypeahead } from "@/components/neuron-typeahead";
import { ShareCard } from "@/components/share-card";
import { pathShareText } from "@/lib/share";
import { shortId } from "@/lib/utils";

function ConnectInner() {
  const params = useSearchParams();
  const [a, setA] = useState(params.get("a") ?? "");
  const [b, setB] = useState(params.get("b") ?? "");
  const [go, setGo] = useState(Boolean(params.get("a") && params.get("b")));
  const path = useQuery({
    queryKey: ["path", a, b],
    queryFn: () => fetch(`/api/path?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`).then((r) => r.json()),
    enabled: go && Boolean(a && b),
  });

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="label">CONNECTION MAP</p>
      <h1 className="mt-3 text-5xl">How are these neurons connected?</h1>
      <p className="mt-4 text-[var(--muted)]">
        Shortest recorded path at the official 5+ synapse threshold. Intermediate cells are clickable.
      </p>
      <form
        className="mt-8 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setGo(true);
        }}
      >
        <NeuronTypeahead value={a} onChange={setA} placeholder="Start root ID or cell type" />
        <NeuronTypeahead value={b} onChange={setB} placeholder="Target root ID or cell type" />
        <button className="border border-[var(--accent)] px-4 py-3 text-[var(--accent)]">TRACE</button>
      </form>
      {path.isFetching ? <p className="mt-8 label">Walking the official graph…</p> : null}
      {path.data?.found ? (
        <div className="mt-10 space-y-8">
          <p className="font-mono text-5xl text-[var(--accent)]">{path.data.hops} HOPS</p>
          <p className="label">min {path.data.minSynapses} synapses on each hop</p>
          <HopRail hops={path.data.path} />
          <ShareCard
            kicker="CONNECTION MAP"
            title={`${path.data.hops} HOPS`}
            text={pathShareText(path.data.hops, shortId(a), shortId(b))}
            body={
              <p className="font-mono text-sm">
                {shortId(a)} → {shortId(b)}
              </p>
            }
          />
        </div>
      ) : path.data && !path.data.found ? (
        <p className="mt-8">No path within 8 hops at the 5+ synapse threshold.</p>
      ) : null}
    </main>
  );
}

export default function ConnectPage() {
  return (
    <Suspense>
      <ConnectInner />
    </Suspense>
  );
}

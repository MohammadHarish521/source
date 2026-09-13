"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LabelChip } from "./label-chip";
import { NeuronViewer } from "./neuron-viewer";
import { ShareCard } from "./share-card";
import { SynapseBars } from "./synapse-bars";
import { regionHref } from "@/lib/region-href";
import { neuronShareText } from "@/lib/share";
import { formatNumber, formatUm, shortId } from "@/lib/utils";
import type { Archetype, Morphology, NeuronRecord, Partners } from "@/lib/connectome/types";

export function NeuronExperience({ rootId }: { rootId: string }) {
  const router = useRouter();
  const meta = useQuery({
    queryKey: ["neuron", rootId],
    queryFn: () => fetch(`/api/neuron/${rootId}`).then((r) => r.json()),
  });
  const partners = useQuery({
    queryKey: ["partners", rootId],
    queryFn: () => fetch(`/api/neuron/${rootId}/partners`).then((r) => r.json() as Promise<Partners>),
  });
  const morph = useQuery({
    queryKey: ["morph", rootId],
    queryFn: () =>
      fetch(`/api/neuron/${rootId}/morphology`).then((r) => r.json() as Promise<Morphology & { error?: string }>),
  });
  const live = useQuery({
    queryKey: ["live", rootId],
    queryFn: () => fetch(`/api/neuron/${rootId}/live`).then((r) => r.json()),
  });
  const me = useQuery({ queryKey: ["me"], queryFn: () => fetch("/api/me").then((r) => r.json()) });
  const claim = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not claim.");
      return json;
    },
    onSuccess: () => {
      meta.refetch();
      me.refetch();
    },
  });

  useEffect(() => {
    const from = document.referrer.includes("/neuron/") ? "partner" : undefined;
    void fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootId, from }),
    });
  }, [rootId]);

  const neuron = meta.data?.neuron as NeuronRecord | undefined;
  const archetype = meta.data?.archetype as Archetype | undefined;
  const allPartners = [...(partners.data?.downstream ?? []), ...(partners.data?.upstream ?? [])];
  const annotations = [
    ["HEMIBRAIN TYPE", neuron?.hemibrainType],
    ["CLASS", neuron?.cellClass],
    ["SUBCLASS", neuron?.cellSubClass],
    ["NERVE", neuron?.nerve],
    ["HEMILINEAGE", neuron?.hemilineage],
    ["KNOWN NT", neuron?.knownNt],
    ["DIMORPHISM", neuron?.dimorphism],
    ["FRU / DSX", neuron?.fruDsx],
    ["STATUS", neuron?.status],
    ["SYNONYMS", neuron?.synonyms],
  ].filter(([, value]) => value);

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[1.3fr_0.9fr]">
      <section className="panel scan relative min-h-[70vh] overflow-hidden">
        <NeuronViewer morph={morph.data?.segments ? morph.data : null} partners={allPartners.slice(0, 16)} />
        <div className="pointer-events-none absolute left-4 top-4">
          <p className="label">OFFICIAL MCNS V1.0 SKELETON · NM</p>
        </div>
        {morph.error || morph.data?.error ? (
          <p className="absolute bottom-4 left-4 text-sm text-[var(--danger)]">
            {String(morph.data?.error ?? "Skeleton not available for this root ID.")}
          </p>
        ) : null}
      </section>

      <aside className="space-y-5">
        <div>
          <p className="label">NEURON</p>
          <h1 className="mt-2 text-4xl">{neuron?.cellType ?? "Unnamed cell"}</h1>
          <p className="num mt-2 text-[var(--muted)]">{rootId}</p>
        </div>

        {archetype ? (
          <div className="panel p-4">
            <LabelChip kind="INTERNET ARCHETYPE" />
            <h2 className="mt-3 text-2xl">{archetype.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{archetype.reason}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Fact label="CLASS" value={neuron?.superClass} kind="DATA" />
          <Fact label="SIDE" value={neuron?.side} kind="DATA" />
          <Fact label="FLOW" value={neuron?.flow} kind="DATA" />
          <Fact label="NT (PRED.)" value={neuron?.neurotransmitter} kind="DATA" />
          <Fact
            label="LIVE NEUPRINT PRE"
            value={live.data?.neuron?.pre != null ? formatNumber(live.data.neuron.pre) : live.data?.error ? "—" : "…"}
            kind="DATA"
          />
          <Fact
            label="LIVE NEUPRINT POST"
            value={live.data?.neuron?.post != null ? formatNumber(live.data.neuron.post) : live.data?.error ? "—" : "…"}
            kind="DATA"
          />
          <Fact label="INPUT PARTNERS" value={formatNumber(partners.data?.inputPartners ?? neuron?.inputPartners)} kind="DERIVED METRIC" />
          <Fact label="OUTPUT PARTNERS" value={formatNumber(partners.data?.outputPartners ?? neuron?.outputPartners)} kind="DERIVED METRIC" />
          <Fact label="CABLE" value={formatUm(morph.data?.cableLengthNm ?? neuron?.cableLengthNm)} kind="DATA" />
          <Fact label="REGION" value={neuron?.region} kind="DATA" />
        </div>

        {annotations.length ? (
          <div className="panel p-4">
            <p className="label">ANNOTATIONS · DATA</p>
            <ul className="mt-3 space-y-2">
              {annotations.map(([label, value]) => (
                <li key={label} className="flex justify-between gap-4 text-sm">
                  <span className="label">{label}</span>
                  <span className="font-mono text-right">{value}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {meta.data?.claim ? (
          <div className="panel p-4">
            <LabelChip kind="USER" />
            <p className="mt-2">CLAIMED BY {meta.data.claim.handle}</p>
            <p className="label mt-1">
              #{meta.data.claim.claimNumber}
              {meta.data.claim.claimedAt
                ? ` · ${new Date(meta.data.claim.claimedAt).toISOString().slice(0, 10)}`
                : ""}
            </p>
          </div>
        ) : (
          <div>
            <button className="border border-[var(--paper)] px-4 py-2" onClick={() => claim.mutate()}>
              CLAIM PROFILE SLOT
            </button>
            <p className="mt-2 label">credits left {formatNumber(me.data?.user?.credits)} · not scientific ownership</p>
            {claim.error ? <p className="mt-2 text-sm text-[var(--danger)]">{claim.error.message}</p> : null}
          </div>
        )}

        <SynapseBars partners={allPartners} />

        <div>
          <p className="label mb-2">STRONGEST DOWNSTREAM</p>
          {(partners.data?.downstream ?? []).slice(0, 8).map((p) => (
            <Link key={p.rootId} href={`/neuron/${p.rootId}`} className="flex justify-between border-b border-[var(--line)] py-2 text-sm">
              <span>{p.cellType ?? shortId(p.rootId)}</span>
              <span className="font-mono text-[var(--accent)]">{p.synapses}</span>
            </Link>
          ))}
          <p className="label mb-2 mt-5">STRONGEST UPSTREAM</p>
          {(partners.data?.upstream ?? []).slice(0, 8).map((p) => (
            <Link key={p.rootId} href={`/neuron/${p.rootId}`} className="flex justify-between border-b border-[var(--line)] py-2 text-sm">
              <span>{p.cellType ?? shortId(p.rootId)}</span>
              <span className="font-mono text-[var(--accent)]">{p.synapses}</span>
            </Link>
          ))}
        </div>

        {neuron && archetype ? (
          <ShareCard
            kicker="NEURON"
            title={archetype.title}
            text={neuronShareText({ rootId, cellType: neuron.cellType, archetype: archetype.title })}
            body={
              <div>
                <p>{neuron.cellType ?? "Unnamed"}</p>
                <p className="mt-2 font-mono text-xs text-[var(--muted)]">#{rootId}</p>
              </div>
            }
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Nav href={partners.data?.downstream?.[0]?.rootId ? `/neuron/${partners.data.downstream[0].rootId}` : undefined} label="STRONGEST CONNECTION" />
          <button
            className="label border border-[var(--line)] px-3 py-2"
            onClick={() => {
              if (allPartners[0]) router.push(`/neuron/${allPartners[Math.floor(Math.random() * allPartners.length)].rootId}`);
            }}
          >
            RANDOM CONNECTED
          </button>
          <Nav href={regionHref(neuron ?? {})} label="VISIT REGION" />
          <Nav href={`/connect?a=${rootId}`} label="FIND PATH" />
          <Nav href={`/experiment/${rootId}`} label="WHAT IF IT DISAPPEARED" />
          <Nav href="/play" label="CHALLENGE ME" />
          <Nav href="/explore" label="RANDOM NEURON" />
        </div>
      </aside>
    </main>
  );
}

function Fact({
  label,
  value,
  kind,
}: {
  label: string;
  value?: string | null;
  kind: "DATA" | "DERIVED METRIC";
}) {
  return (
    <div className="panel p-3">
      <p className="label">{kind}</p>
      <p className="label mt-2">{label}</p>
      <p className="mt-1 font-mono text-sm">{value ?? "—"}</p>
    </div>
  );
}

function Nav({ href, label }: { href?: string; label: string }) {
  if (!href) return null;
  return (
    <Link href={href} className="label border border-[var(--line)] px-3 py-2">
      {label}
    </Link>
  );
}

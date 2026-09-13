import { DATASET, MIN_SYNAPSES, REMOTE } from "@/lib/connectome/sources";
import { LabelChip } from "@/components/label-chip";

export default function DataPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <p className="label">ABOUT THE DATA</p>
      <h1 className="mt-3 text-5xl">Nothing here is invented.</h1>
      <p className="mt-6 text-lg text-[var(--muted)]">
        FLY reads the public Male CNS v1.0 release — the complete adult male Drosophila
        central nervous system, brain plus ventral nerve cord. We do not generate neurons,
        synapses, or classifications.
      </p>

      <section className="mt-12 space-y-6">
        <Block title="Release" body={`${DATASET.name} · ${DATASET.animal}, ${DATASET.sex} ${DATASET.structure}.`} />
        <Block
          title="Metadata"
          body="Official v1.0 body-annotations Feather from gs://flyem-male-cns. FLY indexes neurons with status=Traced (165,122 rows in the public file). The Cell paper reports ~166,700 proofread neurons. Soma coordinates are converted from 8 nm voxels into nanometres."
          href={REMOTE.annotationsFeather}
        />
        <Block
          title="Connectivity"
          body={`Official traced-only connectome weights from the Male CNS v1.0 flat-connectome release. Gameplay treats a directed pair as connected at ${MIN_SYNAPSES}+ synapses. We report the live indexed pair count from that file, not a marketing number.`}
          href={REMOTE.tracedWeights}
        />
        <Block
          title="Morphology"
          body="Official Male CNS SWC skeletons (native 8 nm space), with Neuroglancer precomputed skeletons as fallback. These are released reconstructions, not guessed meshes."
          href={REMOTE.skeletonsSwc}
        />
        <Block
          title="Codex"
          body="Janelia hosts neuPrint, Clio, and the Male CNS project page for this snapshot. FLY reads the public GCS files those tools document, then caches a compact local index."
          href={DATASET.explorers.project}
        />
      </section>

      <section className="mt-12">
        <h2 className="text-2xl">How to read a label</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <LabelChip kind="DATA" />
          <LabelChip kind="DERIVED METRIC" />
          <LabelChip kind="INTERNET ARCHETYPE" />
          <LabelChip kind="GRAPH SIMULATION" />
          <LabelChip kind="USER" />
        </div>
        <p className="mt-4 text-[var(--muted)]">
          Centrality-style titles are internet archetypes computed from the graph. They are not biological importance.
          Removing a node from our graph does not predict what would happen to the fly.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl">Cite the science</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {DATASET.publications.map((p) => (
            <li key={p.doi}>
              <a className="text-[var(--accent)]" href={p.url}>
                {p.authors} ({p.year}). {p.title}.
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Block({ title, body, href }: { title: string; body: string; href?: string }) {
  return (
    <div className="panel p-5">
      <h2 className="text-xl">{title}</h2>
      <p className="mt-2 text-[var(--muted)]">{body}</p>
      {href ? (
        <a href={href} className="mt-3 inline-block break-all font-mono text-xs text-[var(--accent)]">
          {href}
        </a>
      ) : null}
    </div>
  );
}

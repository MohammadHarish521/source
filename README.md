# FLY — The Internet’s Fly CNS

Every neuron is real. Every connection is real. Find yours.

This is a Next.js explorer of the public **Male CNS v1.0** adult Drosophila connectome (June 2026): the complete male central nervous system, brain plus ventral nerve cord. It does not invent neurons, synapses, or classifications.

## Run

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On first boot the server downloads official public files into `.cache/`:

1. Male CNS v1.0 body annotations (~14 MB feather)
2. Neurotransmitter predictions (~41 MB feather)
3. Traced-only connectome weights (~508 MB feather) — compact graph only, not EM imagery
4. Individual neuron SWC skeletons on demand from Janelia GCS

Metadata arrives first, so you can open real neurons and skeletons before the full graph index finishes.

## What is indexed

| Layer | Source | Auth |
| --- | --- | --- |
| Metadata | [body-annotations-male-cns-v1.0](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/body-annotations-male-cns-v1.0-minconf-0.5.feather) (`status=Traced`, 165,122 rows) | none |
| Neurotransmitters | [body-neurotransmitters-male-cns-v1.0](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/body-neurotransmitters-male-cns-v1.0.feather) | none |
| Connectivity | [traced-only connectome weights](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/connectome-weights-male-cns-v1.0-minconf-0.5-traced-only.feather) | none |
| Morphology | [official SWC skeletons](https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/) | none |

The Cell paper reports ~166,700 proofread neurons. FLY indexes the public annotation file’s `Traced` rows and reports that live count.

Gameplay treats a directed pair as connected at **5+ synapses**.

`/today` flies a Three.js model along that day’s walk. Hop coordinates are real somas from Male CNS v1.0. The fly mesh is a model. Extra path weights are labeled **TRAINING**.

## Integrity labels

- **DATA** — fields from the official release
- **DERIVED METRIC** — counts and paths we compute from that graph
- **INTERNET ARCHETYPE** — playful titles, never scientific types
- **GRAPH SIMULATION** — topology only, not biology
- **USER** — claims, profiles, activity

A claimed neuron is a profile slot inside this app. It is not ownership of scientific data or biological material.

## Deploy

`.cache/` is gitignored and holds the SQLite graph plus official feathers (~500 MB+). Serverless hosts without a persistent disk (typical Vercel) will not have that data and cannot finish first-boot ingest in time.

Ship to a host with a volume (Fly.io, Railway, a VPS). Copy `.cache/fly-mcns-v1.db` onto that volume, set `NEUPRINT_TOKEN`, then run `npm run train` once so today’s walk exists before traffic hits `/`.

## Cite

Berg et al., *Cell* (2026). [Male CNS project](https://male-cns.janelia.org/).

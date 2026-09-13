# FLY — The Internet’s Fly CNS

Every neuron is real. Every connection is real. Find yours.

This is a Next.js explorer of the public **Male CNS v1.0** adult Drosophila connectome (June 2026): the complete male central nervous system, brain plus ventral nerve cord. It does not invent neurons, synapses, or classifications.

## Run

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app reads the connectome from **MongoDB Atlas** (free M0 is enough). The 6.2M-edge graph is stored as one gzipped binary, not 6 million documents.

```sh
# one-time, from a machine that still has .cache/fly-mcns-v1.db
# 1. Create a free Atlas cluster, allow 0.0.0.0/0, copy the URI into .env
# 2. Push the local index
npm run push-mongo
npm run train
```

Skeletons still come from Janelia GCS on demand.

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

Vercel (or any serverless host) works. Set `MONGODB_URI` and `NEUPRINT_TOKEN` in the host env. Run `npm run push-mongo` once from this laptop before you deploy. Do not commit `.env`.

## Cite

Berg et al., *Cell* (2026). [Male CNS project](https://male-cns.janelia.org/).

/**
 * Official public sources for Male CNS (MCNS) v1.0, released 2026-06-08.
 * Nothing here is invented. If a remote source is unavailable, the
 * provider must surface the failure instead of substituting fake data.
 */

export const DATASET = {
  id: "mcns-v1.0",
  name: "Male CNS",
  version: "v1.0",
  animal: "Drosophila melanogaster",
  sex: "male",
  structure: "adult central nervous system (brain + ventral nerve cord)",
  materialization: 1,
  released: "2026-06-08",
  publications: [
    {
      title: "Sexual dimorphism in the complete Drosophila male central nervous system connectome",
      authors: "Berg et al.",
      year: 2026,
      doi: "10.1016/j.cell.2026.08.015",
      url: "https://www.cell.com/cell/fulltext/S0092-8674(26)00942-6",
    },
  ],
  explorers: {
    project: "https://male-cns.janelia.org/",
    download: "https://male-cns.janelia.org/download/",
    neuprint: "https://neuprint.janelia.org/?dataset=male-cns:v1.0",
    cellTypes: "https://reiserlab.github.io/celltype-explorer-drosophila-male-cns/",
  },
} as const;

const GCS = "https://storage.googleapis.com/flyem-male-cns/v1.0";

export const REMOTE = {
  annotationsFeather: `${GCS}/connectome-data/flat-connectome/body-annotations-male-cns-v1.0-minconf-0.5.feather`,
  neurotransmittersFeather: `${GCS}/connectome-data/flat-connectome/body-neurotransmitters-male-cns-v1.0.feather`,
  tracedWeights:
    `${GCS}/connectome-data/flat-connectome/connectome-weights-male-cns-v1.0-minconf-0.5-traced-only.feather`,
  skeletonsSwc: `${GCS}/segmentation/skeletons-malecns/skeletons-swc`,
  skeletonsPrecomputed: `${GCS}/segmentation/skeletons-malecns/skeletons-precomputed`,
  bucket: "gs://flyem-male-cns/v1.0/",
  downloadPage: "https://male-cns.janelia.org/download/",
  project: "https://male-cns.janelia.org/",
} as const;

/** Directed pair is treated as connected at 5+ synapses, matching Codex-style gameplay. */
export const MIN_SYNAPSES = 5;

/**
 * Native Male CNS EM voxel size. Official annotations and SWC skeletons
 * are stored in these voxels; FLY converts them to nanometres.
 */
export const VOXEL_NM = { x: 8, y: 8, z: 8 } as const;

export const PUBLIC_STATS = {
  /**
   * status=Traced rows in the official v1.0 body-annotations file
   * (queried 2026-09-13). The Cell paper reports ~166,700 proofread
   * neurons; the public annotation dump’s Traced count is 165,122.
   * After ingest, live counts from the official files win.
   */
  neurons: 165_122,
  connections: null as number | null,
  paperNeurons: 166_700,
  source: "https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/body-annotations-male-cns-v1.0-minconf-0.5.feather",
} as const;

/** Famous, fully traced Giant Fiber / DNp01 — a safe “open a verified cell” target. */
export const FEATURED_NEURON_ID = "10001";

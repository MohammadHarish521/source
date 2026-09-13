export type EvidenceKind =
  | "DATA"
  | "DERIVED METRIC"
  | "INTERNET ARCHETYPE"
  | "GRAPH SIMULATION"
  | "USER";

export type NeuronRecord = {
  rootId: string;
  supervoxelId: string | null;
  cellType: string | null;
  hemibrainType: string | null;
  superClass: string | null;
  cellClass: string | null;
  cellSubClass: string | null;
  superType: string | null;
  flow: string | null;
  side: string | null;
  nerve: string | null;
  hemilineage: string | null;
  hartensteinHemilineage: string | null;
  neurotransmitter: string | null;
  neurotransmitterConfidence: number | null;
  knownNt: string | null;
  knownNtSource: string | null;
  region: string | null;
  vfbId: string | null;
  fbbtId: string | null;
  status: string | null;
  dimorphism: string | null;
  fruDsx: string | null;
  synonyms: string | null;
  soma: [number, number, number] | null;
  position: [number, number, number] | null;
  inputSynapses: number | null;
  outputSynapses: number | null;
  inputPartners: number | null;
  outputPartners: number | null;
  partnerCount: number | null;
  cableLengthNm: number | null;
  skeletonNodes: number | null;
};

export type PartnerEdge = {
  rootId: string;
  direction: "upstream" | "downstream";
  synapses: number;
  cellType: string | null;
  superClass: string | null;
  side: string | null;
};

export type Partners = {
  minSynapses: number;
  upstream: PartnerEdge[];
  downstream: PartnerEdge[];
  inputSynapses: number;
  outputSynapses: number;
  inputPartners: number;
  outputPartners: number;
};

export type MorphologySegment = {
  a: [number, number, number];
  b: [number, number, number];
};

export type Morphology = {
  rootId: string;
  units: "nm";
  nodeCount: number;
  edgeCount: number;
  cableLengthNm: number;
  centroid: [number, number, number];
  bounds: { min: [number, number, number]; max: [number, number, number] };
  segments: MorphologySegment[];
  source: string;
};

export type CloudPoint = {
  rootId: string;
  x: number;
  y: number;
  z: number;
  superClass: string | null;
  cellType: string | null;
};

export type SearchHit = {
  rootId: string;
  cellType: string | null;
  superClass: string | null;
  cellClass: string | null;
  side: string | null;
  flow: string | null;
  partnerCount: number | null;
  score: number;
};

export type PathHop = {
  rootId: string;
  cellType: string | null;
  synapsesFromPrev: number | null;
};

export type PathResult = {
  from: string;
  to: string;
  hops: number;
  found: boolean;
  path: PathHop[];
  minSynapses: number;
};

export type DatasetInfo = {
  id: string;
  name: string;
  materialization: number;
  neurons: number;
  connections: number;
  synapses: number | null;
  minSynapses: number;
  ready: {
    metadata: boolean;
    graph: boolean;
    morphology: boolean;
  };
  ingest: IngestStatus;
  sources: string[];
  live?: {
    neuprint: boolean;
    dataset: string;
  };
};

export type IngestStage =
  | "idle"
  | "metadata"
  | "graph"
  | "stats"
  | "ready"
  | "error";

export type IngestStatus = {
  stage: IngestStage;
  message: string;
  metadataReady: boolean;
  graphReady: boolean;
  neuronCount: number;
  edgeCount: number;
  error: string | null;
  updatedAt: number;
};

export type LeaderboardKind =
  | "most-connected"
  | "most-inputs"
  | "most-outputs"
  | "biggest-broadcasters"
  | "biggest-listeners"
  | "most-isolated"
  | "largest"
  | "bridge";

export type RankedNeuron = {
  rank: number;
  rootId: string;
  cellType: string | null;
  superClass: string | null;
  side: string | null;
  value: number;
  valueLabel: string;
};

export type Archetype = {
  title: string;
  reason: string;
  kind: "INTERNET ARCHETYPE";
  metric: string;
};

export type RegionRecord = {
  slug: string;
  name: string;
  scientificName: string;
  field: string;
  match: { column: keyof NeuronRecord | "superClass" | "cellClass" | "flow" | "region"; value: string };
  playful: string;
  neuronCount: number;
  claimedCount: number;
};

export type GraphExperiment = {
  rootId: string;
  label: "GRAPH SIMULATION";
  disclaimer: string;
  removedNode: string;
  originalPartners: number;
  affectedReachable: number;
  componentsBefore: number;
  componentsAfter: number;
  avgPathDelta: number | null;
  sampleSize: number;
};

export type ConnectomeProvider = {
  getDatasetInfo(): Promise<DatasetInfo>;
  getNeuron(id: string): Promise<NeuronRecord | null>;
  getNeuronPartners(id: string, limit?: number): Promise<Partners>;
  getNeuronMorphology(id: string): Promise<Morphology>;
  searchNeurons(query: string, limit?: number): Promise<SearchHit[]>;
  getRegion(slug: string): Promise<RegionRecord | null>;
  listRegions(): Promise<RegionRecord[]>;
  getShortestPath(a: string, b: string): Promise<PathResult>;
  getBrainCloud(limit?: number): Promise<CloudPoint[]>;
  getLeaderboard(kind: LeaderboardKind, limit?: number): Promise<RankedNeuron[]>;
  getNeuronBySeed(seed: string): Promise<NeuronRecord | null>;
  getRandomConnectedPair(seed: string): Promise<{ start: string; target: string; shortest: number } | null>;
  getNeighbors(id: string): Promise<string[]>;
  runRemovalExperiment(id: string): Promise<GraphExperiment>;
};

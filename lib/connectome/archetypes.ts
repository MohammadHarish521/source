import type { Archetype, NeuronRecord } from "./types";

type Stats = {
  partnerP99: number;
  partnerP95: number;
  partnerP75: number;
  partnerP50: number;
  partnerP10: number;
  outP95: number;
  inP95: number;
};

export function defaultStats(): Stats {
  return {
    partnerP99: 400,
    partnerP95: 180,
    partnerP75: 60,
    partnerP50: 24,
    partnerP10: 4,
    outP95: 90,
    inP95: 90,
  };
}

function pct(value: number, ref: number) {
  if (!ref) return 0;
  return Math.min(99.9, Math.max(0.1, Number(((value / (ref * 1.15)) * 100).toFixed(1))));
}

export function archetypeFor(neuron: NeuronRecord, stats: Stats = defaultStats()): Archetype {
  const partnersKnown = neuron.partnerCount != null;
  const partners = neuron.partnerCount ?? 0;
  const incoming = neuron.inputPartners ?? 0;
  const outgoing = neuron.outputPartners ?? 0;
  const inSyn = neuron.inputSynapses ?? 0;
  const outSyn = neuron.outputSynapses ?? 0;
  const ratio = incoming + outgoing === 0 ? 1 : outgoing / Math.max(1, incoming);
  const cable = neuron.cableLengthNm ?? 0;
  const classes = [neuron.superClass, neuron.cellClass, neuron.region].filter(Boolean);

  if (partnersKnown && partners >= stats.partnerP99) {
    return {
      title: "THE MAYOR",
      kind: "INTERNET ARCHETYPE",
      metric: "unique partners",
      reason: `Connected to more neurons than ${pct(partners, stats.partnerP99)}% of neurons used to compute this ranking.`,
    };
  }
  if (outgoing >= stats.outP95 && ratio >= 2.2) {
    return {
      title: "THE BROADCASTER",
      kind: "INTERNET ARCHETYPE",
      metric: "downstream partners",
      reason: `Sends output to ${outgoing.toLocaleString()} partners, more than twice its incoming partner count.`,
    };
  }
  if (incoming >= stats.inP95 && ratio <= 0.45) {
    return {
      title: "THE LISTENER",
      kind: "INTERNET ARCHETYPE",
      metric: "upstream partners",
      reason: `Receives input from ${incoming.toLocaleString()} partners and has relatively few downstream targets.`,
    };
  }
  if (partnersKnown && partners === 0) {
    return {
      title: "THE SILENT",
      kind: "INTERNET ARCHETYPE",
      metric: "zero partners at threshold",
      reason: "No partners at the 5+ synapse threshold in this graph snapshot.",
    };
  }
  if (partnersKnown && partners > 0 && partners <= stats.partnerP10) {
    return {
      title: "THE HERMIT",
      kind: "INTERNET ARCHETYPE",
      metric: "unique partners",
      reason: `Only ${partners} recorded partner${partners === 1 ? "" : "s"} at the 5+ synapse threshold — a relatively isolated cell in this graph.`,
    };
  }
  if (cable >= 4_000_000) {
    return {
      title: "THE GIANT",
      kind: "INTERNET ARCHETYPE",
      metric: "skeleton cable length",
      reason: `Official skeleton cable length is ${(cable / 1000).toFixed(1)} µm.`,
    };
  }
  if ((neuron.superClass === "optic" || neuron.region === "optic_lobe") && partners >= stats.partnerP75) {
    return {
      title: "THE OPTIC HUB",
      kind: "INTERNET ARCHETYPE",
      metric: "partners in optic annotations",
      reason: `An optic-lobe classified neuron with ${partners.toLocaleString()} graph partners.`,
    };
  }
  if (neuron.region === "mushroom_body" || neuron.cellClass?.toLowerCase().includes("kenyon")) {
    return {
      title: "THE ARCHIVIST",
      kind: "INTERNET ARCHETYPE",
      metric: "mushroom body / Kenyon annotation",
      reason: "This cell sits in the mushroom-body / Kenyon annotation set — a memory-associated community in the official typing.",
    };
  }
  if (neuron.region === "central_complex") {
    return {
      title: "THE NAVIGATOR",
      kind: "INTERNET ARCHETYPE",
      metric: "central complex annotation",
      reason: "Official annotations place this neuron in the central complex, the fly's navigation-related midline structures.",
    };
  }
  if (neuron.flow === "afferent") {
    return {
      title: "THE ARRIVAL",
      kind: "INTERNET ARCHETYPE",
      metric: "flow = afferent",
      reason: "Official flow annotation marks this cell as afferent: information entering the brain.",
    };
  }
  if (neuron.flow === "efferent" || neuron.superClass === "descending") {
    return {
      title: "THE EXIT",
      kind: "INTERNET ARCHETYPE",
      metric: "flow = efferent / descending",
      reason: "Official annotations mark this cell as leaving the brain toward the body.",
    };
  }
  if (partnersKnown && classes.filter(Boolean).length >= 2 && partners >= stats.partnerP75) {
    return {
      title: "THE CONNECTOR",
      kind: "INTERNET ARCHETYPE",
      metric: "multi-label + partner count",
      reason: `Spans official labels (${classes.join(", ")}) and still keeps ${partners.toLocaleString()} partners.`,
    };
  }
  if (partnersKnown && partners >= stats.partnerP95) {
    return {
      title: "THE BRIDGE",
      kind: "INTERNET ARCHETYPE",
      metric: "high partner count",
      reason: `High unique-partner count (${partners.toLocaleString()}). This is a graph-hub proxy, not a computed betweenness score.`,
    };
  }
  if (partnersKnown && inSyn + outSyn >= 4000 && partners <= stats.partnerP50) {
    return {
      title: "THE ENFORCER",
      kind: "INTERNET ARCHETYPE",
      metric: "synapses per partner",
      reason: `Heavy synaptic weight (${(inSyn + outSyn).toLocaleString()} synapses) concentrated on a modest partner set.`,
    };
  }
  if (partnersKnown && partners >= stats.partnerP75 && inSyn + outSyn > 0 && (inSyn + outSyn) / partners <= 8) {
    return {
      title: "THE NETWORKER",
      kind: "INTERNET ARCHETYPE",
      metric: "many weakish partners",
      reason: `Many partners (${partners.toLocaleString()}) with relatively thin average synapse counts.`,
    };
  }
  if (neuron.dimorphism && neuron.dimorphism !== "isomorphic") {
    return {
      title: "THE DIMORPH",
      kind: "INTERNET ARCHETYPE",
      metric: "sex-dimorphism annotation",
      reason: `Official dimorphism annotation: ${neuron.dimorphism}.`,
    };
  }
  if (neuron.fruDsx) {
    return {
      title: "THE MARKED",
      kind: "INTERNET ARCHETYPE",
      metric: "fru / dsx annotation",
      reason: `Carries an official fruitless / doublesex annotation: ${neuron.fruDsx}.`,
    };
  }
  if (!neuron.cellType) {
    return {
      title: "THE UNNAMED",
      kind: "INTERNET ARCHETYPE",
      metric: "missing cell type",
      reason: "This root ID is in the official release but has no consolidated cell type in the annotation dump.",
    };
  }
  if (neuron.neurotransmitter === "GABA") {
    return {
      title: "THE GATE",
      kind: "INTERNET ARCHETYPE",
      metric: "predicted GABA",
      reason: "Predicted neurotransmitter is GABA. Prediction is a model output, not a verified identity.",
    };
  }
  if (neuron.neurotransmitter === "acetylcholine" && outgoing > incoming) {
    return {
      title: "THE SPARK",
      kind: "INTERNET ARCHETYPE",
      metric: "predicted acetylcholine + output bias",
      reason: "Predicted cholinergic and biased toward downstream partners.",
    };
  }
  if (neuron.neurotransmitter === "glutamate") {
    return {
      title: "THE PULSE",
      kind: "INTERNET ARCHETYPE",
      metric: "predicted glutamate",
      reason: "Predicted neurotransmitter is glutamate. Prediction is a model output, not a verified identity.",
    };
  }
  if (neuron.nerve) {
    return {
      title: "THE NERVE",
      kind: "INTERNET ARCHETYPE",
      metric: "nerve annotation",
      reason: `Official nerve annotation: ${neuron.nerve}.`,
    };
  }
  if (neuron.hemilineage) {
    return {
      title: "THE LINEAGE",
      kind: "INTERNET ARCHETYPE",
      metric: "hemilineage annotation",
      reason: `Official hemilineage annotation: ${neuron.hemilineage}.`,
    };
  }
  if (neuron.hemibrainType) {
    return {
      title: "THE MATCHED",
      kind: "INTERNET ARCHETYPE",
      metric: "hemibrain type match",
      reason: `Carries a hemibrain type label: ${neuron.hemibrainType}.`,
    };
  }
  if (neuron.side === "midline" || neuron.side === "center") {
    return {
      title: "THE MIDLINE",
      kind: "INTERNET ARCHETYPE",
      metric: "soma side",
      reason: `Official soma-side annotation is ${neuron.side}.`,
    };
  }
  if (neuron.superClass === "ascending") {
    return {
      title: "THE ASCENDER",
      kind: "INTERNET ARCHETYPE",
      metric: "super class",
      reason: "Official super class marks this cell as ascending.",
    };
  }
  const klass = `${neuron.cellClass ?? ""} ${neuron.cellType ?? ""}`.toLowerCase();
  if (klass.includes("olfact") || klass.includes("antennal")) {
    return {
      title: "THE SCENT",
      kind: "INTERNET ARCHETYPE",
      metric: "olfactory / antennal annotation",
      reason: "Official type or class labels place this cell in olfactory / antennal vocabulary.",
    };
  }
  if (klass.includes("visual") || klass.includes("photoreceptor") || klass.includes("lamina") || klass.includes("medulla")) {
    return {
      title: "THE RETINA",
      kind: "INTERNET ARCHETYPE",
      metric: "visual annotation",
      reason: "Official type or class labels sit in the visual / optic vocabulary.",
    };
  }
  if (klass.includes("clock") || /\b(ln|dn)[0-9]/i.test(neuron.cellType ?? "")) {
    return {
      title: "THE CLOCK",
      kind: "INTERNET ARCHETYPE",
      metric: "clock-associated type string",
      reason: "The official cell-type string matches clock-associated naming used in the annotation dump.",
    };
  }
  if (partnersKnown && partners >= stats.partnerP75 && ratio > 0.75 && ratio < 1.35) {
    return {
      title: "THE SPLITTER",
      kind: "INTERNET ARCHETYPE",
      metric: "balanced in/out + many partners",
      reason: `High partner count (${partners.toLocaleString()}) with roughly even upstream and downstream degree.`,
    };
  }
  if (partnersKnown && cable >= 1_200_000 && cable < 4_000_000 && partners >= stats.partnerP50) {
    return {
      title: "THE WANDERER",
      kind: "INTERNET ARCHETYPE",
      metric: "longish skeleton + typical degree",
      reason: `Skeleton cable length is ${(cable / 1000).toFixed(1)} µm with ${partners.toLocaleString()} partners.`,
    };
  }
  if (inSyn + outSyn > 0 && inSyn + outSyn <= 40) {
    return {
      title: "THE WHISPERER",
      kind: "INTERNET ARCHETYPE",
      metric: "low synaptic weight",
      reason: `Only ${(inSyn + outSyn).toLocaleString()} recorded synapses at the 5+ pair threshold.`,
    };
  }
  if (neuron.knownNt) {
    return {
      title: "THE KNOWN",
      kind: "INTERNET ARCHETYPE",
      metric: "known neurotransmitter",
      reason: `Known transmitter annotation: ${neuron.knownNt}${neuron.knownNtSource ? ` (${neuron.knownNtSource})` : ""}.`,
    };
  }
  if (neuron.side === "left") {
    return {
      title: "THE LEFT HAND",
      kind: "INTERNET ARCHETYPE",
      metric: "soma side",
      reason: "Official soma-side annotation is left.",
    };
  }
  if (neuron.side === "right") {
    return {
      title: "THE RIGHT HAND",
      kind: "INTERNET ARCHETYPE",
      metric: "soma side",
      reason: "Official soma-side annotation is right.",
    };
  }
  return {
    title: "THE CITIZEN",
    kind: "INTERNET ARCHETYPE",
    metric: "typical graph position",
    reason: partnersKnown
      ? `A typical cell in this snapshot: ${partners.toLocaleString()} partners at the 5+ synapse threshold.`
      : "A typical cell in this snapshot. Partner counts are not in the live index yet.",
  };
}

export const ARCHETYPE_TITLES = [
  "THE MAYOR",
  "THE BROADCASTER",
  "THE LISTENER",
  "THE SILENT",
  "THE HERMIT",
  "THE GIANT",
  "THE OPTIC HUB",
  "THE ARCHIVIST",
  "THE NAVIGATOR",
  "THE ARRIVAL",
  "THE EXIT",
  "THE CONNECTOR",
  "THE BRIDGE",
  "THE ENFORCER",
  "THE NETWORKER",
  "THE DIMORPH",
  "THE MARKED",
  "THE UNNAMED",
  "THE GATE",
  "THE SPARK",
  "THE PULSE",
  "THE NERVE",
  "THE LINEAGE",
  "THE MATCHED",
  "THE MIDLINE",
  "THE ASCENDER",
  "THE SCENT",
  "THE RETINA",
  "THE CLOCK",
  "THE SPLITTER",
  "THE WANDERER",
  "THE WHISPERER",
  "THE KNOWN",
  "THE LEFT HAND",
  "THE RIGHT HAND",
  "THE CITIZEN",
];

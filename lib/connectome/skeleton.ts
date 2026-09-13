import { REMOTE, VOXEL_NM } from "./sources";
import type { Morphology, MorphologySegment } from "./types";

function readU32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function readF32(view: DataView, offset: number) {
  return view.getFloat32(offset, true);
}

function finishMorphology(
  rootId: string,
  positions: [number, number, number][],
  links: Array<[number, number]>,
  source: string,
): Morphology {
  const segments: MorphologySegment[] = [];
  let cable = 0;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let min: [number, number, number] = [Infinity, Infinity, Infinity];
  let max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (const [x, y, z] of positions) {
    sx += x;
    sy += y;
    sz += z;
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }

  for (const [ai, bi] of links) {
    const pa = positions[ai];
    const pb = positions[bi];
    if (!pa || !pb) continue;
    const dx = pa[0] - pb[0];
    const dy = pa[1] - pb[1];
    const dz = pa[2] - pb[2];
    cable += Math.hypot(dx, dy, dz);
    segments.push({ a: pa, b: pb });
  }

  const nodeCount = positions.length;
  return {
    rootId,
    units: "nm",
    nodeCount,
    edgeCount: segments.length,
    cableLengthNm: cable,
    centroid: nodeCount ? [sx / nodeCount, sy / nodeCount, sz / nodeCount] : [0, 0, 0],
    bounds: { min, max },
    segments,
    source,
  };
}

/**
 * Decode a Neuroglancer precomputed skeleton (single-id file).
 */
export function parseNeuroglancerSkeleton(buffer: ArrayBuffer, rootId: string): Morphology {
  const view = new DataView(buffer);
  if (buffer.byteLength < 8) {
    throw new Error("Skeleton file is too small to be a Neuroglancer skeleton.");
  }
  const nodeCount = readU32(view, 0);
  const edgeCount = readU32(view, 4);
  if (buffer.byteLength < 8 + nodeCount * 12 + edgeCount * 8) {
    throw new Error(
      `Skeleton byte length ${buffer.byteLength} does not match header nv=${nodeCount} ne=${edgeCount}.`,
    );
  }

  const positions: [number, number, number][] = [];
  let offset = 8;
  for (let i = 0; i < nodeCount; i++) {
    positions.push([readF32(view, offset), readF32(view, offset + 4), readF32(view, offset + 8)]);
    offset += 12;
  }
  const links: Array<[number, number]> = [];
  for (let i = 0; i < edgeCount; i++) {
    links.push([readU32(view, offset), readU32(view, offset + 4)]);
    offset += 8;
  }

  return finishMorphology(rootId, positions, links, `${REMOTE.skeletonsPrecomputed}/${rootId}`);
}

/**
 * Decode an official Male CNS SWC. Coordinates are native 8 nm voxels.
 */
export function parseSwcSkeleton(text: string, rootId: string): Morphology {
  const nodes = new Map<number, { index: number; xyz: [number, number, number]; parent: number }>();
  const positions: [number, number, number][] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 7) continue;
    const id = Number(parts[0]);
    const x = Number(parts[2]) * VOXEL_NM.x;
    const y = Number(parts[3]) * VOXEL_NM.y;
    const z = Number(parts[4]) * VOXEL_NM.z;
    const parent = Number(parts[6]);
    if (!Number.isFinite(id) || !Number.isFinite(x)) continue;
    nodes.set(id, { index: positions.length, xyz: [x, y, z], parent });
    positions.push([x, y, z]);
  }
  if (!positions.length) {
    throw new Error(`SWC for ${rootId} contained no nodes.`);
  }
  const links: Array<[number, number]> = [];
  for (const node of nodes.values()) {
    if (node.parent < 0) continue;
    const parent = nodes.get(node.parent);
    if (!parent) continue;
    links.push([parent.index, node.index]);
  }
  return finishMorphology(rootId, positions, links, `${REMOTE.skeletonsSwc}/${rootId}.swc`);
}

export function downsampleMorphology(morph: Morphology, maxSegments = 14000): Morphology {
  if (morph.segments.length <= maxSegments) return morph;
  const step = Math.ceil(morph.segments.length / maxSegments);
  return {
    ...morph,
    segments: morph.segments.filter((_, i) => i % step === 0),
  };
}

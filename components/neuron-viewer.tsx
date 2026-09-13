"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import type { Morphology, PartnerEdge } from "@/lib/connectome/types";

function Skeleton({ morph, partners }: { morph: Morphology; partners?: PartnerEdge[] }) {
  const { line, ends } = useMemo(() => {
    const c = morph.centroid;
    const scale = 0.001;
    const positions = new Float32Array(morph.segments.length * 6);
    morph.segments.forEach((seg, i) => {
      positions[i * 6] = (seg.a[0] - c[0]) * scale;
      positions[i * 6 + 1] = -(seg.a[1] - c[1]) * scale;
      positions[i * 6 + 2] = (seg.a[2] - c[2]) * scale;
      positions[i * 6 + 3] = (seg.b[0] - c[0]) * scale;
      positions[i * 6 + 4] = -(seg.b[1] - c[1]) * scale;
      positions[i * 6 + 5] = (seg.b[2] - c[2]) * scale;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const partnerPos = new Float32Array((partners?.length ?? 0) * 6);
    partners?.forEach((p, i) => {
      const t = (i / Math.max(1, partners.length - 1)) * Math.PI * 2;
      const r = 28 + Math.min(40, p.synapses / 8);
      partnerPos[i * 6] = 0;
      partnerPos[i * 6 + 1] = 0;
      partnerPos[i * 6 + 2] = 0;
      partnerPos[i * 6 + 3] = Math.cos(t) * r;
      partnerPos[i * 6 + 4] = Math.sin(t) * r * 0.45;
      partnerPos[i * 6 + 5] = Math.sin(t * 1.7) * r * 0.35;
    });
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute("position", new THREE.BufferAttribute(partnerPos, 3));
    return { line: geo, ends: pgeo };
  }, [morph, partners]);

  return (
    <group>
      <lineSegments geometry={line}>
        <lineBasicMaterial color="#b6ff4a" transparent opacity={0.92} />
      </lineSegments>
      {partners?.length ? (
        <lineSegments geometry={ends}>
          <lineBasicMaterial color="#67f0c8" transparent opacity={0.35} />
        </lineSegments>
      ) : null}
    </group>
  );
}

export function NeuronViewer({
  morph,
  partners,
}: {
  morph: Morphology | null;
  partners?: PartnerEdge[];
}) {
  return (
    <Canvas camera={{ position: [0, 0, 90], fov: 42 }} className="h-full w-full">
      <color attach="background" args={["#070708"]} />
      <fog attach="fog" args={["#070708", 70, 180]} />
      {morph ? <Skeleton morph={morph} partners={partners} /> : null}
      <OrbitControls enablePan enableZoom enableRotate />
    </Canvas>
  );
}

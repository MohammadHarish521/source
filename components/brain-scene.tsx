"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CloudPoint } from "@/lib/connectome/types";

const CLASS_COLOR: Record<string, string> = {
  ol_: "#67f0c8",
  optic: "#67f0c8",
  visual: "#67f0c8",
  cb_: "#b6ff4a",
  central: "#b6ff4a",
  mushroom: "#d4ff8a",
  vnc_: "#ffb86b",
  ventral: "#ffb86b",
  sensory: "#f3eee4",
  descending: "#ff6b4a",
  ascending: "#67c8ff",
  motor: "#ff6b4a",
};

function colorFor(superClass: string | null) {
  if (!superClass) return new THREE.Color("#8d887e");
  const key = Object.keys(CLASS_COLOR).find((k) => superClass.toLowerCase().includes(k));
  return new THREE.Color(key ? CLASS_COLOR[key] : "#9aa48c");
}

function Cloud({ points, onPick }: { points: CloudPoint[]; onPick: (id: string) => void }) {
  const { camera, gl, size } = useThree();
  const geom = useMemo(() => {
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const p of points) {
      cx += p.x;
      cy += p.y;
      cz += p.z;
    }
    cx /= points.length || 1;
    cy /= points.length || 1;
    cz /= points.length || 1;
    const scale = 0.001;
    points.forEach((p, i) => {
      positions[i * 3] = (p.x - cx) * scale;
      positions[i * 3 + 1] = -(p.y - cy) * scale;
      positions[i * 3 + 2] = (p.z - cz) * scale;
      const c = colorFor(p.superClass);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [points]);

  const ids = useMemo(() => points.map((p) => p.rootId), [points]);

  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 1.4;
    const onClick = (event: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / size.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / size.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const hits = raycaster.intersectObject(mesh.current as THREE.Object3D);
      if (hits[0]?.index != null) onPick(ids[hits[0].index]);
    };
    gl.domElement.addEventListener("click", onClick);
    return () => gl.domElement.removeEventListener("click", onClick);
  }, [camera, gl, ids, onPick, size]);

  const mesh = useRef<THREE.Points>(null);

  return (
    <points ref={mesh} geometry={geom}>
      <pointsMaterial size={1.15} vertexColors transparent opacity={0.88} sizeAttenuation />
    </points>
  );
}

export function BrainScene({ points }: { points: CloudPoint[] }) {
  const router = useRouter();
  return (
    <Canvas camera={{ position: [0, 0, 220], fov: 45 }} className="h-full w-full">
      <color attach="background" args={["#070708"]} />
      <fog attach="fog" args={["#070708", 180, 420]} />
      {points.length > 0 && <Cloud points={points} onPick={(id) => router.push(`/neuron/${id}`)} />}
      <gridHelper args={[400, 20, "#1b1b1c", "#141416"]} position={[0, -90, 0]} />
      <OrbitControls enablePan enableZoom enableRotate zoomSpeed={0.7} />
    </Canvas>
  );
}

"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { DailyScene, DailySceneNode } from "@/lib/fly/daily";

const SCALE = 0.001;

function originOf(scene: DailyScene) {
  const pts = [...scene.attempt, ...scene.lesson, ...scene.cloud.slice(0, 200)];
  if (!pts.length) return new THREE.Vector3();
  const o = new THREE.Vector3();
  for (const p of pts) o.add(new THREE.Vector3(p.x, p.y, p.z));
  return o.divideScalar(pts.length);
}

function toVec(node: { x: number; y: number; z: number }, origin: THREE.Vector3) {
  return new THREE.Vector3((node.x - origin.x) * SCALE, -(node.y - origin.y) * SCALE, (node.z - origin.z) * SCALE);
}

function Cloud({ points, origin }: { points: DailyScene["cloud"]; origin: THREE.Vector3 }) {
  const geom = useMemo(() => {
    const positions = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      const v = toVec(p, origin);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [origin, points]);

  return (
    <points geometry={geom}>
      <pointsMaterial color="#8d887e" size={0.85} transparent opacity={0.28} sizeAttenuation />
    </points>
  );
}

function PathLine({ points, color, dashed }: { points: THREE.Vector3[]; color: string; dashed?: boolean }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    if (dashed) g.computeLineDistances();
    return g;
  }, [dashed, points]);

  return (
    <line geometry={geom}>
      {dashed ? (
        <lineDashedMaterial color={color} dashSize={2.2} gapSize={1.4} transparent opacity={0.45} />
      ) : (
        <lineBasicMaterial color={color} transparent opacity={0.95} />
      )}
    </line>
  );
}

function HopMarks({
  nodes,
  origin,
  color,
  onPick,
}: {
  nodes: DailySceneNode[];
  origin: THREE.Vector3;
  color: string;
  onPick?: (id: string) => void;
}) {
  return (
    <group>
      {nodes.map((node) => {
        const p = toVec(node, origin);
        return (
          <mesh
            key={node.rootId}
            position={p}
            onClick={(e) => {
              e.stopPropagation();
              onPick?.(node.rootId);
            }}
          >
            <sphereGeometry args={[1.35, 12, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
          </mesh>
        );
      })}
    </group>
  );
}

function FlyMesh() {
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const flap = Math.sin(clock.elapsedTime * 34) * 0.55;
    if (left.current) left.current.rotation.z = 0.4 + flap;
    if (right.current) right.current.rotation.z = -0.4 - flap;
  });

  return (
    <group>
      <mesh position={[0, 0, 0.95]} scale={[0.42, 0.3, 1.05]}>
        <sphereGeometry args={[0.55, 14, 14]} />
        <meshStandardMaterial color="#8d9a78" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <sphereGeometry args={[0.38, 14, 14]} />
        <meshStandardMaterial color="#c8ff5a" emissive="#b6ff4a" emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[0, 0.08, -0.52]}>
        <sphereGeometry args={[0.26, 12, 12]} />
        <meshStandardMaterial color="#f3eee4" roughness={0.28} />
      </mesh>
      <mesh position={[0.16, 0.12, -0.62]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial color="#ff6b4a" emissive="#ff6b4a" emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[-0.16, 0.12, -0.62]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial color="#ff6b4a" emissive="#ff6b4a" emissiveIntensity={0.7} />
      </mesh>
      <mesh ref={left} position={[0.3, 0.22, 0.04]} rotation={[0.18, 0.18, 0.4]}>
        <planeGeometry args={[1.4, 0.42]} />
        <meshStandardMaterial color="#67f0c8" transparent opacity={0.34} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={right} position={[-0.3, 0.22, 0.04]} rotation={[0.18, -0.18, -0.4]}>
        <planeGeometry args={[1.4, 0.42]} />
        <meshStandardMaterial color="#67f0c8" transparent opacity={0.34} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Traveler({ points }: { points: THREE.Vector3[] }) {
  const ref = useRef<THREE.Group>(null);
  const span = Math.max(8, (points.length - 1) * 2.4);

  useFrame(({ clock }) => {
    if (!ref.current || points.length < 2) return;
    const t = (clock.elapsedTime / span) % 1;
    const f = t * (points.length - 1);
    const i = Math.min(points.length - 2, Math.floor(f));
    const frac = f - i;
    const a = points[i];
    const b = points[i + 1];
    ref.current.position.lerpVectors(a, b, frac);
    const look = b.clone().add(b.clone().sub(a));
    ref.current.lookAt(look);
  });

  if (points.length === 1) {
    return (
      <group position={points[0]} scale={3.4}>
        <FlyMesh />
      </group>
    );
  }

  return (
    <group ref={ref} scale={3.4}>
      <FlyMesh />
    </group>
  );
}

function SceneBody({ scene, interactive }: { scene: DailyScene; interactive: boolean }) {
  const router = useRouter();
  const origin = useMemo(() => originOf(scene), [scene]);
  const attempt = useMemo(() => scene.attempt.map((n) => toVec(n, origin)), [origin, scene.attempt]);
  const lesson = useMemo(() => scene.lesson.map((n) => toVec(n, origin)), [origin, scene.lesson]);
  const cam = useMemo(() => {
    const pts = attempt.length ? attempt : lesson;
    if (!pts.length) return { position: [0, 20, 140] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
    const box = new THREE.Box3().setFromPoints(pts);
    const center = box.getCenter(new THREE.Vector3());
    const size = Math.max(28, box.getSize(new THREE.Vector3()).length());
    return {
      position: [center.x, center.y + size * 0.18, center.z + size * 1.15] as [number, number, number],
      target: [center.x, center.y, center.z] as [number, number, number],
    };
  }, [attempt, lesson]);

  return (
    <>
      <color attach="background" args={["#070708"]} />
      <fog attach="fog" args={["#070708", 90, 320]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[50, 70, 40]} intensity={1.5} color="#b6ff4a" />
      <pointLight position={[-40, -10, 30]} intensity={0.7} color="#67f0c8" />
      {scene.cloud.length ? <Cloud points={scene.cloud} origin={origin} /> : null}
      {lesson.length > 1 ? <PathLine points={lesson} color="#67f0c8" dashed /> : null}
      {attempt.length > 1 ? <PathLine points={attempt} color="#b6ff4a" /> : null}
      <HopMarks
        nodes={scene.lesson}
        origin={origin}
        color="#67f0c8"
        onPick={interactive ? (id) => router.push(`/neuron/${id}`) : undefined}
      />
      <HopMarks
        nodes={scene.attempt}
        origin={origin}
        color="#b6ff4a"
        onPick={interactive ? (id) => router.push(`/neuron/${id}`) : undefined}
      />
      {attempt.length ? <Traveler points={attempt} /> : null}
      <OrbitControls enablePan enableZoom enableRotate zoomSpeed={0.7} target={cam.target} />
    </>
  );
}

export function DailyFlyScene({
  scene,
  compact = false,
}: {
  scene: DailyScene;
  compact?: boolean;
}) {
  const hasPath = scene.attempt.length + scene.lesson.length > 0;
  const pts = scene.attempt.length ? scene.attempt : scene.lesson;
  const origin = originOf(scene);
  const boxed = pts.map((n) => toVec(n, origin));
  const box = boxed.length ? new THREE.Box3().setFromPoints(boxed) : null;
  const center = box?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3();
  const size = box ? Math.max(28, box.getSize(new THREE.Vector3()).length()) : 140;
  const cameraPos: [number, number, number] = [center.x, center.y + size * 0.18, center.z + size * 1.15];

  return (
    <Canvas camera={{ position: cameraPos, fov: compact ? 50 : 42 }} className="h-full w-full">
      {hasPath ? <SceneBody scene={scene} interactive={!compact} /> : null}
    </Canvas>
  );
}

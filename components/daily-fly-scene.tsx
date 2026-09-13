"use client";

import { Line } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { DailyScene, DailySceneNode } from "@/lib/fly/daily";

const SCALE = 0.001;

function originOf(scene: DailyScene) {
  const pts = [...scene.attempt, ...scene.lesson];
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
  return (
    <Line
      points={points}
      color={color}
      dashed={Boolean(dashed)}
      dashSize={2.2}
      gapSize={1.4}
      transparent
      opacity={dashed ? 0.45 : 0.95}
      lineWidth={3}
    />
  );
}

function HopMarks({
  nodes,
  origin,
  color,
  radius,
  onPick,
}: {
  nodes: DailySceneNode[];
  origin: THREE.Vector3;
  color: string;
  radius: number;
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
            <sphereGeometry args={[radius, 12, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
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
      <mesh>
        <sphereGeometry args={[2.1, 16, 16]} />
        <meshBasicMaterial color="#b6ff4a" transparent opacity={0.16} depthWrite={false} />
      </mesh>
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

function pathAt(points: THREE.Vector3[], elapsed: number) {
  const span = Math.max(10, (points.length - 1) * 3);
  const t = (elapsed / span) % 1;
  const f = t * Math.max(1, points.length - 1);
  const i = Math.min(Math.max(0, points.length - 2), Math.floor(f));
  const frac = f - i;
  const a = points[i];
  const b = points[Math.min(i + 1, points.length - 1)];
  const pos = new THREE.Vector3().lerpVectors(a, b, frac);
  return { pos, look: b, span };
}

function Traveler({ points, scale }: { points: THREE.Vector3[]; scale: number }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current || points.length < 2) return;
    const { pos, look } = pathAt(points, clock.elapsedTime);
    ref.current.position.copy(pos);
    ref.current.lookAt(look);
  });

  if (points.length === 1) {
    return (
      <group position={points[0]} scale={scale}>
        <pointLight color="#b6ff4a" intensity={2.2} distance={scale * 18} />
        <FlyMesh />
      </group>
    );
  }

  return (
    <group ref={ref} scale={scale}>
      <pointLight color="#b6ff4a" intensity={2.2} distance={scale * 18} />
      <FlyMesh />
    </group>
  );
}

function FollowCam({ points, size }: { points: THREE.Vector3[]; size: number }) {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    if (points.length < 2) return;
    const { pos, look } = pathAt(points, clock.elapsedTime);
    const ahead = look.clone().sub(pos);
    if (ahead.lengthSq() < 0.0001) ahead.set(0, 0, 1);
    ahead.normalize();
    const desired = pos
      .clone()
      .add(ahead.clone().multiplyScalar(-size * 0.42))
      .add(new THREE.Vector3(0, size * 0.22, 0));
    camera.position.lerp(desired, 0.045);
    camera.lookAt(pos);
  });
  return null;
}

function SceneBody({ scene, interactive }: { scene: DailyScene; interactive: boolean }) {
  const router = useRouter();
  const origin = useMemo(() => originOf(scene), [scene]);
  const attempt = useMemo(() => scene.attempt.map((n) => toVec(n, origin)), [origin, scene.attempt]);
  const lesson = useMemo(() => scene.lesson.map((n) => toVec(n, origin)), [origin, scene.lesson]);
  const cam = useMemo(() => {
    const pts = attempt.length ? attempt : lesson;
    if (!pts.length) {
      return {
        position: [0, 20, 140] as [number, number, number],
        target: [0, 0, 0] as [number, number, number],
        size: 140,
        hopR: 2,
        flyScale: 8,
      };
    }
    const box = new THREE.Box3().setFromPoints(pts);
    const center = box.getCenter(new THREE.Vector3());
    const size = Math.max(28, box.getSize(new THREE.Vector3()).length());
    return {
      position: [center.x + size * 0.15, center.y + size * 0.22, center.z + size * 1.05] as [number, number, number],
      target: [center.x, center.y, center.z] as [number, number, number],
      size,
      hopR: size * 0.012,
      flyScale: size * 0.09,
    };
  }, [attempt, lesson]);

  return (
    <>
      <color attach="background" args={["#070708"]} />
      <fog attach="fog" args={["#070708", cam.size * 0.9, cam.size * 3.2]} />
      <ambientLight intensity={0.45} />
      <pointLight position={[cam.target[0] + cam.size * 0.4, cam.target[1] + cam.size * 0.5, cam.target[2] + cam.size * 0.3]} intensity={1.6} color="#b6ff4a" />
      <pointLight position={[cam.target[0] - cam.size * 0.3, cam.target[1], cam.target[2]]} intensity={0.8} color="#67f0c8" />
      {scene.cloud.length ? <Cloud points={scene.cloud} origin={origin} /> : null}
      {lesson.length > 1 ? <PathLine points={lesson} color="#67f0c8" dashed /> : null}
      {attempt.length > 1 ? <PathLine points={attempt} color="#b6ff4a" /> : null}
      <HopMarks
        nodes={scene.lesson}
        origin={origin}
        color="#67f0c8"
        radius={cam.hopR}
        onPick={interactive ? (id) => router.push(`/neuron/${id}`) : undefined}
      />
      <HopMarks
        nodes={scene.attempt}
        origin={origin}
        color="#b6ff4a"
        radius={cam.hopR}
        onPick={interactive ? (id) => router.push(`/neuron/${id}`) : undefined}
      />
      {attempt.length ? <Traveler points={attempt} scale={cam.flyScale} /> : null}
      {attempt.length > 1 ? <FollowCam points={attempt} size={cam.size} /> : null}
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

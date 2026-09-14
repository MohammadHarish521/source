"use client";

import { useEffect, useMemo, useState } from "react";
import { Bounds, Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import Link from "next/link";
import type { DailyRun, DailyScene, DailySceneNode } from "@/lib/fly/daily";
import { FlyMesh } from "./daily-fly-scene";

type Position = [number, number, number];

function BrainView({ scene, run, step, progress, overview }: {
  scene: DailyScene; run: DailyRun; step: number; progress: number; overview: boolean;
}) {
  const model = useMemo(() => {
    const source = scene.cloud.length ? scene.cloud : scene.attempt;
    const box = new THREE.Box3().setFromPoints(source.map(p => new THREE.Vector3(p.x, p.y, p.z)));
    const center = source.length ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    const scale = source.length ? 160 / Math.max(1, box.getSize(new THREE.Vector3()).length()) : 1;
    const position = (p: DailySceneNode): Position => [(p.x-center.x)*scale, -(p.y-center.y)*scale, (p.z-center.z)*scale];
    const nodes = new Map(scene.attempt.map(p => [p.rootId, position(p)]));
    const positions = new Float32Array(scene.cloud.flatMap(p => position(p)));
    return { nodes, positions };
  }, [scene]);
  const from = model.nodes.get(run.path[step]?.rootId);
  const to = model.nodes.get(run.path[step + 1]?.rootId);
  const traveler = from && to ? from.map((v, i) => v + (to[i] - v) * progress) as Position : from;
  return (
    <Canvas camera={{ position: [0, 0, 210], fov: 45 }} dpr={[1, 1.5]}>
      <color attach="background" args={["#f7f8f4"]} />
      <ambientLight intensity={1.8} />
      <directionalLight position={[30, 60, 80]} intensity={2} />
      <Bounds fit clip observe margin={1.3}>
        {overview && model.positions.length > 0 && <points>
          <bufferGeometry><bufferAttribute attach="attributes-position" args={[model.positions, 3]} /></bufferGeometry>
          <pointsMaterial color="#237f91" size={1.6} sizeAttenuation={false} transparent opacity={0.48} />
        </points>}
        {run.path.map((hop, i) => {
          const p = model.nodes.get(hop.rootId);
          const q = model.nodes.get(run.path[i + 1]?.rootId);
          return p ? <group key={`${hop.rootId}-${i}`}>
            {q && <Line points={[p, q]} color={i === step ? "#b75a16" : "#a3b2aa"} lineWidth={i === step ? 3 : 1} />}
            <mesh position={p}><sphereGeometry args={[i === step ? 1.3 : 0.65, 12, 12]} /><meshBasicMaterial color={i === step ? "#b75a16" : "#397519"} /></mesh>
          </group> : null;
        })}
      </Bounds>
      {traveler && (overview ? <mesh position={traveler}>
        <sphereGeometry args={[1.4, 16, 16]} /><meshBasicMaterial color="#b75a16" />
      </mesh> : <group position={traveler} scale={4}><FlyMesh /></group>)}
      <OrbitControls makeDefault enablePan={false} />
    </Canvas>
  );
}

export function TrainingObservatory({ run, scene }: { run: DailyRun; scene: DailyScene }) {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const edges = Math.max(0, run.path.length - 1);
  const duration = edges * 2500;
  useEffect(() => {
    if (!playing || !duration) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(200, now - previous);
      previous = now;
      setElapsed(value => Math.min(duration, value + delta));
    }, 80);
    return () => window.clearInterval(timer);
  }, [playing, duration]);
  const complete = elapsed >= duration;
  const step = edges ? Math.min(edges - 1, Math.floor(elapsed / 2500)) : 0;
  const progress = complete ? 1 : (elapsed % 2500) / 2500;
  const current = run.path[step];
  const next = run.path[step + 1];
  const located = new Set(scene.attempt.map(n => n.rootId));
  const missing = run.path.filter(n => !located.has(n.rootId)).length;
  return <section className="panel overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] p-5">
      <div><p className="label">DAILY LEARNING · {run.day} UTC</p><h2 className="mt-2 text-2xl">One run. Two synchronized views.</h2></div>
      <span className="rounded-full border border-[var(--line)] px-3 py-2 text-xs">Training replay · {complete ? "complete" : playing ? "playing" : "paused"}</span>
    </div>
    <div className="grid lg:grid-cols-2">
      {[false, true].map(overview => <div key={String(overview)} className="min-w-0 border-b border-[var(--line)] lg:first:border-r">
        <div className="px-5 pt-5"><p className="label">{overview ? "RECORDED CNS ANATOMY" : "FLY MARKER · MODEL ROUTE"}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">{overview ? `${scene.cloud.length.toLocaleString()} measured neuron positions. Orange follows the current connection.` : "The fly marks a graph traversal, not physical movement or measured behavior."}</p></div>
        <div className="h-[360px] md:h-[440px]">
          {scene.attempt.length || scene.cloud.length ? <BrainView scene={scene} run={run} step={step} progress={progress} overview={overview} /> : <p className="p-5">No recorded coordinates available.</p>}
        </div>
      </div>)}
    </div>
    <div className="space-y-5 p-5">
      <div className="flex items-center gap-4">
        <button className="border border-[var(--line)] px-4 py-2" disabled={!edges} onClick={() => { if (complete) { setElapsed(0); setPlaying(true); } else setPlaying(!playing); }}>{complete ? "Replay" : playing ? "Pause" : "Play"}</button>
        <input aria-label="Training replay position" className="min-w-0 flex-1 accent-[var(--accent)]" type="range" min={0} max={duration || 1} value={elapsed} disabled={!edges} onChange={event => {setPlaying(false); setElapsed(Number(event.target.value));}} />
        <span className="text-sm">{edges ? `Connection ${step + 1} / ${edges}` : "No traversed connections"}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div><p className="label">{complete ? "FINAL CONNECTION" : "CURRENT CONNECTION"}</p>
          <p className="mt-2 break-words">{current && <Link href={`/neuron/${current.rootId}`}>{current.cellType ?? current.rootId} <small>({current.rootId})</small></Link>} → {next ? <Link href={`/neuron/${next.rootId}`}>{next.cellType ?? next.rootId} <small>({next.rootId})</small></Link> : "No next neuron"}</p>
        </div>
        <div><p className="label">RECORDED SYNAPSES</p><p className="mt-2 text-2xl">{next?.synapsesFromPrev ?? "—"}</p></div>
        <div><p className="label">TRAINING WEIGHTS UPDATED TODAY</p><p className="mt-2 text-2xl">{run.learnedEdges}</p></div>
      </div>
      {missing > 0 && <p className="text-sm text-[var(--danger)]">{missing} route neurons have no recorded position. Their points and adjoining lines are omitted; their IDs remain in the run.</p>}
      <p className="text-sm text-[var(--muted)]">{run.disclaimer} Lines link recorded neuron positions; they do not trace axons. Replay timing is illustrative, not measured firing. No live biological activity is connected.</p>
      <details className="text-sm"><summary className="cursor-pointer">Run result and data source</summary><p className="mt-2">{run.found ? "Target reached" : "Target not reached"} · {run.hops} hops · Shortest path: {run.shortest ?? "unavailable"}. {run.source}</p></details>
    </div>
  </section>;
}

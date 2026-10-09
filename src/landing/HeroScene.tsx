import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Auditorium, FirstFrame, SceneBoundary, type Lighting } from '../scene/Auditorium';

/**
 * Scroll-driven flythrough: from the empty back of the hall, down the aisle as the
 * seats fill, onto the stage and around to the speaker's view behind the lectern.
 */
const keys = [
  { at: 0, pos: [0, 5.3, -10.1], yaw: Math.PI, pitch: -.24 },
  { at: .3, pos: [0, 3.3, -4.4], yaw: Math.PI, pitch: -.12 },
  { at: .56, pos: [0, 2.1, 3.6], yaw: Math.PI, pitch: -.03 },
  { at: .78, pos: [-2.9, 2.5, 7.3], yaw: Math.PI * 1.45, pitch: -.06 },
  { at: 1, pos: [0, 2.65, 9.6], yaw: Math.PI * 2, pitch: -.05 },
] as const;
const curve = new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(...k.pos)), false, 'centripetal');
const ease = (t: number) => t * t * (3 - 2 * t);

function sample(progress: number, out: { pos: THREE.Vector3; yaw: number; pitch: number }) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  let i = 0; while (i < keys.length - 2 && p > keys[i + 1].at) i++;
  const a = keys[i], b = keys[i + 1];
  const local = ease((p - a.at) / (b.at - a.at));
  curve.getPoint((i + local) / (keys.length - 1), out.pos);
  out.yaw = THREE.MathUtils.lerp(a.yaw, b.yaw, local);
  out.pitch = THREE.MathUtils.lerp(a.pitch, b.pitch, local);
}

function ScrollCamera({ progress, reduced }: { progress: MutableRefObject<number>; reduced: boolean }) {
  const { camera, pointer } = useThree();
  const goal = useMemo(() => ({ pos: new THREE.Vector3(), yaw: Math.PI, pitch: 0 }), []);
  const state = useRef({ yaw: Math.PI, pitch: -.24, ready: false });
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    sample(progress.current, goal);
    const s = state.current;
    const k = s.ready && !reduced ? 1 - Math.exp(-delta * 5) : 1;
    camera.position.lerp(goal.pos, k);
    s.yaw += (goal.yaw - s.yaw) * k; s.pitch += (goal.pitch - s.pitch) * k; s.ready = true;
    const sway = reduced ? 0 : pointer.x * .05, tilt = reduced ? 0 : pointer.y * .03;
    const yaw = s.yaw - sway, pitch = s.pitch + tilt;
    look.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).add(camera.position);
    camera.lookAt(look);
  });
  return null;
}

function SceneDirector({ progress, lighting, onCount }: { progress: MutableRefObject<number>; lighting: MutableRefObject<Lighting>; onCount: (n: number) => void }) {
  const last = useRef(-1);
  useFrame(() => {
    const p = progress.current;
    lighting.current.house = THREE.MathUtils.smoothstep(p, .12, .62) * .85 + .05;
    lighting.current.spot = 1;
    // Fill the room row by row (12 seats per row) as the camera walks down the aisle.
    const rows = Math.round(THREE.MathUtils.clamp((p - .1) / .4, 0, 1) * 6);
    if (rows !== last.current) { last.current = rows; onCount(rows * 12); }
  });
  return null;
}

export default function HeroScene({ progress, active, reduced, onReady }: { progress: MutableRefObject<number>; active: boolean; reduced: boolean; onReady?: () => void }) {
  const lighting = useRef<Lighting>({ house: .05, spot: 1 });
  const [count, setCount] = useState(0);
  useEffect(() => { if (reduced) setCount(72); }, [reduced]);
  return <SceneBoundary fallback={<div className="hero-fallback" aria-hidden="true"/>}>
    <Canvas
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 5.3, -10.1], fov: 52, near: .1, far: 70 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      aria-hidden="true"
    >
      <Auditorium count={count} engagement={80} reaction="engaged" question={false} reduced={reduced} lighting={lighting} haze={.55}/>
      <ScrollCamera progress={progress} reduced={reduced}/>
      <FirstFrame onReady={() => onReady?.()}/>
      <SceneDirector progress={progress} lighting={lighting} onCount={n => setCount(reduced ? 72 : n)}/>
    </Canvas>
  </SceneBoundary>;
}

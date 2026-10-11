import { Component, memo, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, SpotLight, createInstances } from '@react-three/drei';
import * as THREE from 'three';
import type { Reaction } from '../lib/analysis';
import { crowd } from './characters';
import { outlineMaterial, personParts, toonMaterial } from './animeGeometry';

/**
 * A procedural, theatre-lit auditorium shared by the landing hero and the studio.
 * Everything is batched into a handful of instanced draw calls; lighting levels are
 * read from a mutable ref so scroll-driven scenes can animate them without re-rendering.
 */
export type Lighting = { house: number; spot: number };
type Vec3 = [number, number, number];


const [BoxInstances, BoxInstance] = createInstances();
const [GlowInstances, GlowInstance] = createInstances();
const litMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .82 });
const glowMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const velvet = new THREE.MeshStandardMaterial({ color: '#5c1d27', roughness: .95 });

type Part = { position: Vec3; scale: Vec3; color: string; rotation?: Vec3 };
const Box = (p: Part) => <BoxInstance {...p}/>;
const Glow = (p: Part) => <GlowInstance {...p}/>;

type Mood = { engagement: number; reaction: Reaction; question: boolean; reduced: boolean };

/** One cel-shaded anime listener. Geometry is generated once per seat and cached. */
function Person({ index, position, engagement, reaction, question, reduced }: Mood & { index: number; position: Vec3 }) {
  const parts = useMemo(() => personParts(index, crowd[index]), [index]);
  const root = useRef<THREE.Group>(null), head = useRef<THREE.Group>(null), eyes = useRef<THREE.Group>(null), arm = useRef<THREE.Group>(null);
  const asker = question && index === 5;
  const blinkEvery = 2.6 + (index * 0.37) % 3.2;
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime, phase = index * 2.41;
    if (head.current) {
      const distracted = reaction === 'distracted' && index % 3 === 0;
      const nod = asker ? -.12 : engagement > 70 ? Math.sin(t * 1.3 + phase) * .06 : Math.sin(t * .5 + phase) * .02;
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, nod, .035);
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, distracted ? Math.sin(t * .3 + phase) * .6 : Math.sin(t * .22 + phase) * .06, .025);
      head.current.rotation.z = Math.sin(t * .31 + phase) * .025;
    }
    if (eyes.current) {
      const k = ((t + phase) % blinkEvery) / .14;
      eyes.current.scale.y = k < 1 ? Math.max(.08, Math.abs(1 - k * 2)) : 1;
    }
    if (root.current) root.current.rotation.z = Math.sin(t * .42 + phase) * .01;
    if (arm.current) {
      // Swing out (z) and tip the forward-resting forearm upward (x) so the hand ends overhead.
      arm.current.rotation.z = THREE.MathUtils.lerp(arm.current.rotation.z, asker ? 2.65 : 0, .04);
      arm.current.rotation.x = THREE.MathUtils.lerp(arm.current.rotation.x, asker ? -.85 : 0, .04);
    }
  });
  return <group position={position}>
    <group ref={root}>
      <mesh geometry={parts.body} material={toonMaterial}/>
      <mesh geometry={parts.body} material={outlineMaterial}/>
      <group ref={arm} position={parts.shoulder}>
        <mesh geometry={parts.arm} material={toonMaterial}/>
        <mesh geometry={parts.arm} material={outlineMaterial}/>
      </group>
      <group ref={head} position={parts.neck}>
        <mesh geometry={parts.head} material={toonMaterial}/>
        <mesh geometry={parts.head} material={outlineMaterial}/>
        <mesh geometry={parts.face} material={toonMaterial}/>
        <group ref={eyes} position={[0, parts.eyeLine, 0]}>
          <mesh geometry={parts.eyes} material={toonMaterial}/>
        </group>
      </group>
    </group>
  </group>;
}

function Seat({ position }: { position: Vec3 }) {
  return <group position={position}>
    <Box position={[0, .54, -.07]} scale={[.84, .16, .74]} color="#5a1c25"/>
    <RoundedBox args={[.84, .83, .18]} radius={.075} smoothness={2} position={[0, .93, -.39]} material={velvet}/>
    <Box position={[-.49, .65, 0]} scale={[.09, .12, .73]} color="#4a3324"/>
    <Box position={[.49, .65, 0]} scale={[.09, .12, .73]} color="#4a3324"/>
    <Box position={[-.35, .24, -.1]} scale={[.065, .5, .08]} color="#1c1c1e"/>
    <Box position={[.35, .24, -.1]} scale={[.065, .5, .08]} color="#1c1c1e"/>
  </group>;
}

function ExitSign({ position }: { position: Vec3 }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0f3d27'; ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#b8ffd2'; ctx.font = '600 44px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('EXIT', 128, 63);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={position}><planeGeometry args={[.9, .34]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>;
}

/** Reads the lighting ref every frame so callers can animate the room without React updates. */
function Lights({ lighting, haze }: { lighting: MutableRefObject<Lighting>; haze: number }) {
  const ambient = useRef<THREE.AmbientLight>(null), hemi = useRef<THREE.HemisphereLight>(null), key = useRef<THREE.DirectionalLight>(null);
  const spot = useRef<THREE.SpotLight>(null), sconces = useRef<THREE.Group>(null);
  const target = useMemo(() => { const o = new THREE.Object3D(); o.position.set(0, 1.1, 8.05); return o; }, []);
  useFrame(() => {
    const { house, spot: s } = lighting.current;
    if (ambient.current) ambient.current.intensity = .06 + house * .3;
    if (hemi.current) hemi.current.intensity = .15 + house * 1.05;
    if (key.current) key.current.intensity = .25 + house * 1.7;
    if (spot.current) spot.current.intensity = 40 * s;
    sconces.current?.children.forEach(light => { (light as THREE.PointLight).intensity = 1 + house * 7; });
  });
  return <>
    <ambientLight ref={ambient} intensity={.3}/>
    <hemisphereLight ref={hemi} args={['#ffe6c4', '#1a1410', 1]}/>
    <directionalLight ref={key} position={[0, 7, 12]} color="#ffe9cf" intensity={1.5}/>
    <primitive object={target}/>
    <SpotLight ref={spot} position={[0, 8.6, 3.2]} target={target} color="#fff1d6" angle={.36} penumbra={.55} distance={16} attenuation={9.5} anglePower={4.5} opacity={haze} intensity={40}/>
    <group ref={sconces}>
      {[-1, 1].flatMap(side => [4, -2, -8].map(z => <pointLight key={`${side}${z}`} position={[side * 8.9, 3.5, z]} distance={6.5} color="#ffc98a" intensity={6}/>))}
    </group>
  </>;
}

/**
 * Gooseneck lectern microphone, built as real connected geometry: a weighted base plate
 * resting on the sloped lectern top, a short stem, a continuous curved neck and a foam
 * windscreen aimed at the speaker's mouth. Coordinates are local to the lectern group.
 */
const micMetal = new THREE.MeshStandardMaterial({ color: '#1b1d1f', metalness: .85, roughness: .32 });
const micChrome = new THREE.MeshStandardMaterial({ color: '#8d9296', metalness: 1, roughness: .18 });
const micFoam = new THREE.MeshStandardMaterial({ color: '#111213', roughness: 1 });
const micLed = new THREE.MeshBasicMaterial({ color: '#d4ff3f', toneMapped: false });
// The lectern top is tilted 0.1 rad toward the speaker; the base sits flush on it.
const MIC_BASE: Vec3 = [.62, 1.19, -.3];
const neckCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, .12, 0),
  new THREE.Vector3(0, .32, .01),
  new THREE.Vector3(-.04, .5, .08),
  new THREE.Vector3(-.12, .62, .22),
  new THREE.Vector3(-.2, .66, .36),
]);
const neckGeometry = new THREE.TubeGeometry(neckCurve, 48, .0085, 10, false);
const neckEnd = neckCurve.getPoint(1);
const neckTangent = neckCurve.getTangent(1).normalize();
const headQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), neckTangent);
// Flexible-neck ribs every few centimetres sell the gooseneck at close range.
const neckRibs = Array.from({ length: 14 }, (_, i) => {
  const t = .08 + i * .065;
  return { position: neckCurve.getPoint(t), quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), neckCurve.getTangent(t).normalize()) };
});

function Microphone() {
  return <group position={MIC_BASE} rotation={[.1, 0, 0]}>
    <mesh material={micMetal} position={[0, .008, 0]}><cylinderGeometry args={[.075, .085, .016, 32]}/></mesh>
    <mesh material={micChrome} position={[0, .018, 0]}><cylinderGeometry args={[.03, .04, .006, 24]}/></mesh>
    <mesh material={micMetal} position={[0, .07, 0]}><cylinderGeometry args={[.012, .014, .11, 16]}/></mesh>
    <mesh material={micMetal} geometry={neckGeometry}/>
    {neckRibs.map((rib, i) => <mesh key={i} material={micChrome} position={rib.position} quaternion={rib.quaternion}><torusGeometry args={[.0095, .0018, 6, 14]}/></mesh>)}
    <group position={neckEnd} quaternion={headQuaternion}>
      <mesh material={micChrome} position={[0, .012, 0]}><cylinderGeometry args={[.011, .009, .024, 16]}/></mesh>
      <mesh material={micLed} position={[0, .026, 0]}><torusGeometry args={[.0115, .0022, 8, 24]}/></mesh>
      <mesh material={micFoam} position={[0, .062, 0]}><capsuleGeometry args={[.021, .05, 8, 16]}/></mesh>
    </group>
  </group>;
}

type AuditoriumProps = Mood & { count: number; lighting: MutableRefObject<Lighting>; haze?: number };

function AuditoriumImpl({ count, engagement, reaction, question, reduced, lighting, haze = .5 }: AuditoriumProps) {
  const seats = useMemo(() => Array.from({ length: 72 }, (_, i) => {
    const row = Math.floor(i / 12), col = i % 12;
    const x = col < 6 ? -7.2 + col * 1.13 : 1.55 + (col - 6) * 1.13;
    return { i, position: [x, row * .27, 3.1 - row * 1.85] as Vec3 };
  }), []);
  return <>
    <color attach="background" args={['#060607']}/>
    <fog attach="fog" args={['#060607', 16, 42]}/>
    <Lights lighting={lighting} haze={haze}/>
    <BoxInstances geometry={unitBox} material={litMaterial} limit={1700} dispose={null}>
    <GlowInstances geometry={unitBox} material={glowMaterial} limit={120} dispose={null}>
      {/* Floor, stage and planks */}
      <Box position={[0, -.12, -2]} scale={[20, .24, 28]} color="#141316"/>
      <Box position={[0, 0, 7.6]} scale={[20, 1, 5.5]} color="#3a2a1f"/>
      {Array.from({ length: 38 }, (_, i) => <Box key={`plank${i}`} position={[-9.5 + i * .51, .506, 7.6]} scale={[.012, .01, 5.5]} color="#251a13"/>)}
      <Glow position={[0, .52, 4.86]} scale={[19.6, .018, .03]} color="#ffb768"/>
      {/* Raked risers with aisle step lights */}
      {Array.from({ length: 6 }, (_, row) => <group key={`riser${row}`}>
        <Box position={[0, row * .27 - .14, 2.8 - row * 1.85]} scale={[19.2, .28, 1.85]} color={row % 2 ? '#1b1a1e' : '#1f1d22'}/>
        {[-.73, .73].map(x => <Glow key={x} position={[x, row * .27 + .01, 3.68 - row * 1.85]} scale={[.16, .02, .04]} color="#ffcf8a"/>)}
      </group>)}
      {/* Walnut side walls with sconces */}
      <Box position={[-9.75, 3, -3]} scale={[.25, 7, 25]} color="#24190f"/>
      <Box position={[9.75, 3, -3]} scale={[.25, 7, 25]} color="#24190f"/>
      {[-1, 1].map(side => <group key={`wall${side}`}>
        {Array.from({ length: 54 }, (_, i) => <Box key={i} position={[side * 9.58, 3.2, 8 - i * .4]} scale={[.15, 6.4, .09]} color={i % 3 === 0 ? '#2a1d14' : '#3a2a1e'}/>)}
        {[4, -2, -8].map(z => <Glow key={z} position={[side * 9.42, 3.5, z]} scale={[.06, 1.3, .12]} color="#ffd29a"/>)}
        <Box position={[side * 9.3, .9, -3]} scale={[.17, 1.8, 1]} color="#1a1612"/>
      </group>)}
      {/* Back wall, exits and ceiling */}
      <Box position={[0, 4, -10.8]} scale={[20, 8, .3]} color="#141316"/>
      {Array.from({ length: 37 }, (_, i) => <Box key={`back${i}`} position={[-9.2 + i * .51, 4, -10.6]} scale={[.07, 7.6, .09]} color="#221a14"/>)}
      {[-7.7, 7.7].map(x => <group key={`door${x}`}>
        <Box position={[x, 2.1, -10.38]} scale={[1.5, 2.8, .11]} color="#1d1f1c"/>
        <Box position={[x + .5, 1.85, -10.28]} scale={[.03, .28, .06]} color="#8f7f60"/>
        <ExitSign position={[x, 3.85, -10.2]}/>
      </group>)}
      <Box position={[0, 7, -3]} scale={[20, .18, 26]} color="#0e0d10"/>
      {[-7, -3, 1, 5].map(z => <group key={`ceiling${z}`}>
        <Box position={[0, 6.85, z]} scale={[19, .14, .15]} color="#1c1714"/>
        <Glow position={[0, 6.76, z]} scale={[13, .015, .05]} color="#6b5a44"/>
      </group>)}
      {/* Velvet curtain and proscenium behind the speaker */}
      {Array.from({ length: 40 }, (_, i) => <Box key={`curtain${i}`} position={[-9.75 + i * .5, 3.6, 10.45 + (i % 2) * .12]} scale={[.52, 7.2, .14]} color={i % 2 ? '#3d0f17' : '#4b1520'}/>)}
      {[-1, 1].map(side => <Box key={`pillar${side}`} position={[side * 9.4, 3.6, 5]} scale={[.7, 7.2, .7]} color="#1d1612"/>)}
      {seats.map(({ i, position }) => <group key={i}>
        <Seat position={position}/>
        {i < count && <Person index={i} position={position} engagement={engagement} reaction={reaction} question={question} reduced={reduced}/>}
      </group>)}
      {/* Lectern and gooseneck microphone — always in the speaker's foreground */}
      <group position={[0, .5, 8.05]}>
        <Box position={[0, .52, 0]} scale={[1.6, 1.04, .7]} color="#3b2717"/>
        <Box position={[0, .52, -.36]} scale={[1.2, .7, .02]} color="#2a1b10"/>
        <Box position={[0, 1.075, .025]} scale={[2, .16, 1.1]} color="#6b4a2c" rotation={[.1, 0, 0]}/>
        <Box position={[0, 1.17, .11]} scale={[.75, .015, .52]} color="#ece4d2" rotation={[.1, 0, 0]}/>
        <Microphone/>
      </group>
    </GlowInstances></BoxInstances>
  </>;
}
export const Auditorium = memo(AuditoriumImpl);

/** Calls `onReady` once the first frame has actually been drawn (after shader compilation). */
export function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => { if (!done.current) { done.current = true; requestAnimationFrame(() => onReady()); } });
  return null;
}

export function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const update = () => setReduced(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return reduced;
}

export class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? this.props.fallback : this.props.children; }
}

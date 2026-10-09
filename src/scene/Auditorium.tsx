import { Component, memo, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, SpotLight, createInstances } from '@react-three/drei';
import * as THREE from 'three';
import type { Reaction } from '../lib/analysis';

/**
 * A procedural, theatre-lit auditorium shared by the landing hero and the studio.
 * Everything is batched into a handful of instanced draw calls; lighting levels are
 * read from a mutable ref so scroll-driven scenes can animate them without re-rendering.
 */
export type Lighting = { house: number; spot: number };
type Vec3 = [number, number, number];

const bodyColors = ['#4a5d52', '#8a6a55', '#2e4356', '#c9a98f', '#4b4f55', '#6f8189', '#9a5f55', '#d8c7a5', '#5b4a6b', '#a07a3c'];
const skinColors = ['#b47d59', '#e9bb95', '#8b563b', '#d3a279', '#f2c9a6', '#a77250'];
const hairColors = ['#2a1f1a', '#1f1c19', '#5a4335', '#141516', '#8a6748'];

const [BoxInstances, BoxInstance] = createInstances();
const [SphereInstances, SphereInstance] = createInstances();
const [LimbInstances, LimbInstance] = createInstances();
const [GlowInstances, GlowInstance] = createInstances();
const litMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .82 });
const glowMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.SphereGeometry(1, 16, 12);
const capsule = new THREE.CapsuleGeometry(1, 1, 4, 8);
const velvet = new THREE.MeshStandardMaterial({ color: '#5c1d27', roughness: .95 });

type Part = { position: Vec3; scale: Vec3; color: string; rotation?: Vec3 };
const Box = (p: Part) => <BoxInstance {...p}/>;
const Ellipsoid = (p: Part) => <SphereInstance {...p}/>;
const Limb = (p: Part) => <LimbInstance {...p}/>;
const Glow = (p: Part) => <GlowInstance {...p}/>;

type Mood = { engagement: number; reaction: Reaction; question: boolean; reduced: boolean };

function Person({ index, position, engagement, reaction, question, reduced }: Mood & { index: number; position: Vec3 }) {
  const head = useRef<THREE.Group>(null), torso = useRef<THREE.Group>(null), arm = useRef<THREE.Group>(null);
  const shirt = bodyColors[index % bodyColors.length], skin = skinColors[(index * 7) % skinColors.length], hair = hairColors[index % hairColors.length];
  const asker = question && index === 5;
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime, phase = index * 2.41;
    if (head.current) {
      const distracted = reaction === 'distracted' && index % 3 === 0;
      const nod = asker ? -.1 : engagement > 70 ? Math.sin(t * 1.3 + phase) * .06 : Math.sin(t * .5 + phase) * .02;
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, nod, .035);
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, distracted ? Math.sin(t * .3 + phase) * .6 : Math.sin(t * .22 + phase) * .045, .025);
    }
    if (torso.current) torso.current.rotation.z = Math.sin(t * .42 + phase) * .013;
    if (arm.current) arm.current.rotation.z = THREE.MathUtils.lerp(arm.current.rotation.z, asker ? -2.55 : .14, .03);
  });
  return <group position={position}>
    <Limb position={[-.13, .42, .24]} scale={[.095, .23, .095]} color="#26292a" rotation={[-.16, 0, 0]}/>
    <Limb position={[.13, .42, .24]} scale={[.095, .23, .095]} color="#26292a" rotation={[-.16, 0, 0]}/>
    <Ellipsoid position={[-.14, .17, .39]} scale={[.12, .085, .2]} color="#1f1e1d"/>
    <Ellipsoid position={[.14, .17, .39]} scale={[.12, .085, .2]} color="#1f1e1d"/>
    <group ref={torso} position={[0, .78, .015]}>
      <Ellipsoid position={[0, .18, 0]} scale={[.32, .41, .19]} color={shirt}/>
      <Box position={[0, .33, .178]} scale={[.035, .26, .012]} color={index % 2 ? '#ded8cb' : shirt}/>
      <Limb position={[-.29, .13, .08]} scale={[.085, .21, .085]} color={shirt} rotation={[-.3, 0, -.1]}/>
      <Ellipsoid position={[-.3, -.08, .2]} scale={[.075, .075, .09]} color={skin}/>
      <group ref={arm} position={[.29, .36, 0]} rotation={[0, 0, .14]}>
        <Limb position={[0, -.23, .09]} scale={[.085, .21, .085]} color={shirt} rotation={[-.3, 0, 0]}/>
        <Ellipsoid position={[0, -.44, .18]} scale={[.075, .08, .075]} color={skin}/>
      </group>
      <Limb position={[0, .61, 0]} scale={[.08, .065, .08]} color={skin}/>
      <group ref={head} position={[0, .78, 0]}>
        <Ellipsoid position={[0, 0, 0]} scale={[.185, .235, .17]} color={skin}/>
        <Ellipsoid position={[0, .115, -.025]} scale={[.19, .147, .174]} color={hair}/>
        {index % 4 === 0 && <Ellipsoid position={[0, .065, -.115]} scale={[.2, .225, .11]} color={hair}/>}
        <Ellipsoid position={[-.075, .025, .151]} scale={[.018, .013, .013]} color="#1d1916"/>
        <Ellipsoid position={[.075, .025, .151]} scale={[.018, .013, .013]} color="#1d1916"/>
        <Ellipsoid position={[0, -.045, .167]} scale={[.024, .035, .025]} color={skin}/>
        <Box position={[0, -.106, .151]} scale={[.055, .008, .012]} color="#7d4a3b"/>
        {index % 6 === 0 && <>
          <Box position={[-.073, .025, .167]} scale={[.1, .062, .014]} color="#2b2e2d"/>
          <Box position={[.073, .025, .167]} scale={[.1, .062, .014]} color="#2b2e2d"/>
          <Box position={[0, .025, .17]} scale={[.048, .012, .016]} color="#2b2e2d"/>
        </>}
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
    <SphereInstances geometry={sphere} material={litMaterial} limit={1500} dispose={null}>
    <LimbInstances geometry={capsule} material={litMaterial} limit={500} dispose={null}>
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
        <Box position={[.78, 1.4, -.21]} scale={[.025, .5, .025]} color="#1d2020" rotation={[-.3, 0, 0]}/>
        <Limb position={[.77, 1.71, -.1]} scale={[.025, .16, .025]} color="#1d2020" rotation={[0, 0, .8]}/>
        <Ellipsoid position={[.65, 1.84, -.08]} scale={[.046, .065, .05]} color="#141818"/>
        <Glow position={[.65, 1.78, -.04]} scale={[.012, .012, .012]} color="#d4ff3f"/>
      </group>
    </GlowInstances></LimbInstances></SphereInstances></BoxInstances>
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

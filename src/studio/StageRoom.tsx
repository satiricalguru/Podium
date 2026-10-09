import { memo, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Reaction } from '../lib/analysis';
import { Auditorium, FirstFrame, SceneBoundary, useReducedMotion, type Lighting } from '../scene/Auditorium';

function CameraRig({ reset, reduced }: { reset: number; reduced: boolean }) {
  const { camera, pointer } = useThree();
  const [look, setLook] = useState(true);
  useEffect(() => {
    camera.position.set(0, 2.65, 9.6); camera.lookAt(0, 2, -7);
    setLook(false);
    const timer = setTimeout(() => setLook(true), 400);
    return () => clearTimeout(timer);
  }, [camera, reset]);
  useFrame(() => {
    const x = look && !reduced ? pointer.x * .22 : 0, y = look && !reduced ? pointer.y * .08 : 0;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, x, .025);
    camera.lookAt(x * .4, 2 + y, -7);
  });
  return null;
}

type Props = { count: number; engagement: number; reaction: Reaction; question: boolean; reset: number; live: boolean };

/** Speaker's-eye view used by the studio. House lights dim slightly once a session is live. */
function StageRoomImpl({ count, engagement, reaction, question, reset, live }: Props) {
  const reduced = useReducedMotion();
  const lighting = useRef<Lighting>({ house: .8, spot: 1 });
  const [ready, setReady] = useState(false);
  useEffect(() => { lighting.current.house = live ? .62 : .8; }, [live]);
  return <SceneBoundary fallback={<div className="room-fallback"><strong>3D room unavailable</strong><p>Your browser needs WebGL to render the auditorium. Practice, transcript and feedback still work.</p></div>}>
    {!ready && <div className="room-fallback"><span className="loader"/>Setting up the auditorium…</div>}
    <Canvas className={`stage-gl ${ready ? 'is-ready' : ''}`} camera={{ position: [0, 2.65, 9.6], fov: 62, near: .1, far: 65 }} dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <Auditorium count={count} engagement={engagement} reaction={reaction} question={question} reduced={reduced} lighting={lighting} haze={.18}/>
      <CameraRig reset={reset} reduced={reduced}/>
      <FirstFrame onReady={() => setReady(true)}/>
    </Canvas>
  </SceneBoundary>;
}

export default memo(StageRoomImpl);

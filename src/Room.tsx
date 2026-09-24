import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, ContactShadows, createInstances } from '@react-three/drei';
import * as THREE from 'three';
import type { Reaction } from './lib/analysis';

const bodyColors = ['#697b69','#b18b71','#344d5e','#d5b39b','#55595c','#86949b','#b18174','#e2d1b4'];
const skinColors = ['#b47d59','#e9bb95','#8b563b','#d3a279','#f2c9a6','#a77250'];
const [BoxInstances, BoxInstance] = createInstances();
const [SphereInstances, SphereInstance] = createInstances();
const [LimbInstances, LimbInstance] = createInstances();
const batchMaterial = new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.8});
const unitBox = new THREE.BoxGeometry(1,1,1);
const sphere = new THREE.SphereGeometry(1,16,12);
const capsule = new THREE.CapsuleGeometry(1,1,4,8);
const materialCache = new Map<string,THREE.MeshStandardMaterial>();
function material(color: string) { if(!materialCache.has(color)) materialCache.set(color,new THREE.MeshStandardMaterial({color,roughness:.8}));return materialCache.get(color)!; }
function Box({position,scale,color, ...props}:{position:[number,number,number];scale:[number,number,number];color:string;rotation?:[number,number,number]}) { return <BoxInstance color={color} position={position} scale={scale} {...props}/>; }
function Ellipsoid({position,scale,color}:{position:[number,number,number];scale:[number,number,number];color:string}) { return <SphereInstance color={color} position={position} scale={scale}/>; }
function Limb({position,scale,color,rotation}:{position:[number,number,number];scale:[number,number,number];color:string;rotation?:[number,number,number]}){return <LimbInstance color={color} position={position} scale={scale} rotation={rotation}/>;}
function Person({index,position,engagement,reaction,question,reduced}:{index:number;position:[number,number,number];engagement:number;reaction:Reaction;question:boolean;reduced:boolean}) {
  const head=useRef<THREE.Group>(null); const torso=useRef<THREE.Group>(null); const arm=useRef<THREE.Group>(null);
  const shirt=bodyColors[index%bodyColors.length], skin=skinColors[(index*7)%skinColors.length];
  const hair=['#3a2b25','#302c28','#695141','#242729','#987257'][index%5];
  useFrame(({clock})=>{
    if(reduced) return;
    const t=clock.elapsedTime,phase=index*2.41;
    if(head.current){
      const distracted=reaction==='distracted' && index%3===0;
      const x=question && index===5 ? -.1 : engagement>70 ? Math.sin(t*1.3+phase)*.06 : Math.sin(t*.5+phase)*.02;
      head.current.rotation.x=THREE.MathUtils.lerp(head.current.rotation.x,x,.035);
      head.current.rotation.y=THREE.MathUtils.lerp(head.current.rotation.y,distracted?Math.sin(t*.3+phase)*.6:Math.sin(t*.22+phase)*.045,.025);
    }
    if(torso.current) torso.current.rotation.z=Math.sin(t*.42+phase)*.013;
    if(arm.current) arm.current.rotation.z=THREE.MathUtils.lerp(arm.current.rotation.z,question && index===5 ? -2.55 : .14,.03);
  });
  return <group position={position}>
    <Limb position={[-.13,.42,.24]} scale={[.095,.23,.095]} color="#313637" rotation={[-.16,0,0]}/><Limb position={[.13,.42,.24]} scale={[.095,.23,.095]} color="#313637" rotation={[-.16,0,0]}/>
    <Ellipsoid position={[-.14,.17,.39]} scale={[.12,.085,.2]} color="#343331"/><Ellipsoid position={[.14,.17,.39]} scale={[.12,.085,.2]} color="#343331"/>
    <group ref={torso} position={[0,.78,.015]}>
      <Ellipsoid position={[0,.18,0]} scale={[.32,.41,.19]} color={shirt}/>
      <Box position={[0,.33,.178]} scale={[.035,.26,.012]} color={index%2?'#ded8cb':shirt}/>
      <Limb position={[-.29,.13,.08]} scale={[.085,.21,.085]} color={shirt} rotation={[-.3,0,-.1]}/>
      <Ellipsoid position={[-.3,-.08,.2]} scale={[.075,.075,.09]} color={skin}/>
      <group ref={arm} position={[.29,.36,0]} rotation={[0,0,.14]}>
        <Limb position={[0,-.23,.09]} scale={[.085,.21,.085]} color={shirt} rotation={[-.3,0,0]}/>
        <Ellipsoid position={[0,-.44,.18]} scale={[.075,.08,.075]} color={skin}/>
      </group>
      <Limb position={[0,.61,0]} scale={[.08,.065,.08]} color={skin}/>
      <group ref={head} position={[0,.78,0]}>
        <Ellipsoid position={[0,0,0]} scale={[.185,.235,.17]} color={skin}/>
        <Ellipsoid position={[0,.115,-.025]} scale={[.19,.147,.174]} color={hair}/>
        {index%4===0 && <Ellipsoid position={[0,.065,-.115]} scale={[.2,.225,.11]} color={hair}/>}
        <Ellipsoid position={[-.075,.025,.151]} scale={[.018,.013,.013]} color="#302b28"/>
        <Ellipsoid position={[.075,.025,.151]} scale={[.018,.013,.013]} color="#302b28"/>
        <Ellipsoid position={[0,-.045,.167]} scale={[.024,.035,.025]} color={skin}/>
        <Box position={[0,-.106,.151]} scale={[.055,.008,.012]} color="#925f4c"/>
        {index%6===0 && <><Box position={[-.073,.025,.167]} scale={[.1,.062,.014]} color="#424744"/><Box position={[.073,.025,.167]} scale={[.1,.062,.014]} color="#424744"/><Box position={[0,.025,.17]} scale={[.048,.012,.016]} color="#424744"/></>}
      </group>
    </group>
  </group>;
}
function Seat({position}:{position:[number,number,number]}) { return <group position={position}>
  <Box position={[0,.54,-.07]} scale={[.84,.16,.74]} color="#526860"/>
  <RoundedBox args={[.84,.83,.18]} radius={.075} smoothness={2} position={[0,.93,-.39]} material={material('#586f64')}/>
  <Box position={[-.49,.65,0]} scale={[.09,.12,.73]} color="#a48661"/><Box position={[.49,.65,0]} scale={[.09,.12,.73]} color="#a48661"/>
  <Box position={[-.35,.24,-.1]} scale={[.065,.5,.08]} color="#414a45"/><Box position={[.35,.24,-.1]} scale={[.065,.5,.08]} color="#414a45"/>
</group>; }
function Sign({position}:{position:[number,number,number]}){
  const texture=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#365d48';ctx.fillRect(0,0,256,96);ctx.fillStyle='#e7f0de';ctx.font='bold 44px sans-serif';ctx.textAlign='center';ctx.fillText('← EXIT',128,63);return new THREE.CanvasTexture(canvas);},[]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh position={position}><planeGeometry args={[1.1,.42]}/><meshBasicMaterial map={texture}/></mesh>;
}
function CameraRig({reset,reduced}:{reset:number;reduced:boolean}){
  const {camera,pointer}=useThree(); const [look,setLook]=useState(true);
  useEffect(()=>{camera.position.set(0,2.65,9.6);camera.lookAt(0,2,-7);setLook(false);const timer=setTimeout(()=>setLook(true),400);return()=>clearTimeout(timer);},[camera,reset]);
  useFrame(()=>{const x=look&&!reduced ? pointer.x*.22 : 0;const y=look&&!reduced ? pointer.y*.08 : 0;camera.position.x=THREE.MathUtils.lerp(camera.position.x,x,.025);camera.lookAt(x*.4,2+y,-7);});
  return null;
}
function Auditorium({count,engagement,reaction,question,reset,reduced}:{count:number;engagement:number;reaction:Reaction;question:boolean;reset:number;reduced:boolean}){
  const seats=useMemo(()=>Array.from({length:72},(_,i)=>{const row=Math.floor(i/12),col=i%12;const x=(col<6 ? -7.2+col*1.13 : 1.55+(col-6)*1.13);return {position:[x,row*.27,3.1-row*1.85] as [number,number,number],i};}),[]);
  return <>
    <color attach="background" args={['#a79b80']}/><fog attach="fog" args={['#a79b80',20,44]}/>
    <ambientLight intensity={.85}/><hemisphereLight args={['#fff2d5','#7e7361',1.6]}/>
    <directionalLight position={[3,8,7]} intensity={2.6} color="#fff0d7"/>
    <pointLight position={[-7,4,-2]} intensity={28} color="#ffd6a0" distance={20}/><pointLight position={[7,4,-6]} intensity={25} color="#ffd6a0" distance={20}/>
    <CameraRig reset={reset} reduced={reduced}/>
    <BoxInstances geometry={unitBox} material={batchMaterial} limit={1100} dispose={null}>
    <SphereInstances geometry={sphere} material={batchMaterial} limit={1500} dispose={null}>
    <LimbInstances geometry={capsule} material={batchMaterial} limit={500} dispose={null}>
    <Box position={[0,-.12,-2]} scale={[20,.24,28]} color="#9a927e"/>
    <Box position={[0,0,7.6]} scale={[20,1,5.5]} color="#b29572"/>
    {Array.from({length:38},(_,i)=><Box key={`stage${i}`} position={[-9.5+i*.51,.506,7.6]} scale={[.012,.01,5.5]} color="#967a59"/>)}
    {Array.from({length:6},(_,row)=><group key={`riser${row}`}>
      <Box position={[0,row*.27-.14,2.8-row*1.85]} scale={[19.2,.28,1.85]} color={row%2?'#b2a68d':'#b8ac92'}/>
      {[-.73,.73].map(x=><Box key={x} position={[x,row*.27+.008,2.8-row*1.85]} scale={[.045,.015,1.72]} color="#e6cd97"/>)}
    </group>)}
    <Box position={[-9.75,3,-3]} scale={[.25,7,25]} color="#b9a385"/><Box position={[9.75,3,-3]} scale={[.25,7,25]} color="#b9a385"/>
    {[-1,1].map(side=><group key={`wall${side}`}>
      {Array.from({length:54},(_,i)=><Box key={i} position={[side*9.58,3.2,8-i*.4]} scale={[.15,6.4,.09]} color={i%3===0?'#8a6d4e':'#a28564'}/>)}
      {[4,-2,-8].map(z=><group key={z}><Box position={[side*9.4,3.5,z]} scale={[.1,1.6,.18]} color="#f2d3a2"/><pointLight position={[side*9.05,3.5,z]} intensity={8} distance={6} color="#ffd19a"/></group>)}
      <Box position={[side*9.3,.9,-3]} scale={[.17,1.8,1]} color="#665949"/>
    </group>)}
    <Box position={[0,4,-10.8]} scale={[20,8,.3]} color="#b9ad94"/>
    {Array.from({length:37},(_,i)=><Box key={`back${i}`} position={[-9.2+i*.51,4,-10.6]} scale={[.07,7.6,.09]} color="#9a8263"/>)}
    {[-7.7,7.7].map(x=><group key={`door${x}`}><Box position={[x,2.1,-10.38]} scale={[1.5,2.8,.11]} color="#6e725f"/><Box position={[x+.5,1.85,-10.28]} scale={[.03,.28,.06]} color="#c9b68f"/><Sign position={[x,3.85,-10.2]}/></group>)}
    <Box position={[0,7,-3]} scale={[20,.18,26]} color="#d2c3a8"/>
    {[-7,-3,1,5].map(z=><group key={`ceiling${z}`}><Box position={[0,6.85,z]} scale={[19,.14,.15]} color="#8d7458"/><Box position={[0,6.74,z]} scale={[13,.02,.06]} color="#fff0c5"/></group>)}
    {seats.map(({i,position})=><group key={i}><Seat position={position}/>{i<count && <Person index={i} position={position} engagement={engagement} reaction={reaction} question={question} reduced={reduced}/>}</group>)}
    {/* Lectern and gooseneck microphone remain visible in the speaker's foreground. */}
    <group position={[0,.5,8.05]}>
      <Box position={[0,.52,0]} scale={[1.6,1.04,.7]} color="#806344"/>
      <Box position={[0,1.075,.025]} scale={[2,.16,1.1]} color="#b8976e" rotation={[.1,0,0]}/>
      <Box position={[0,1.17,.11]} scale={[.75,.015,.52]} color="#e9e1ce" rotation={[.1,0,0]}/>
      <Box position={[.78,1.4,-.21]} scale={[.025,.5,.025]} color="#343938" rotation={[-.3,0,0]}/>
      <Limb position={[.77,1.71,-.1]} scale={[.025,.16,.025]} color="#333837" rotation={[0,0,.8]}/>
      <Ellipsoid position={[.65,1.84,-.08]} scale={[.046,.065,.05]} color="#242c2a"/>
    </group>
    </LimbInstances></SphereInstances></BoxInstances>
    <ContactShadows position={[0,.015,0]} opacity={.22} scale={24} blur={2.6} far={5} resolution={256} frames={1}/>
  </>;
}
class RoomBoundary extends Component<{children:ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return{error:true};}render(){return this.state.error?<div className="room-fallback"><span>3D room unavailable</span><p>Your browser needs WebGL to render the auditorium. Practice controls and transcript feedback are still available.</p></div>:this.props.children;}}
export default function Room(props:{count:number;engagement:number;reaction:Reaction;question:boolean;reset:number}){
  const [reduced,setReduced]=useState(()=>typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false);
  useEffect(()=>{
    if(typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReduced(query.matches);
    query.addEventListener('change',update);
    return()=>query.removeEventListener('change',update);
  },[]);
  return <RoomBoundary><Suspense fallback={<div className="room-fallback">Preparing your auditorium…</div>}><Canvas camera={{position:[0,2.65,9.6],fov:64,near:.1,far:65}} dpr={[1,1.5]} gl={{antialias:true,powerPreference:'high-performance'}}><Auditorium {...props} reduced={reduced}/></Canvas></Suspense></RoomBoundary>;
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Character } from './characters';

/**
 * Builds a seated, cel-shaded anime character from primitives. Each part is baked into
 * vertex colours and merged so a whole person costs four meshes (body, right arm, head, face)
 * that share one toon material — cheap enough for a 72-seat auditorium.
 *
 * Coordinates: the person's seat origin, +z facing the stage, metres.
 */
type V3 = [number, number, number];
export type PersonParts = {
  body: THREE.BufferGeometry;
  arm: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  face: THREE.BufferGeometry;
  eyes: THREE.BufferGeometry;
  shoulder: V3;
  neck: V3;
  eyeLine: number;
};

const SPHERE = new THREE.SphereGeometry(1, 18, 12);
const SMALL_SPHERE = new THREE.SphereGeometry(1, 10, 8);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

const shade = (hex: string, k: number) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

class Builder {
  parts: THREE.BufferGeometry[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  constructor(private frame = new THREE.Matrix4()) {}

  add(source: THREE.BufferGeometry, color: string, position: V3, scale: V3 = [1, 1, 1], rotation: V3 = [0, 0, 0]) {
    const g = source.clone();
    this.q.setFromEuler(this.e.set(...rotation));
    this.m.compose(new THREE.Vector3(...position), this.q, new THREE.Vector3(...scale)).premultiply(this.frame);
    g.applyMatrix4(this.m);
    const c = new THREE.Color(color), n = g.attributes.position.count, rgb = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { rgb[i * 3] = c.r; rgb[i * 3 + 1] = c.g; rgb[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    this.parts.push(g);
    return this;
  }
  ball(color: string, position: V3, scale: V3, rotation?: V3) { return this.add(scale[0] < .05 && scale[1] < .05 ? SMALL_SPHERE : SPHERE, color, position, scale, rotation); }
  box(color: string, position: V3, scale: V3, rotation?: V3) { return this.add(BOX, color, position, scale, rotation); }
  /** A capsule between two points — limbs, locks of hair, straps. */
  limb(color: string, from: V3, to: V3, radius: number) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), dir = b.clone().sub(a);
    const length = dir.length();
    const g = new THREE.CapsuleGeometry(radius, Math.max(.001, length), 4, 10);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
    const mid = a.add(b).multiplyScalar(.5);
    return this.add(g, color, [mid.x, mid.y, mid.z], [1, 1, 1], new THREE.Euler().setFromQuaternion(q).toArray().slice(0, 3) as V3);
  }
  /** A cone whose tip points along `dir` — hair spikes, bangs, cat ears. */
  spike(color: string, base: V3, dir: V3, radius: number, height: number, flatten = 1) {
    const d = new THREE.Vector3(...dir).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d);
    const centre = new THREE.Vector3(...base).addScaledVector(d, height / 2);
    // Flattened locks read as strands of hair rather than party-hat cones.
    const cone = new THREE.ConeGeometry(radius, height, 16, 3);
    if (flatten !== 1) cone.scale(1, 1, flatten);
    return this.add(cone, color, centre.toArray() as V3, [1, 1, 1], new THREE.Euler().setFromQuaternion(q).toArray().slice(0, 3) as V3);
  }
  ring(color: string, position: V3, radius: number, tube: number, rotation: V3 = [0, 0, 0], arc = Math.PI * 2) {
    return this.add(new THREE.TorusGeometry(radius, tube, 6, 20, arc), color, position, [1, 1, 1], rotation);
  }
  merge() {
    const merged = mergeGeometries(this.parts, false)!;
    this.parts.forEach(p => p.dispose());
    merged.computeBoundingSphere();
    return merged;
  }
}

function buildBody(c: Character, b: number) {
  const body = new Builder();
  const sleeve = c.outfitColor;
  const skirt = c.bottoms === 'skirt';
  const legColor = skirt ? (c.build > 1 ? '#2a2830' : c.skin) : c.bottomsColor;
  // Lap and legs
  body.ball(c.bottomsColor, [0, .71, -.06], [.2 * b, .1, .17]);
  for (const s of [-1, 1]) {
    body.limb(skirt ? legColor : c.bottomsColor, [s * .1, .71, -.04], [s * .11, .71, .3], .078);
    body.limb(legColor, [s * .11, .7, .31], [s * .11, .14, .36], .06);
    if (skirt) body.limb('#f4f2ec', [s * .11, .34, .345], [s * .11, .13, .36], .064);
    body.ball(skirt ? '#3a2620' : '#1b1a1f', [s * .11, .06, .41], [.072, .05, .12]);
  }
  if (skirt) {
    body.ball(c.bottomsColor, [0, .76, .08], [.25 * b, .075, .27]);
    body.ring(shade(c.bottomsColor, .7), [0, .735, .09], .24, .012, [Math.PI / 2, 0, 0]);
  }
  // Torso
  body.ball(c.outfitColor, [0, .84, -.06], [.165 * b, .13, .125]);
  body.ball(c.outfitColor, [0, 1.0, -.06], [.2 * b, .22, .135]);
  for (const s of [-1, 1]) body.ball(c.outfitColor, [s * .18 * b, 1.115, -.06], [.06, .052, .062]);
  body.limb(c.skin, [0, 1.16, -.06], [0, 1.3, -.06], .045);
  // Left arm resting on the lap
  body.limb(sleeve, [-.2 * b, 1.11, -.06], [-.23 * b, .88, .04], .055);
  body.limb(sleeve, [-.23 * b, .88, .04], [-.15, .77, .24], .048);
  body.ball(c.skin, [-.14, .765, .275], [.045, .038, .052]);
  outfitDetails(body, c, b);
  if (c.accessory === 'headphones') {
    body.ring('#26262c', [0, 1.21, -.05], .1, .02, [Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) body.ball(c.accent === '#f2f0ea' ? '#26262c' : c.accent, [s * .1, 1.2, .03], [.045, .05, .03]);
  }
  return body.merge();
}

function outfitDetails(body: Builder, c: Character, b: number) {
  const white = '#f2f0ea', front = .068;
  const shirtPanel = (color = white) => body.ball(color, [0, 1.05, front - .01], [.065 * b, .15, .02]);
  const collar = (color = white) => { for (const s of [-1, 1]) body.box(color, [s * .035, 1.17, .02], [.05, .035, .012], [-.5, 0, s * .6]); };
  const tie = () => body.box(c.accent, [0, 1.03, front + .008], [.028, .13, .01]).box(c.accent, [0, 1.11, front + .004], [.034, .025, .012]);
  const buttons = (color: string, x = 0) => { for (const y of [.97, .9, .83]) body.ball(color, [x, y, front + .004], [.009, .009, .006]); };
  switch (c.outfit) {
    case 'blazer':
    case 'suit':
      shirtPanel(); collar(); tie();
      for (const s of [-1, 1]) body.box(shade(c.outfitColor, .78), [s * .055 * b, 1.05, front + .006], [.045, .17, .014], [0, 0, s * .32]);
      body.ball(shade(c.outfitColor, 1.3), [-.09 * b, 1.03, front - .002], [.012, .012, .006]);
      if (c.outfit === 'suit') body.box(c.accent, [.11 * b, 1.06, front - .006], [.04, .016, .01]);
      break;
    case 'sailor': {
      const collarColor = c.outfitColor === '#f1efe8' ? '#1f2a4a' : white;
      body.ball(collarColor, [0, 1.15, -.08], [.21 * b, .07, .16]);
      body.ring(c.outfitColor === '#f1efe8' ? white : '#1f2a4a', [0, 1.13, -.07], .17 * b, .006, [Math.PI / 2, 0, 0]);
      body.ball(c.accent === white ? '#c8303a' : c.accent, [0, 1.07, front + .01], [.045, .03, .02]);
      for (const s of [-1, 1]) body.box(c.accent === white ? '#c8303a' : c.accent, [s * .02, 1.0, front + .006], [.03, .1, .01], [0, 0, s * .25]);
      break;
    }
    case 'hoodie':
      body.ring(c.outfitColor, [0, 1.19, -.15], .11, .05, [1.25, 0, 0]);
      for (const s of [-1, 1]) body.limb(white, [s * .035, 1.15, .055], [s * .04, 1.0, front + .004], .005);
      body.box(shade(c.outfitColor, .82), [0, .87, front - .01], [.2 * b, .08, .02]);
      break;
    case 'cardigan':
      shirtPanel(); collar(); buttons(shade(c.outfitColor, .6), .0);
      if (c.accent !== white) body.ball(c.accent, [0, 1.13, front + .004], [.03, .02, .012]);
      break;
    case 'turtleneck':
      body.add(new THREE.CylinderGeometry(.062, .068, .08, 14), c.outfitColor, [0, 1.21, -.06]);
      break;
    case 'sweater':
      collar(); body.ring(shade(c.outfitColor, .8), [0, .79, -.06], .155 * b, .018, [Math.PI / 2, 0, 0]);
      break;
    case 'jacket':
      shirtPanel(c.accent === '#1b1b1f' ? '#d9d6cf' : c.accent);
      for (const s of [-1, 1]) body.box(shade(c.outfitColor, .85), [s * .07 * b, 1.0, front + .002], [.05, .3, .012]);
      body.box('#b9b9b9', [.045 * b, 1.0, front + .01], [.006, .26, .006]);
      break;
    case 'shirt':
      collar(); buttons('#d8d4ca');
      body.box(shade(c.outfitColor, .9), [0, 1.0, front], [.006, .26, .006]);
      break;
  }
}

function buildArm(c: Character) {
  const arm = new Builder();
  arm.limb(c.outfitColor, [0, 0, 0], [.03, -.23, .1], .055);
  arm.limb(c.outfitColor, [.03, -.23, .1], [-.05, -.34, .3], .048);
  arm.ball(c.skin, [-.06, -.35, .335], [.045, .038, .052]);
  return arm.merge();
}

/** Head, hair and headwear — everything that receives the ink outline. */
function buildHead(c: Character) {
  const h = new Builder();
  const hair = c.hair, hairShade = shade(c.hair, .78);
  h.ball(c.skin, [0, .19, 0], [.2, .215, .19]);
  h.ball(c.skin, [0, .105, .035], [.14, .12, .13]);
  for (const s of [-1, 1]) h.ball(c.skin, [s * .195, .16, -.01], [.03, .05, .03]);
  // Hair cap and bangs
  h.ball(hair, [0, .228, -.02], [.218, .205, .205]);
  const bangs = c.hairStyle === 'sidesweep' ? 6 : 11;
  for (let i = 0; i < bangs; i++) {
    const t = i / (bangs - 1) - .5;
    const a = t * 2.1 + (c.hairStyle === 'sidesweep' ? .5 : 0);
    // Locks hug the forehead curve, lengthening toward the temples like real anime fringes.
    const r = .192, x = Math.sin(a) * r, z = Math.cos(a) * r - .012;
    const length = (c.hairStyle === 'bob' ? .12 : .135) + Math.abs(t) * .07 + ((i * 7) % 3) * .012;
    h.spike(i % 3 === 1 ? hairShade : hair, [x, .335, z], [x * .5, -1, z * .32 + .03], .036, length, .45);
  }
  switch (c.hairStyle) {
    case 'spiky':
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, x = Math.sin(a) * .14, z = Math.cos(a) * .12 - .05;
        h.spike(i % 2 ? hair : hairShade, [x, .35, z], [x * 2.2, .9, z * 2 - .25], .055, .15);
      }
      break;
    case 'bob':
      for (const s of [-1, 1]) h.ball(hair, [s * .175, .12, -.01], [.075, .16, .12]);
      h.ball(hair, [0, .12, -.08], [.21, .17, .15]);
      h.ball(hairShade, [0, .255, .16], [.18, .05, .05]);
      break;
    case 'long':
      h.ball(hair, [0, -.04, -.13], [.2, .36, .09]);
      for (const s of [-1, 1]) h.limb(hairShade, [s * .175, .17, .05], [s * .16, -.16, .07], .042);
      break;
    case 'ponytail':
      h.ball(c.accent, [0, .23, -.215], [.035, .035, .03]);
      h.limb(hair, [0, .21, -.24], [0, -.12, -.32], .065);
      h.spike(hairShade, [0, -.16, -.33], [0, -1, -.2], .055, .12);
      break;
    case 'twintails':
      for (const s of [-1, 1]) {
        h.ball(c.accent, [s * .175, .27, -.06], [.032, .032, .032]);
        h.limb(hair, [s * .2, .25, -.07], [s * .27, -.18, -.05], .06);
        h.spike(hairShade, [s * .275, -.22, -.05], [s * .1, -1, 0], .05, .12);
      }
      break;
    case 'bun':
      h.ball(hair, [0, .4, -.07], [.09, .085, .09]);
      h.ring(c.accent, [0, .36, -.06], .055, .012, [Math.PI / 2, 0, 0]);
      break;
    case 'messy':
      for (let i = 0; i < 10; i++) {
        const a = i * 2.39, r = .12 + (i % 3) * .02;
        h.ball(i % 2 ? hair : hairShade, [Math.sin(a) * r, .36 + (i % 4) * .015, Math.cos(a) * r - .05], [.08, .05, .07], [i * .3, a, 0]);
      }
      break;
    case 'sidesweep':
      h.ball(hair, [-.06, .27, .15], [.17, .065, .07], [0, 0, .38]);
      h.limb(hairShade, [.175, .18, .04], [.165, -.05, .06], .04);
      break;
  }
  if (c.ahoge) h.spike(hair, [0, .42, .01], [.3, 1, .5], .014, .13);
  // Headwear
  switch (c.accessory) {
    case 'glasses':
    case 'roundGlasses': {
      const frame = c.accessory === 'glasses' ? '#202024' : '#c9a24a';
      for (const s of [-1, 1]) {
        if (c.accessory === 'glasses') {
          h.box(frame, [s * .072, .195, .195], [.07, .006, .008], [0, s * .35, 0]).box(frame, [s * .072, .14, .195], [.07, .006, .008], [0, s * .35, 0]);
          h.box(frame, [s * .106, .167, .185], [.006, .06, .008], [0, s * .35, 0]).box(frame, [s * .039, .167, .2], [.006, .06, .008], [0, s * .35, 0]);
        } else h.ring(frame, [s * .072, .165, .192], .038, .005, [0, s * .35, 0]);
        h.box(frame, [s * .16, .17, .06], [.006, .006, .2], [0, s * .25, 0]);
      }
      h.box(frame, [0, .17, .2], [.034, .006, .006]);
      break;
    }
    case 'catEars':
      for (const s of [-1, 1]) {
        h.spike(hairShade, [s * .12, .37, -.02], [s * .45, 1, 0], .06, .11);
        h.spike('#f3a7b8', [s * .122, .375, .004], [s * .45, 1, 0], .03, .07);
      }
      break;
    case 'beanie':
      h.ball(c.accent === '#f2f0ea' ? '#2f3a4f' : c.accent, [0, .31, -.02], [.226, .17, .216]);
      h.ring(shade(c.accent === '#f2f0ea' ? '#2f3a4f' : c.accent, .8), [0, .245, -.02], .205, .03, [Math.PI / 2, 0, 0]);
      break;
    case 'hairClip':
      for (const dz of [0, .025]) h.box(c.accent, [.13, .31, .12 + dz], [.05, .011, .011], [0, .5, .55]);
      break;
    case 'ribbon':
      for (const s of [-1, 1]) h.ball(c.accent, [s * .05, .36, -.15], [.055, .035, .018], [0, 0, s * .4]);
      h.ball(shade(c.accent, .8), [0, .36, -.15], [.02, .02, .02]);
      break;
  }
  return h.merge();
}

/** Brows, nose, mouth and blush — painted on, so they skip the outline pass. */
function buildFace(c: Character) {
  const f = new Builder();
  const brow = shade(c.hair, c.hair === '#f4f1ea' || c.hair === '#d7d9e4' ? .65 : .7);
  for (const s of [-1, 1]) {
    f.box(brow, [s * .074, .232, .184], [.055, .009, .008], [0, s * .38, s * -.12]);
    f.ball('#f39aa7', [s * .1, .118, .168], [.03, .012, .005], [0, s * .5, 0]);
  }
  f.ball(shade(c.skin, .88), [0, .132, .19], [.009, .012, .008]);
  if (c.mouth === 'smile') f.ring('#7a2f35', [0, .093, .177], .02, .0045, [0, 0, Math.PI], Math.PI);
  else if (c.mouth === 'open') f.ball('#6a2430', [0, .086, .175], [.017, .013, .006]).ball('#e0707c', [0, .081, .178], [.01, .005, .004]);
  else f.box('#7a2f35', [0, .088, .178], [.026, .005, .006]);
  return f.merge();
}

/** Big glossy anime eyes, built around the eye line so blinking is a y-scale. */
function buildEyes(c: Character) {
  const eyes: THREE.BufferGeometry[] = [];
  const es = c.eyeSize, dark = shade(c.eyes, .55), light = shade(c.eyes, 1.25);
  for (const s of [-1, 1]) {
    const frame = new THREE.Matrix4().compose(new THREE.Vector3(s * .072, 0, .172), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * .4, 0)), new THREE.Vector3(1, 1, 1));
    const e = new Builder(frame);
    e.ball('#ffffff', [0, 0, 0], [.044 * es, .054 * es, .012]);
    e.ball(c.eyes, [0, -.004, .004], [.033 * es, .046 * es, .012]);
    e.ball(dark, [0, .014 * es, .007], [.032 * es, .022 * es, .011]);
    e.ball(light, [0, -.026 * es, .007], [.022 * es, .012 * es, .01]);
    e.ball('#16121b', [0, -.002, .009], [.014 * es, .023 * es, .011]);
    e.ball('#ffffff', [.012 * es, .017 * es, .012], [.011, .011, .01]);
    e.ball('#ffffff', [-.012 * es, -.018 * es, .011], [.005, .005, .008]);
    e.box('#19131a', [s * .004, .05 * es, .007], [.098 * es, .013, .012], [0, 0, s * -.16]);
    e.box('#19131a', [s * .052 * es, .04 * es, .004], [.024, .009, .01], [0, 0, s * -.65]);
    eyes.push(...e.parts);
  }
  const merged = mergeGeometries(eyes, false)!;
  eyes.forEach(g => g.dispose());
  return merged;
}

const cache = new Map<number, PersonParts>();
export function personParts(index: number, c: Character): PersonParts {
  let parts = cache.get(index);
  if (!parts) {
    const b = c.build;
    parts = { body: buildBody(c, b), arm: buildArm(c), head: buildHead(c), face: buildFace(c), eyes: buildEyes(c), shoulder: [.2 * b, 1.11, -.06], neck: [0, 1.29, -.06], eyeLine: .165 };
    cache.set(index, parts);
  }
  return parts;
}

/** Three-band ramp for crisp cel shading. */
const ramp = new THREE.DataTexture(new Uint8Array([118, 118, 118, 255, 196, 196, 196, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.generateMipmaps = false;
ramp.needsUpdate = true;
export const toonMaterial = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });

/** Inverted-hull ink outline: back faces pushed out along their normals. */
export const outlineMaterial = new THREE.MeshBasicMaterial({ color: '#140d12', side: THREE.BackSide });
outlineMaterial.onBeforeCompile = shader => {
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * 0.0075;');
};
outlineMaterial.customProgramCacheKey = () => 'podium-outline';

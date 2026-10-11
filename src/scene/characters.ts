/**
 * Deterministic anime audience generator. Pure data (no three.js) so it can be unit-tested:
 * every seat index maps to one character, and no two seats share a look.
 */
export type HairStyle = 'spiky' | 'bob' | 'long' | 'ponytail' | 'twintails' | 'bun' | 'messy' | 'sidesweep';
export type Outfit = 'blazer' | 'sailor' | 'hoodie' | 'suit' | 'cardigan' | 'turtleneck' | 'sweater' | 'jacket' | 'shirt';
export type Accessory = 'none' | 'glasses' | 'roundGlasses' | 'catEars' | 'headphones' | 'beanie' | 'hairClip' | 'ribbon';
export type Mouth = 'smile' | 'neutral' | 'open';

export type Character = {
  hairStyle: HairStyle;
  hair: string;
  eyes: string;
  skin: string;
  outfit: Outfit;
  outfitColor: string;
  accent: string;
  bottoms: 'trousers' | 'skirt';
  bottomsColor: string;
  accessory: Accessory;
  mouth: Mouth;
  ahoge: boolean;
  build: number;
  eyeSize: number;
};

export const hairStyles: HairStyle[] = ['spiky', 'bob', 'long', 'ponytail', 'twintails', 'bun', 'messy', 'sidesweep'];
const hairColors = ['#1d1b24', '#3b2a22', '#6b3f26', '#e8c872', '#d7d9e4', '#f2a7c3', '#a993d8', '#3fa7a3', '#2c3f78', '#b8322f', '#f4f1ea', '#9bd8b9', '#e8813a', '#5a5f6b'];
const eyeColors = ['#4a8fe0', '#2fb89a', '#c0392b', '#8e5bd6', '#e0a224', '#3f6d3a', '#d0598c', '#6c4a2e', '#28a0d6', '#9aa3b5'];
const skinTones = ['#ffe3cf', '#f6cfb0', '#ecbb93', '#d79f74', '#b27a52', '#8a5638'];
const outfits: Outfit[] = ['blazer', 'sailor', 'hoodie', 'suit', 'cardigan', 'turtleneck', 'sweater', 'jacket', 'shirt'];
const outfitColors: Record<Outfit, string[]> = {
  blazer: ['#1f2a4a', '#5b1f2b', '#2f3b2c', '#3a3a40'],
  sailor: ['#f1efe8', '#1f2a4a', '#2a2a30'],
  hoodie: ['#c9566b', '#4b6fb0', '#e7d9b8', '#3c3c44', '#6aa37f'],
  suit: ['#22252c', '#3b4252', '#4a3a2e'],
  cardigan: ['#c9a66b', '#7d8fa6', '#a35a58', '#e2dccd'],
  turtleneck: ['#1c1c20', '#e9e4d6', '#5e4a6e', '#8a3b2f'],
  sweater: ['#5a7c99', '#d18b4a', '#7a5c8e', '#bfc6a2', '#9e2f3a'],
  jacket: ['#4b5d3a', '#2c3e57', '#7a4b2a', '#1e1e22'],
  shirt: ['#f2f0ea', '#b9d3e8', '#f0d9e0', '#d9e8c9'],
};
const accents = ['#c8303a', '#e6c14a', '#2d63c8', '#f2f0ea', '#1b1b1f', '#d8689a', '#3aa37a'];
const accessories: Accessory[] = ['none', 'glasses', 'none', 'catEars', 'roundGlasses', 'headphones', 'none', 'beanie', 'hairClip', 'ribbon'];
const mouths: Mouth[] = ['smile', 'neutral', 'smile', 'open'];

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(list: readonly T[], r: () => number) => list[Math.floor(r() * list.length)];

function roll(index: number, attempt: number): Character {
  const r = rng(index * 9973 + attempt * 7919 + 17);
  // Hair style and outfit cycle on coprime periods so neighbours always differ.
  const hairStyle = hairStyles[(index + attempt) % hairStyles.length];
  const outfit = outfits[(index * 4 + attempt) % outfits.length];
  const skirtFriendly = ['bob', 'long', 'ponytail', 'twintails', 'bun'].includes(hairStyle);
  const bottoms = (outfit === 'sailor' || (skirtFriendly && r() > .45)) && outfit !== 'suit' ? 'skirt' : 'trousers';
  const accessory = pick(accessories, r);
  return {
    hairStyle,
    hair: hairColors[(index * 5 + Math.floor(r() * 3) + attempt) % hairColors.length],
    eyes: pick(eyeColors, r),
    skin: pick(skinTones, r),
    outfit,
    outfitColor: pick(outfitColors[outfit], r),
    accent: pick(accents, r),
    bottoms,
    bottomsColor: pick(['#23252d', '#3a3f4f', '#4a3a30', '#2b2f3a', '#56483c', '#1f2a4a'], r),
    // Beanies need a short crop underneath; long styles keep their hair visible.
    accessory: accessory === 'beanie' && !['spiky', 'messy', 'bob'].includes(hairStyle) ? 'hairClip' : accessory,
    mouth: pick(mouths, r),
    ahoge: r() > .72,
    build: .88 + r() * .24,
    eyeSize: .92 + r() * .18,
  };
}

/** The visual signature two seats must not share. */
export const signature = (c: Character) => [c.hairStyle, c.hair, c.outfit, c.outfitColor, c.accessory, c.eyes].join('|');

export function buildCrowd(count = 72): Character[] {
  const seen = new Set<string>();
  return Array.from({ length: count }, (_, index) => {
    for (let attempt = 0; ; attempt++) {
      const character = roll(index, attempt);
      const key = signature(character);
      if (!seen.has(key)) { seen.add(key); return character; }
    }
  });
}

export const crowd = buildCrowd(72);

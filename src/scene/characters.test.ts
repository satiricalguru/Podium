import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCrowd, hairStyles, signature } from './characters';

test('every seat in a full house gets a distinct character', () => {
  const crowd = buildCrowd(72);
  assert.equal(new Set(crowd.map(signature)).size, 72);
});

test('generation is deterministic so the room looks the same on every visit', () => {
  assert.deepEqual(buildCrowd(24), buildCrowd(72).slice(0, 24));
});

test('the room mixes every hair style and no two neighbours share one', () => {
  const crowd = buildCrowd(72);
  assert.equal(new Set(crowd.map(c => c.hairStyle)).size, hairStyles.length);
  for (let i = 1; i < crowd.length; i++) assert.notEqual(crowd[i].hairStyle, crowd[i - 1].hairStyle);
});

test('beanies only sit on short hair and sailor uniforms come with skirts', () => {
  for (const c of buildCrowd(72)) {
    if (c.accessory === 'beanie') assert.ok(['spiky', 'messy', 'bob'].includes(c.hairStyle));
    if (c.outfit === 'sailor') assert.equal(c.bottoms, 'skirt');
  }
});

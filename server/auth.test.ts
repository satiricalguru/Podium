import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { UserStore, hashPassword, readCookie, registerSchema, signToken, verifyPassword, verifyToken } from './auth';

test('passwords verify only with the original secret', async () => {
  const stored = await hashPassword('correct horse battery');
  assert.equal(await verifyPassword('correct horse battery', stored), true);
  assert.equal(await verifyPassword('correct horse battery!', stored), false);
});

test('session tokens reject tampering, foreign secrets and expiry', () => {
  const token = signToken('secret-a', 'user-1', 1_000);
  assert.equal(verifyToken('secret-a', token, 2_000), 'user-1');
  assert.equal(verifyToken('secret-b', token, 2_000), null);
  const [payload, signature] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ uid: 'admin', exp: 9e15 })).toString('base64url');
  assert.equal(verifyToken('secret-a', `${forged}.${signature}`, 2_000), null);
  assert.equal(verifyToken('secret-a', `${payload}.${signature}.x`, 2_000), null);
  assert.equal(verifyToken('secret-a', token, 1_000 + 31 * 864e5), null);
  assert.equal(verifyToken('secret-a', undefined), null);
});

test('cookie parsing finds the named cookie only', () => {
  assert.equal(readCookie('a=1; podium_session=abc.def%3D; b=2', 'podium_session'), 'abc.def=');
  assert.equal(readCookie('podium_sessionx=1', 'podium_session'), undefined);
});

test('registration input is normalised and validated', () => {
  assert.equal(registerSchema.parse({ name: ' Ada ', email: ' ADA@Example.com ', password: '12345678' }).email, 'ada@example.com');
  assert.equal(registerSchema.safeParse({ name: 'Ada', email: 'nope', password: '12345678' }).success, false);
  assert.equal(registerSchema.safeParse({ name: 'Ada', email: 'a@b.co', password: 'short' }).success, false);
});

test('user store persists accounts without plaintext passwords and blocks duplicates', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'podium-auth-'));
  try {
    const store = new UserStore(dir);
    const user = await store.create({ name: 'Ada', email: 'ada@example.com', password: 'rehearse-daily' });
    assert.ok(user);
    assert.equal(await store.create({ name: 'Ada 2', email: 'ada@example.com', password: 'rehearse-daily' }), null);
    const raw = readFileSync(path.join(dir, 'users.json'), 'utf8');
    assert.equal(raw.includes('rehearse-daily'), false);
    const reloaded = new UserStore(dir);
    assert.equal(reloaded.byEmail('ADA@example.com')?.id, user.id);
    assert.equal(reloaded.secret, store.secret);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

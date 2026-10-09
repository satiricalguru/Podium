import { createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const COOKIE = 'podium_session';
export const SESSION_DAYS = 30;

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Tell us what to call you.').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(160),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(160),
  password: z.string().min(1, 'Enter your password.').max(200),
});

export type StoredUser = { id: string; name: string; email: string; salt: string; hash: string; createdAt: string };
export type PublicUser = { id: string; name: string; email: string; createdAt: string };
export const publicUser = ({ id, name, email, createdAt }: StoredUser): PublicUser => ({ id, name, email, createdAt });

export async function hashPassword(password: string, salt = randomBytes(16)) {
  const hash = await scrypt(password, salt, 64);
  return { salt: salt.toString('base64'), hash: hash.toString('base64') };
}

export async function verifyPassword(password: string, user: Pick<StoredUser, 'salt' | 'hash'>) {
  const expected = Buffer.from(user.hash, 'base64');
  const actual = await scrypt(password, Buffer.from(user.salt, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

/** Stateless session token: base64url(payload).hmac — no server-side session table needed. */
export function signToken(secret: string, uid: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ uid, exp: now + SESSION_DAYS * 864e5 })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

export function verifyToken(secret: string, token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(createHmac('sha256', secret).update(payload).digest('base64url'));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { uid?: unknown; exp?: unknown };
    return typeof data.uid === 'string' && typeof data.exp === 'number' && data.exp > now ? data.uid : null;
  } catch { return null; }
}

export function readCookie(header: string | undefined, name: string) {
  for (const part of header?.split(';') ?? []) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/** Tiny JSON-file user store. Writes are serialised and atomic (temp file + rename). */
export class UserStore {
  private users: StoredUser[] = [];
  private queue: Promise<void> = Promise.resolve();
  readonly secret: string;
  constructor(private dir: string, secret?: string) {
    mkdirSync(dir, { recursive: true });
    const file = this.file;
    if (existsSync(file)) {
      try { this.users = z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), salt: z.string(), hash: z.string(), createdAt: z.string() })).parse(JSON.parse(readFileSync(file, 'utf8'))); }
      catch { throw new Error(`Podium could not read ${file}. Fix or remove it, then restart.`); }
    }
    this.secret = secret || this.loadSecret();
  }
  private get file() { return path.join(this.dir, 'users.json'); }
  private loadSecret() {
    const file = path.join(this.dir, '.session-secret');
    if (existsSync(file)) return readFileSync(file, 'utf8').trim();
    const secret = randomBytes(32).toString('base64url');
    writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
  byEmail(email: string) { return this.users.find(u => u.email === email.toLowerCase()); }
  byId(id: string) { return this.users.find(u => u.id === id); }
  async create(input: z.infer<typeof registerSchema>) {
    const user: StoredUser = { id: randomUUID(), name: input.name, email: input.email, createdAt: new Date().toISOString(), ...(await hashPassword(input.password)) };
    // Re-check after the async hash so two simultaneous sign-ups cannot claim one email.
    if (this.byEmail(input.email)) return null;
    this.users.push(user);
    await this.persist();
    return user;
  }
  private persist() {
    const snapshot = JSON.stringify(this.users, null, 2);
    this.queue = this.queue.then(async () => {
      const temp = `${this.file}.${process.pid}.tmp`;
      await writeFile(temp, snapshot, { mode: 0o600 });
      await rename(temp, this.file);
    });
    return this.queue;
  }
}

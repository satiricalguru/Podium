import { z } from 'zod';
import type { Report } from './types';

const reportSchema = z.object({
  id: z.string(), date: z.string(),
  config: z.object({ scenario: z.string(), topic: z.string(), audience: z.number(), temperament: z.enum(['supportive', 'neutral', 'challenging']), duration: z.number(), mode: z.enum(['voice', 'typed']) }),
  metrics: z.object({ words: z.number(), fillers: z.number(), pace: z.number().nullable(), seconds: z.number(), mode: z.enum(['voice', 'typed']) }),
  transcript: z.string(), engagement: z.number(),
  feedback: z.object({ strength: z.string(), improvement: z.string(), question: z.string() }),
  source: z.enum(['local', 'gemini']),
});

const LEGACY_KEY = 'podium.sessions.v1';
/** History is namespaced per account so people sharing a browser don't see each other's sessions. */
const keyFor = (userId: string) => `${LEGACY_KEY}:${userId}`;

export function loadHistory(userId: string): Report[] {
  try {
    // Sessions saved before accounts existed belong to the guest studio.
    const raw = localStorage.getItem(keyFor(userId)) ?? (userId === 'guest' ? localStorage.getItem(LEGACY_KEY) : null);
    const data: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(data)) return [];
    return data.slice(0, 20).flatMap(item => { const result = reportSchema.safeParse(item); return result.success ? [result.data] : []; });
  } catch { return []; }
}

export function saveHistory(userId: string, reports: Report[]) {
  try { localStorage.setItem(keyFor(userId), JSON.stringify(reports.slice(0, 20))); return true; }
  catch { return false; }
}

import type { InputMode, Metrics, Reaction, Temperament } from './analysis';
export type SessionStatus = 'ready' | 'running' | 'paused' | 'completed';
export type PracticeConfig = { scenario: string; topic: string; audience: number; temperament: Temperament; duration: number; mode: InputMode };
export type Direction = { model?: string; engagement: number; reaction: Reaction; cue: string; question: string; strength: string; improvement: string };
export type Report = { id: string; date: string; config: PracticeConfig; metrics: Metrics; transcript: string; engagement: number; feedback: { strength: string; improvement: string; question: string }; source: 'local' | 'gemini' };
export interface RecognitionResultEvent { resultIndex: number; results: { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } } } }
export interface Recognition { continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: RecognitionResultEvent) => void) | null; onerror: ((e: {error: string}) => void) | null; onend: (() => void) | null; start: () => void; abort: () => void }
declare global { interface Window { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition; } }

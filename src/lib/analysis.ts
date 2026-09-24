export type Temperament = 'supportive' | 'neutral' | 'challenging';
export type InputMode = 'voice' | 'typed';
export type Reaction = 'engaged' | 'curious' | 'distracted';
export const wordsOf = (text: string) => text.trim().match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu) ?? [];
export function analyze(text: string, seconds: number, mode: InputMode) {
  const words = wordsOf(text).length;
  const fillers = (text.match(/\b(um+|uh+|erm|hmm|you know|sort of|kind of)\b/gi) ?? []).length;
  const pace = mode === 'voice' && seconds >= 15 && words >= 5 ? Math.round(words / (seconds / 60)) : null;
  return { words, fillers, pace, seconds: Math.round(seconds), mode };
}
export type Metrics = ReturnType<typeof analyze>;
export const baseline = (mood: Temperament) => ({ supportive: 78, neutral: 65, challenging: 52 })[mood];
export function localAudience(metrics: Metrics, mood: Temperament): {engagement: number; reaction: Reaction; cue: string} {
  let score = baseline(mood);
  if (metrics.words > 10) score += 6;
  if (metrics.words > 40) score += 5;
  if (metrics.pace !== null) score += metrics.pace >= 105 && metrics.pace <= 175 ? 8 : -8;
  if (metrics.words > 20) score -= Math.min(15, Math.round(metrics.fillers / metrics.words * 100));
  const engagement = Math.max(30, Math.min(94, score));
  const reaction = engagement > 72 ? 'engaged' : engagement > 54 ? 'curious' : 'distracted';
  const cue = metrics.words === 0 ? 'The room is yours. Take a breath, then begin.' : metrics.pace !== null && metrics.pace > 175 ? 'Give your ideas room. Try a pause after your next point.' : metrics.pace !== null && metrics.pace < 105 ? 'Try connecting your next two ideas in one clear sentence.' : metrics.fillers > 3 ? 'A quiet pause can replace a filler word.' : 'Make your next point concrete with an example.';
  return { engagement, reaction, cue };
}
export function localFeedback(metrics: Metrics, topic: string) {
  if (!metrics.words) return { strength: 'You made space to practise. Your next session can start with a single sentence.', improvement: `Introduce “${topic}” with a clear main idea, then add one example.`, question: 'What is the one idea you want us to remember?' };
  return {
    strength: metrics.words >= 50 ? `You developed ${metrics.words} words of material to work with.` : `You started your rehearsal with ${metrics.words} words. Keep building on that opening.`,
    improvement: metrics.pace !== null && metrics.pace > 175 ? 'Slow the transitions. Leave a two-second pause after your main point.' : metrics.fillers > 2 ? `Try replacing one of your ${metrics.fillers} detected filler phrases with a deliberate pause.` : 'Repeat your opening with a specific example and finish with a clear takeaway.',
    question: `What would be a practical first step for someone listening to your talk about ${topic.toLowerCase()}?`,
  };
}
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

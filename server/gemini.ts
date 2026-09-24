import { ThinkingLevel, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
export type Generate = (request: GenerateContentParameters) => Promise<GenerateContentResponse>;
// Both routes have free-tier text input/output. Never select an unverified paid fallback.
export async function generateWithFreeFallback(generate: Generate, primary: string, request: Omit<GenerateContentParameters, 'model'>) {
  const run = (model: string, timeout: number) => generate({
    ...request, model,
    config: {
      ...request.config,
      httpOptions: { ...request.config?.httpOptions, timeout },
      thinkingConfig: model.startsWith('gemini-3') ? { thinkingLevel: ThinkingLevel.LOW } : model === 'gemini-2.5-flash' ? { thinkingBudget: 0 } : undefined,
    },
  });
  try { return { response: await run(primary, 12000), model: primary }; }
  catch (error) {
    const status = (error as { status?: number }).status;
    if (primary !== 'gemini-3.8-flash' || ![429, 503, 504].includes(status ?? 0)) throw error;
    return { response: await run('gemini-2.5-flash', 8000), model: 'gemini-2.5-flash' };
  }
}

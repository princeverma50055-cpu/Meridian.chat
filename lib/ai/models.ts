/**
 * Maps the UI-facing model ids (what the ModelSelector shows) to real
 * provider model strings. Overridable via env so you can point at a
 * different snapshot without touching code.
 */
export const MODEL_MAP: Record<string, string> = {
  'meridian-fast': process.env.MERIDIAN_MODEL_FAST ?? 'claude-sonnet-5',
  'meridian-reasoning': process.env.MERIDIAN_MODEL_REASONING ?? 'claude-opus-4-8',
  'meridian-lite': process.env.MERIDIAN_MODEL_LITE ?? 'claude-haiku-4-5-20251001'
};

export function resolveModel(uiModelId: string): string {
  const resolved = MODEL_MAP[uiModelId];
  if (!resolved) {
    throw new Error(`Unknown model id "${uiModelId}". Add it to MODEL_MAP in lib/ai/models.ts.`);
  }
  return resolved;
}

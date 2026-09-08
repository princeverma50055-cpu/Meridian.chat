/**
 * Maps the UI-facing model ids (what the ModelSelector shows) to real
 * provider model strings. Which map is used depends on MERIDIAN_MODEL_PROVIDER,
 * so switching providers in .env doesn't require touching the UI.
 */

const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  'meridian-fast': process.env.MERIDIAN_MODEL_FAST ?? 'claude-sonnet-5',
  'meridian-reasoning': process.env.MERIDIAN_MODEL_REASONING ?? 'claude-opus-4-8',
  'meridian-lite': process.env.MERIDIAN_MODEL_LITE ?? 'claude-haiku-4-5-20251001'
};

// Current as of Aug 2026 — Google retires Gemini models on a few months'
// notice, so if these start 404'ing, check https://ai.google.dev/gemini-api/docs/models
//
// IMPORTANT — free-tier daily quota varies a LOT by model:
//   gemini-3.6-flash        ~20 requests/day  (too low for a real chat app)
//   gemini-3.1-flash-lite   ~1,000+ requests/day (much better for many users)
//   gemini-3.1-pro          paid tier only — Google removed Pro from the
//                           free tier in 2026, so "Meridian Reasoning" will
//                           always need billing enabled on the Google Cloud
//                           project this API key belongs to.
//
// "meridian-fast" defaults to the Flash-Lite model specifically so a fresh
// setup with no .env overrides doesn't immediately hit a ~20/day wall.
const GOOGLE_MODEL_MAP: Record<string, string> = {
  'meridian-fast': process.env.MERIDIAN_MODEL_FAST ?? 'gemini-3.1-flash-lite',
  'meridian-reasoning': process.env.MERIDIAN_MODEL_REASONING ?? 'gemini-3.1-pro',
  'meridian-lite': process.env.MERIDIAN_MODEL_LITE ?? 'gemini-3.1-flash-lite'
};

export function resolveModel(uiModelId: string): string {
  const provider = process.env.MERIDIAN_MODEL_PROVIDER;
  const map = provider === 'google' ? GOOGLE_MODEL_MAP : ANTHROPIC_MODEL_MAP;

  const resolved = map[uiModelId];
  if (!resolved) {
    throw new Error(
      `Unknown model id "${uiModelId}" for provider "${provider}". Add it to the relevant map in lib/ai/models.ts.`
    );
  }
  return resolved;
}

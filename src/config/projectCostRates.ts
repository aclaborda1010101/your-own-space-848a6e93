// ── Project Cost Rates & Calculator ─────────────────────────────────────────
// Rates per million tokens (USD). Updated Feb 2026.

export interface CostRate {
  inputPerMillion: number;
  outputPerMillion: number;
}

export const RATES: Record<string, CostRate> = {
  "gemini-flash": { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  "gemini-pro": { inputPerMillion: 1.25, outputPerMillion: 5.00 },
  "claude-sonnet": { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  "claude-haiku": { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  "whisper": { inputPerMillion: 0, outputPerMillion: 0 }, // Whisper charges per minute
  "gpt-5": { inputPerMillion: 2.50, outputPerMillion: 10.00 },
  "deepseek-v3": { inputPerMillion: 0.27, outputPerMillion: 1.10 },
};

// Whisper: $0.006 per minute of audio
export const WHISPER_RATE_PER_MINUTE = 0.006;

/**
 * Calculate cost in USD for a token-based API call.
 */
export function calculateTokenCost(
  service: string,
  tokensInput: number,
  tokensOutput: number
): number {
  const rate = RATES[service];
  if (!rate) return 0;
  return (tokensInput / 1_000_000) * rate.inputPerMillion +
         (tokensOutput / 1_000_000) * rate.outputPerMillion;
}

/**
 * Calculate cost for audio transcription (Whisper).
 */
export function calculateWhisperCost(durationMinutes: number): number {
  return durationMinutes * WHISPER_RATE_PER_MINUTE;
}

/**
 * Format cost for display (EUR ≈ USD for simplicity).
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.01) return `€${costUsd.toFixed(4)}`;
  return `€${costUsd.toFixed(2)}`;
}

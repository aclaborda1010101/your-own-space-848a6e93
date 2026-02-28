// ── Shared Cost Tracker for all Edge Functions ──────────────────────────
// Centralized rates and recording logic for project_costs table.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CostRate {
  inputPerMillion: number;
  outputPerMillion: number;
}

// Rates per million tokens (USD). Updated Feb 2026.
export const MODEL_RATES: Record<string, CostRate> = {
  "gemini-2.5-flash":   { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  "gemini-flash":       { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  "gemini-2.5-pro":     { inputPerMillion: 1.25,  outputPerMillion: 5.00 },
  "gemini-pro":         { inputPerMillion: 1.25,  outputPerMillion: 5.00 },
  "claude-sonnet-4-20250514": { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  "claude-sonnet":      { inputPerMillion: 3.00,  outputPerMillion: 15.00 },
  "claude-haiku":       { inputPerMillion: 0.25,  outputPerMillion: 1.25 },
  "gpt-4o":             { inputPerMillion: 2.50,  outputPerMillion: 10.00 },
  "whisper-large-v3":   { inputPerMillion: 0,     outputPerMillion: 0 },
  "sonar-pro":          { inputPerMillion: 3.00,  outputPerMillion: 15.00 },
};

// Whisper: $0.006 per minute of audio (Groq free tier, but tracking for visibility)
export const WHISPER_RATE_PER_MINUTE = 0.006;

/**
 * Estimate token count from text (~4 chars per token).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Calculate cost in USD from token counts and model.
 */
export function calculateCost(model: string, tokensInput: number, tokensOutput: number): number {
  const rate = MODEL_RATES[model] || MODEL_RATES["gemini-flash"];
  return (tokensInput / 1_000_000) * rate.inputPerMillion +
         (tokensOutput / 1_000_000) * rate.outputPerMillion;
}

export interface RecordCostParams {
  userId?: string;
  service: string;        // model name
  operation: string;      // edge function name or action
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  projectId?: string;
  stepNumber?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Record AI cost to project_costs table. Fire-and-forget safe.
 */
export async function recordCost(
  supabaseOrNull: ReturnType<typeof createClient> | null,
  params: RecordCostParams
): Promise<void> {
  try {
    const supabase = supabaseOrNull || createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.from("project_costs").insert({
      user_id: params.userId || null,
      project_id: params.projectId || null,
      step_number: params.stepNumber || null,
      service: params.service,
      operation: params.operation,
      tokens_input: params.tokensInput,
      tokens_output: params.tokensOutput,
      api_calls: 1,
      cost_usd: params.costUsd,
      metadata: params.metadata || {},
    });

    if (error) {
      console.error("[cost-tracker] Insert error:", error.message);
    }
  } catch (err) {
    console.error("[cost-tracker] recordCost failed:", err);
  }
}

/**
 * Quick helper: estimate tokens, calculate cost, and record — all in one call.
 * Use when you only have input/output text, not actual token counts.
 */
export async function trackAICost(
  supabase: ReturnType<typeof createClient> | null,
  opts: {
    userId?: string;
    model: string;
    operation: string;
    inputText: string;
    outputText: string;
    projectId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const tokensInput = estimateTokens(opts.inputText);
  const tokensOutput = estimateTokens(opts.outputText);
  const costUsd = calculateCost(opts.model, tokensInput, tokensOutput);

  await recordCost(supabase, {
    userId: opts.userId,
    service: opts.model,
    operation: opts.operation,
    tokensInput,
    tokensOutput,
    costUsd,
    projectId: opts.projectId,
    metadata: opts.metadata,
  });
}

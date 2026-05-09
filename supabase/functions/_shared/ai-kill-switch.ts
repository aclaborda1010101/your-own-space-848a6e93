// Kill-switch + rate-limit check for AI calls.
// Read-through cached for 30s to avoid hammering the DB on every call.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SwitchEntry {
  paused: boolean;
  max_per_hour: number | null;
}

const CACHE_TTL_MS = 30_000;
let cache: { at: number; map: Record<string, SwitchEntry> } = { at: 0, map: {} };

async function loadSwitches(): Promise<Record<string, SwitchEntry>> {
  if (Date.now() - cache.at < CACHE_TTL_MS) return cache.map;
  try {
    const supabase: any = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data } = await supabase
      .from("ai_kill_switch")
      .select("operation, paused, max_per_hour");
    const map: Record<string, SwitchEntry> = {};
    (data || []).forEach((r: any) => {
      map[r.operation] = { paused: !!r.paused, max_per_hour: r.max_per_hour };
    });
    cache = { at: Date.now(), map };
    return map;
  } catch (err) {
    console.warn("[ai-kill-switch] load failed:", err);
    return cache.map;
  }
}

/**
 * Throws Error("AI_PAUSED: …") if the operation (or the global '*') is paused
 * or if it has exceeded its max_per_hour quota.
 */
export async function assertAIAllowed(operation: string, userId?: string): Promise<void> {
  const map = await loadSwitches();

  // Global emergency switch
  if (map["*"]?.paused) {
    throw new Error("AI_PAUSED: pausa global de IA activa. Desactívala en /ai-costs.");
  }

  const entry = map[operation];
  if (!entry) return;

  if (entry.paused) {
    throw new Error(`AI_PAUSED: la operación '${operation}' está pausada.`);
  }

  if (entry.max_per_hour && entry.max_per_hour > 0) {
    try {
      const supabase: any = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      let q = supabase
        .from("project_costs")
        .select("id", { count: "exact", head: true })
        .eq("operation", operation)
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
      if (userId) q = q.eq("user_id", userId);
      const { count } = await q;
      if ((count || 0) >= entry.max_per_hour) {
        throw new Error(
          `AI_PAUSED: '${operation}' ha alcanzado el máximo de ${entry.max_per_hour} llamadas/hora.`
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("AI_PAUSED")) throw err;
      console.warn("[ai-kill-switch] rate-limit check failed:", err);
    }
  }
}

export function isAIPausedError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith("AI_PAUSED");
}

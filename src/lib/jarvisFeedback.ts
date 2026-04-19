import { supabase } from "@/integrations/supabase/client";

export type FeedbackType =
  | "suggestion_accept"
  | "suggestion_reject"
  | "classification_correct"
  | "priority_change";

export interface RecordFeedbackInput {
  userId: string;
  feedbackType: FeedbackType;
  suggestionType?: string | null;
  sourceId?: string | null;
  initialConfidence?: number | null;
  initialValue?: Record<string, any> | null;
  correctedValue?: Record<string, any> | null;
  context?: Record<string, any> | null;
}

/**
 * Persist a feedback event for JARVIS continuous learning. Fire-and-forget;
 * failures are logged but never block the UX.
 */
export async function recordFeedback(input: RecordFeedbackInput): Promise<void> {
  try {
    await supabase.from("jarvis_feedback").insert({
      user_id: input.userId,
      feedback_type: input.feedbackType,
      suggestion_type: input.suggestionType ?? null,
      source_id: input.sourceId ?? null,
      initial_confidence: input.initialConfidence ?? null,
      initial_value: input.initialValue ?? null,
      corrected_value: input.correctedValue ?? null,
      context: input.context ?? null,
    });

    // Refresh aggregated health for this suggestion type (best-effort)
    if (
      input.suggestionType &&
      (input.feedbackType === "suggestion_accept" || input.feedbackType === "suggestion_reject")
    ) {
      await supabase.rpc("refresh_jarvis_suggestion_health" as any, {
        p_user_id: input.userId,
        p_suggestion_type: input.suggestionType,
      });
    }

    // Pattern detection for priority escalations
    if (input.feedbackType === "priority_change") {
      await detectPriorityPattern(input);
    }

    // Pattern detection for classification corrections
    if (input.feedbackType === "classification_correct") {
      await detectClassificationPattern(input);
    }
  } catch (e) {
    console.warn("[jarvisFeedback] failed to record:", e);
  }
}

const PRIORITY_RANK: Record<string, number> = { P3: 0, P2: 1, P1: 2, P0: 3 };

async function detectPriorityPattern(input: RecordFeedbackInput) {
  const from = input.initialValue?.priority;
  const to = input.correctedValue?.priority;
  const taskType = input.context?.task_type;
  if (!from || !to || !taskType) return;
  // Only count escalations
  if ((PRIORITY_RANK[to] ?? 0) <= (PRIORITY_RANK[from] ?? 0)) return;

  const key = `task_type:${taskType}`;
  const { data: existing } = await supabase
    .from("jarvis_learned_patterns")
    .select("*")
    .eq("user_id", input.userId)
    .eq("pattern_type", "priority_boost")
    .eq("pattern_key", key)
    .maybeSingle();

  if (existing) {
    const newCount = (existing.evidence_count || 0) + 1;
    const newConfidence = Math.min(1, 0.4 + newCount * 0.1);
    await supabase
      .from("jarvis_learned_patterns")
      .update({
        evidence_count: newCount,
        confidence: newConfidence,
        pattern_data: {
          ...(existing.pattern_data as any),
          last_from: from,
          last_to: to,
        },
        description: `Sueles subir tareas de tipo "${taskType}" a prioridad alta (${newCount} veces).`,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("jarvis_learned_patterns").insert({
      user_id: input.userId,
      pattern_type: "priority_boost",
      pattern_key: key,
      pattern_data: { task_type: taskType, last_from: from, last_to: to },
      evidence_count: 1,
      confidence: 0.5,
      status: "pending",
      description: `Has subido una tarea de tipo "${taskType}" de ${from} a ${to}.`,
    });
  }
}

async function detectClassificationPattern(input: RecordFeedbackInput) {
  const projectId = input.correctedValue?.project_id;
  const excerpt = input.context?.excerpt as string | undefined;
  if (!projectId || !excerpt) return;

  const key = `project:${projectId}`;
  const { data: existing } = await supabase
    .from("jarvis_learned_patterns")
    .select("*")
    .eq("user_id", input.userId)
    .eq("pattern_type", "classification_hint")
    .eq("pattern_key", key)
    .maybeSingle();

  const sample = { excerpt: excerpt.slice(0, 280), project_id: projectId, ts: new Date().toISOString() };

  if (existing) {
    const examples = Array.isArray((existing.pattern_data as any)?.examples)
      ? (existing.pattern_data as any).examples
      : [];
    const newExamples = [sample, ...examples].slice(0, 5);
    await supabase
      .from("jarvis_learned_patterns")
      .update({
        evidence_count: (existing.evidence_count || 0) + 1,
        confidence: Math.min(1, 0.5 + newExamples.length * 0.1),
        pattern_data: { project_id: projectId, examples: newExamples },
        description: `JARVIS aprendió ${newExamples.length} ejemplos reales para clasificar como este proyecto.`,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("jarvis_learned_patterns").insert({
      user_id: input.userId,
      pattern_type: "classification_hint",
      pattern_key: key,
      pattern_data: { project_id: projectId, examples: [sample] },
      evidence_count: 1,
      confidence: 0.5,
      status: "confirmed", // few-shot examples are auto-confirmed
      description: `Nuevo ejemplo de clasificación aprendido para este proyecto.`,
    });
  }
}

// Shared helper: enqueue ingestion job (fire-and-forget)
// Used by webhooks/edge funcs to push new content into JARVIS history

export type JarvisSourceType =
  | "whatsapp"
  | "email"
  | "transcription"
  | "attachment"
  | "calendar"
  | "contact_note"
  | "jarvis_chat"
  | "manual"
  | "plaud"
  | "telegram";

export interface EnqueueIngestParams {
  user_id: string;
  source_type: JarvisSourceType;
  source_id?: string;
  source_table?: string;
  payload?: Record<string, unknown>;
}

/**
 * Enqueues an ingestion job. Fire-and-forget: never throws.
 * The cron worker will pick it up and process it.
 */
export async function enqueueJarvisIngest(
  supabase: any,
  params: EnqueueIngestParams,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("jarvis_ingestion_jobs")
      .insert({
        user_id: params.user_id,
        source_type: params.source_type,
        source_id: params.source_id ?? null,
        source_table: params.source_table ?? null,
        payload: params.payload ?? {},
        status: "pending",
      });
    if (error) console.warn("[jarvis-ingest] enqueue error:", error.message);
  } catch (e) {
    console.warn("[jarvis-ingest] enqueue exception:", e);
  }
}

/**
 * Direct trigger: invoke jarvis-history-ingest synchronously (single mode).
 * Use only when you want immediate processing (low volume calls).
 */
export async function triggerJarvisIngestNow(
  supabaseUrl: string,
  serviceKey: string,
  params: EnqueueIngestParams,
): Promise<void> {
  try {
    fetch(`${supabaseUrl}/functions/v1/jarvis-history-ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ mode: "single", ...params }),
    }).catch((e) => console.warn("[jarvis-ingest] trigger fail:", e));
  } catch (e) {
    console.warn("[jarvis-ingest] trigger exception:", e);
  }
}

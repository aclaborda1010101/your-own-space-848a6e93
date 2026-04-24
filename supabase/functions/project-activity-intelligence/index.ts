import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");

function getAdmin(): any {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function truncate(s: string, max = 12000): string {
  if (!s || s.length <= max) return s;
  return s.substring(0, max) + "\n[...truncado]";
}

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json" },
      }),
    }
  );
  if (!resp.ok) throw new Error(`Gemini error: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
}

// ── Action: analyze_entry ──────────────────────────────────────────────
async function analyzeEntry(admin: any, entryId: string, projectId: string) {
  // Fetch the entry
  const { data: entry, error: eErr } = await admin
    .from("business_project_timeline")
    .select("*")
    .eq("id", entryId)
    .single();
  if (eErr || !entry) throw new Error("Entry not found");

  // Fetch attachments
  const { data: attachments } = await admin
    .from("business_project_timeline_attachments")
    .select("file_name, extracted_text, mime_type")
    .eq("timeline_id", entryId);

  const attachmentTexts = (attachments || [])
    .filter((a: any) => a.extracted_text)
    .map((a: any) => `--- ${a.file_name} ---\n${truncate(a.extracted_text, 5000)}`)
    .join("\n\n");

  // Fetch project context
  const { data: project } = await admin
    .from("business_projects")
    .select("name, company, sector, project_type, need_summary")
    .eq("id", projectId)
    .single();

  const prompt = `Eres un analista de proyectos de consultoría. Analiza la siguiente actividad del historial de un proyecto y genera un JSON estructurado.

PROYECTO: ${project?.name || "Sin nombre"} | Empresa: ${project?.company || "N/A"} | Sector: ${project?.sector || "N/A"}
Resumen necesidad: ${truncate(project?.need_summary || "", 2000)}

ACTIVIDAD:
- Fecha: ${entry.event_date}
- Canal: ${entry.channel}
- Título: ${entry.title}
- Descripción: ${entry.description || "Sin descripción"}
${attachmentTexts ? `\nDOCUMENTOS ADJUNTOS:\n${attachmentTexts}` : ""}

Genera un JSON con esta estructura exacta:
{
  "decisions": ["decisión 1", ...],
  "client_feedback": ["feedback 1", ...],
  "risks": ["riesgo 1", ...],
  "blockers": ["bloqueo 1", ...],
  "scope_changes": ["cambio 1", ...],
  "key_insights": ["insight 1", ...],
  "impact_scope": "none|low|medium|high",
  "impact_prd": "none|low|medium|high",
  "importance_score": 1-10,
  "needs_regeneration": false,
  "summary": "Resumen ejecutivo en 1-2 frases"
}

Responde SOLO con el JSON.`;

  const result = await callGemini(prompt);
  let analysisJson: any;
  try {
    analysisJson = JSON.parse(result);
  } catch {
    analysisJson = { summary: result, decisions: [], risks: [], importance_score: 3 };
  }

  // Update entry with analysis
  await admin
    .from("business_project_timeline")
    .update({
      analysis_json: analysisJson,
      impact_scope: analysisJson.impact_scope || "none",
      impact_prd: analysisJson.impact_prd || "none",
      needs_regeneration: analysisJson.needs_regeneration || false,
      importance_score: analysisJson.importance_score || 0,
    })
    .eq("id", entryId);

  return analysisJson;
}

// ── Action: refresh_summary ──────────────────────────────────────────
async function refreshSummary(admin: any, projectId: string) {
  // Fetch recent timeline entries with analysis
  const { data: entries } = await admin
    .from("business_project_timeline")
    .select("event_date, channel, title, description, analysis_json, auto_detected, importance_score")
    .eq("project_id", projectId)
    .order("event_date", { ascending: false })
    .limit(30);

  // Fetch wizard steps for context
  const { data: wizardSteps } = await admin
    .from("project_wizard_steps")
    .select("step_number, step_name, status, approved_at")
    .eq("project_id", projectId)
    .order("step_number", { ascending: true });

  // Fetch project info
  const { data: project } = await admin
    .from("business_projects")
    .select("name, company, sector, project_type, need_summary, status")
    .eq("id", projectId)
    .single();

  // Fetch discovery items
  const { data: discoveryItems } = await admin
    .from("business_project_discovery")
    .select("title, description, category, content_text, source, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(30);

  const entriesText = (entries || []).map((e: any, i: number) => {
    const analysis = e.analysis_json ? JSON.stringify(e.analysis_json) : "";
    return `${i + 1}. [${e.event_date}] ${e.channel} | ${e.title}${e.description ? ": " + e.description : ""}${analysis ? " | Análisis: " + truncate(analysis, 500) : ""}`;
  }).join("\n");

  const stepsText = (wizardSteps || []).map((s: any) =>
    `Paso ${s.step_number} (${s.step_name}): ${s.status}${s.approved_at ? " ✓" : ""}`
  ).join("\n");

  const discoveryText = (discoveryItems || []).map((d: any, i: number) =>
    `${i + 1}. [${d.category}] ${d.title}${d.description ? ": " + d.description : ""}${d.content_text ? "\n   Contenido: " + truncate(d.content_text, 500) : ""}`
  ).join("\n");

  const prompt = `Eres un gestor de proyectos experto. Genera un resumen vivo del estado actual de este proyecto basándote en todo el historial de actividad, el progreso del wizard y los elementos de descubrimiento/detección de necesidades.

PROYECTO: ${project?.name || "Sin nombre"}
Empresa: ${project?.company || "N/A"}
Sector: ${project?.sector || "N/A"}
Estado general: ${project?.status || "N/A"}
Necesidad: ${truncate(project?.need_summary || "", 2000)}

PROGRESO DEL WIZARD:
${stepsText || "Sin pasos registrados"}

DETECCIÓN DE NECESIDADES / DESCUBRIMIENTO:
${discoveryText || "Sin elementos de descubrimiento"}

HISTORIAL DE ACTIVIDAD (más reciente primero):
${entriesText || "Sin actividad registrada"}

Genera un JSON con esta estructura:
{
  "current_status": "Descripción clara del punto actual del proyecto en 2-3 frases",
  "recent_changes": ["cambio reciente 1", ...],
  "risks_blockers": ["riesgo o bloqueo 1", ...],
  "scope_prd_implications": ["implicación 1", ...],
  "next_actions": ["acción siguiente 1", ...],
  "client_sentiment": "positive|neutral|negative|unknown",
  "completion_pct": 0-100,
  "key_decisions_pending": ["decisión pendiente 1", ...],
  "discovery_insights": ["insight del descubrimiento 1", ...],
  "full_summary_markdown": "## Estado del Proyecto\\n\\nResumen amplio en formato markdown..."
}

El full_summary_markdown debe ser un resumen completo y detallado (mínimo 300 palabras) que cubra todos los aspectos del proyecto, incluyendo las necesidades detectadas y material de descubrimiento.
Responde SOLO con el JSON.`;

  const result = await callGemini(prompt);
  let statusJson: any;
  try {
    statusJson = JSON.parse(result);
  } catch {
    statusJson = { current_status: "Error al generar resumen", full_summary_markdown: result };
  }

  const lastEntry = entries?.[0];

  // Upsert live summary
  await admin
    .from("business_project_live_summary")
    .upsert({
      project_id: projectId,
      summary_markdown: statusJson.full_summary_markdown || "",
      status_json: statusJson,
      last_event_id: lastEntry?.id || null,
      last_event_at: lastEntry?.event_date || null,
      updated_at: new Date().toISOString(),
      model_used: "gemini-2.5-flash",
    }, { onConflict: "project_id" });

  return statusJson;
}

// ── Action: get_summary ──────────────────────────────────────────────
async function getSummary(admin: any, projectId: string) {
  const { data, error } = await admin
    .from("business_project_live_summary")
    .select("*")
    .eq("project_id", projectId)
    .single();

  if (error || !data) return null;
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, projectId, entryId } = await req.json();
    const admin = getAdmin();

    let result: any;

    switch (action) {
      case "analyze_entry":
        if (!entryId || !projectId) throw new Error("entryId and projectId required");
        result = await analyzeEntry(admin, entryId, projectId);
        break;

      case "refresh_summary":
        if (!projectId) throw new Error("projectId required");
        result = await refreshSummary(admin, projectId);
        break;

      case "get_summary":
        if (!projectId) throw new Error("projectId required");
        result = await getSummary(admin, projectId);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Activity intelligence error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

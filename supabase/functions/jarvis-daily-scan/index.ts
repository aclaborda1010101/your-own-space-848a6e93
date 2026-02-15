import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;
    console.log(`[daily-scan] Starting for user ${userId}`);

    // Parallel data collection
    const now = new Date();
    const hours48Ago = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    const [tasksRes, emailsRes, convsRes, transRes, calendarRes] = await Promise.all([
      // 1. Pending tasks
      supabase
        .from("tasks")
        .select("title, type, priority, due_date, source, description")
        .eq("user_id", userId)
        .eq("completed", false)
        .limit(100),

      // 2. Recent emails
      supabase
        .from("jarvis_emails_cache")
        .select("from_addr, subject, preview, synced_at")
        .eq("user_id", userId)
        .gte("synced_at", hours48Ago)
        .order("synced_at", { ascending: false })
        .limit(50),

      // 3. Recent conversations (WhatsApp/Telegram)
      supabase
        .from("jarvis_conversations")
        .select("agent, role, content, created_at")
        .eq("user_id", userId)
        .gte("created_at", hours48Ago)
        .order("created_at", { ascending: false })
        .limit(100),

      // 4. Recent transcriptions (Plaud)
      supabase
        .from("transcriptions")
        .select("title, summary, source, brain, created_at")
        .eq("user_id", userId)
        .gte("created_at", hours48Ago)
        .order("created_at", { ascending: false })
        .limit(20),

      // 5. Calendar events (internal call)
      fetchCalendarEvents(authHeader),
    ]);

    const tasks = tasksRes.data || [];
    const emails = emailsRes.data || [];
    const conversations = convsRes.data || [];
    const transcriptions = transRes.data || [];
    const calendarEvents = calendarRes;

    console.log(`[daily-scan] Data collected: ${tasks.length} tasks, ${emails.length} emails, ${conversations.length} convs, ${transcriptions.length} transcriptions, ${calendarEvents.length} cal events`);

    // Build prompt
    const prompt = buildAnalysisPrompt(tasks, emails, conversations, transcriptions, calendarEvents);

    // Call AI
    const aiResult = await chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      {
        model: "gemini-flash",
        temperature: 0.3,
        maxTokens: 4096,
        responseFormat: "json",
      }
    );

    let parsed: { suggestions: SuggestionItem[]; summary: string };
    try {
      parsed = JSON.parse(aiResult);
    } catch {
      console.error("[daily-scan] Failed to parse AI response:", aiResult.substring(0, 500));
      return new Response(
        JSON.stringify({ error: "AI response parsing failed", raw: aiResult.substring(0, 200) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!parsed.suggestions?.length) {
      return new Response(
        JSON.stringify({ message: "No gaps detected", summary: parsed.summary || "Todo en orden." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert suggestions with dedup
    let inserted = 0;
    const hours24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    for (const s of parsed.suggestions) {
      // Check for duplicates
      const { data: existing } = await supabase
        .from("suggestions")
        .select("id")
        .eq("user_id", userId)
        .eq("suggestion_type", s.type)
        .gte("created_at", hours24Ago)
        .ilike("content->>title", `%${s.title.substring(0, 30)}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[daily-scan] Skipping duplicate: ${s.title}`);
        continue;
      }

      const { error: insertError } = await supabase.from("suggestions").insert({
        user_id: userId,
        suggestion_type: s.type,
        content: {
          title: s.title,
          description: s.description,
          source_channel: s.source_channel,
          priority: s.priority,
          raw_reference: s.raw_reference,
        },
        status: "pending",
      });

      if (insertError) {
        console.error(`[daily-scan] Insert error:`, insertError);
      } else {
        inserted++;
      }
    }

    console.log(`[daily-scan] Done. ${inserted} suggestions inserted out of ${parsed.suggestions.length}`);

    return new Response(
      JSON.stringify({
        suggestions_found: parsed.suggestions.length,
        suggestions_inserted: inserted,
        summary: parsed.summary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[daily-scan] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// --- Types ---
interface SuggestionItem {
  type: "missing_task" | "missing_event" | "urgency_alert" | "forgotten_followup";
  title: string;
  description: string;
  source_channel: "email" | "whatsapp" | "plaud" | "calendar";
  priority: "high" | "medium" | "low";
  raw_reference: string;
}

// --- Calendar fetch ---
async function fetchCalendarEvents(authHeader: string): Promise<Array<{ title: string; time: string }>> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) return [];

    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const res = await fetch(`${supabaseUrl}/functions/v1/icloud-calendar`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify({
        action: "fetch",
        startDate: now.toISOString(),
        endDate: weekLater.toISOString(),
      }),
    });

    if (!res.ok) {
      console.warn("[daily-scan] Calendar fetch failed:", res.status);
      return [];
    }

    const data = await res.json();
    return data?.events || [];
  } catch (e) {
    console.warn("[daily-scan] Calendar error:", e);
    return [];
  }
}

// --- Prompt builder ---
function buildAnalysisPrompt(
  tasks: any[],
  emails: any[],
  conversations: any[],
  transcriptions: any[],
  calendarEvents: any[]
): string {
  const sections: string[] = [];

  // Tasks
  if (tasks.length) {
    const taskList = tasks
      .map((t) => `- [${t.priority || "?"}] ${t.title}${t.due_date ? ` (vence: ${t.due_date})` : ""} [${t.source || "manual"}]`)
      .join("\n");
    sections.push(`## TAREAS PENDIENTES (${tasks.length})\n${taskList}`);
  } else {
    sections.push("## TAREAS PENDIENTES\nNo hay tareas pendientes registradas.");
  }

  // Calendar
  if (calendarEvents.length) {
    const calList = calendarEvents
      .map((e: any) => `- ${e.title || "Sin titulo"} | ${e.time || e.start || "?"}`)
      .join("\n");
    sections.push(`## CALENDARIO (proximos 7 dias, ${calendarEvents.length} eventos)\n${calList}`);
  } else {
    sections.push("## CALENDARIO\nNo hay eventos de calendario disponibles.");
  }

  // Emails
  if (emails.length) {
    const emailList = emails
      .slice(0, 30)
      .map((e) => `- De: ${e.from_addr || "?"} | Asunto: ${e.subject || "?"} | ${(e.preview || "").substring(0, 80)}`)
      .join("\n");
    sections.push(`## EMAILS RECIENTES (${emails.length})\n${emailList}`);
  } else {
    sections.push("## EMAILS RECIENTES\nNo hay emails recientes.");
  }

  // Conversations
  if (conversations.length) {
    const userMsgs = conversations
      .filter((c) => c.role === "user")
      .slice(0, 30)
      .map((c) => `- [${c.agent || "?"}] ${(c.content || "").substring(0, 120)}`)
      .join("\n");
    sections.push(`## CONVERSACIONES RECIENTES (WhatsApp/Telegram)\n${userMsgs || "Sin mensajes de usuario."}`);
  } else {
    sections.push("## CONVERSACIONES RECIENTES\nNo hay conversaciones recientes.");
  }

  // Transcriptions
  if (transcriptions.length) {
    const transList = transcriptions
      .map((t) => `- [${t.source || "?"}] "${t.title || "Sin titulo"}" | Resumen: ${(t.summary || "Sin resumen").substring(0, 150)}`)
      .join("\n");
    sections.push(`## TRANSCRIPCIONES PLAUD (${transcriptions.length})\n${transList}`);
  } else {
    sections.push("## TRANSCRIPCIONES\nNo hay transcripciones recientes.");
  }

  return sections.join("\n\n");
}

// --- System prompt ---
const SYSTEM_PROMPT = `Eres un asistente de productividad personal. Tu trabajo es analizar TODA la informacion del usuario (tareas, calendario, emails, conversaciones y transcripciones) y detectar GAPS o huecos:

1. **missing_task**: Tareas implicitas mencionadas en emails, conversaciones o transcripciones que NO estan en la lista de tareas. Ejemplo: alguien pide algo por email y no hay tarea registrada.
2. **missing_event**: Reuniones o citas mencionadas en conversaciones/emails que NO aparecen en el calendario. Ejemplo: "nos vemos el jueves" pero no hay evento.
3. **urgency_alert**: Temas urgentes detectados que pueden haberse pasado por alto. Ejemplo: deadline mencionado en un email que esta cerca.
4. **forgotten_followup**: Seguimientos prometidos o esperados que no se han realizado. Ejemplo: "te envio el documento manana" hace 2 dias sin accion posterior.

REGLAS:
- Solo reporta gaps REALES y concretos. No inventes ni especules.
- Si no encuentras gaps, devuelve un array vacio.
- El source_channel debe indicar DE DONDE viene la evidencia (email, whatsapp, plaud, calendar).
- La prioridad debe ser: high (requiere accion inmediata), medium (deberia atenderse pronto), low (conviene revisar).
- raw_reference debe contener el texto original que motiva la sugerencia.
- Responde SIEMPRE en espanol.
- Responde SOLO con JSON valido, sin markdown.

Formato de respuesta:
{
  "suggestions": [
    {
      "type": "missing_task|missing_event|urgency_alert|forgotten_followup",
      "title": "titulo corto y claro",
      "description": "explicacion de por que es un gap",
      "source_channel": "email|whatsapp|plaud|calendar",
      "priority": "high|medium|low",
      "raw_reference": "texto original relevante"
    }
  ],
  "summary": "resumen ejecutivo de 2-3 lineas sobre el estado general"
}`;

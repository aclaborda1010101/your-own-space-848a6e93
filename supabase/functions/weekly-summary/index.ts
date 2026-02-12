import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const { send_whatsapp = false } = await req.json().catch(() => ({}));

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    console.log(`[weekly-summary] Generating for ${userId.substring(0, 8)}... from ${weekAgoStr}`);

    // Gather week data in parallel
    const [
      transcriptionsResult,
      tasksCompletedResult,
      tasksPendingResult,
      commitmentsResult,
      ideasResult,
      peopleResult,
    ] = await Promise.all([
      supabase.from("transcriptions")
        .select("title, brain, summary, created_at")
        .eq("user_id", userId)
        .gte("created_at", weekAgoStr)
        .order("created_at", { ascending: false }),
      supabase.from("tasks")
        .select("title, priority, completed_at")
        .eq("user_id", userId)
        .eq("completed", true)
        .gte("completed_at", weekAgoStr),
      supabase.from("tasks")
        .select("title, priority, due_date")
        .eq("user_id", userId)
        .eq("completed", false)
        .order("priority", { ascending: true })
        .limit(10),
      supabase.from("commitments")
        .select("description, commitment_type, person_name, status")
        .eq("user_id", userId)
        .gte("created_at", weekAgoStr),
      supabase.from("ideas_projects")
        .select("name, maturity_state, mention_count")
        .eq("user_id", userId)
        .gte("created_at", weekAgoStr),
      supabase.from("people_contacts")
        .select("name, brain, interaction_count, last_contact")
        .eq("user_id", userId)
        .gte("last_contact", weekAgoStr)
        .order("interaction_count", { ascending: false })
        .limit(10),
    ]);

    const contextParts: string[] = [];

    const transcriptions = transcriptionsResult.data || [];
    if (transcriptions.length > 0) {
      contextParts.push(`Transcripciones procesadas esta semana (${transcriptions.length}):\n${transcriptions.map(t =>
        `  - [${t.brain}] ${t.title}: ${t.summary?.substring(0, 100)}`
      ).join("\n")}`);
    }

    const tasksCompleted = tasksCompletedResult.data || [];
    contextParts.push(`Tareas completadas: ${tasksCompleted.length}`);
    if (tasksCompleted.length > 0) {
      contextParts.push(`Top completadas: ${tasksCompleted.slice(0, 5).map(t => t.title).join(", ")}`);
    }

    const tasksPending = tasksPendingResult.data || [];
    if (tasksPending.length > 0) {
      contextParts.push(`Tareas pendientes (${tasksPending.length}): ${tasksPending.slice(0, 5).map(t => `${t.title} (${t.priority})`).join(", ")}`);
    }

    const commitments = commitmentsResult.data || [];
    if (commitments.length > 0) {
      const pending = commitments.filter(c => c.status === "pending");
      contextParts.push(`Compromisos nuevos: ${commitments.length} (${pending.length} pendientes)`);
    }

    const ideas = ideasResult.data || [];
    if (ideas.length > 0) {
      contextParts.push(`Ideas capturadas: ${ideas.map(i => `${i.name} (${i.maturity_state})`).join(", ")}`);
    }

    const people = peopleResult.data || [];
    if (people.length > 0) {
      contextParts.push(`Personas clave esta semana: ${people.map(p => `${p.name} (${p.brain})`).join(", ")}`);
    }

    // Generate summary with Claude
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: `Eres JARVIS generando el resumen semanal. Responde en JSON con:
{
  "headline": "Titular de la semana en 1 frase",
  "productivity_score": 8,
  "highlights": ["3-5 logros destacados"],
  "open_threads": ["Temas abiertos que requieren atención"],
  "key_people": ["Personas más relevantes esta semana"],
  "ideas_captured": ["Ideas/proyectos nuevos o en evolución"],
  "recommendation": "Recomendación principal para la próxima semana",
  "stats": { "transcriptions": N, "tasks_completed": N, "tasks_pending": N, "commitments": N }
}
Tono: formal, conciso, ejecutivo.`,
        messages: [{
          role: "user",
          content: `Genera el resumen semanal.\n\nCONTEXTO:\n${contextParts.join("\n\n")}`,
        }],
      }),
    });

    if (!claudeResponse.ok) {
      const err = await claudeResponse.text();
      console.error("[weekly-summary] Claude error:", err);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeResponse.json();
    const rawContent = claudeData.content?.find((b: any) => b.type === "text")?.text || "{}";

    let summary;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      summary = JSON.parse(cleaned);
    } catch {
      console.error("[weekly-summary] Parse error:", rawContent);
      summary = { headline: "Resumen no disponible", productivity_score: 5 };
    }

    // Optionally send via WhatsApp
    if (send_whatsapp) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const waMessage = `📊 *Resumen Semanal JARVIS*\n\n${summary.headline}\n\n✅ Productividad: ${summary.productivity_score}/10\n\n📌 Highlights:\n${(summary.highlights || []).map((h: string) => `• ${h}`).join("\n")}\n\n⚠️ Pendiente:\n${(summary.open_threads || []).map((t: string) => `• ${t}`).join("\n")}\n\n💡 ${summary.recommendation || ""}`;

      await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, message: waMessage }),
      }).catch(e => console.error("[weekly-summary] WhatsApp send failed:", e));
    }

    console.log(`[weekly-summary] Generated: score ${summary.productivity_score}/10`);

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[weekly-summary] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

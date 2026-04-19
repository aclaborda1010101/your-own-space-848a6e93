// plaud-classify — Clasifica una transcripción Plaud por proyecto y personas
// Input: { user_id, transcription_id }
// Output: { project_id, project_name, project_confidence, contacts: [{id,name,confidence}], reasoning }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, transcription_id } = await req.json();
    if (!user_id || !transcription_id) return json({ error: "user_id and transcription_id required" }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: tx, error: txErr } = await sb
      .from("plaud_transcriptions")
      .select("id, title, summary_structured, transcript_raw, participants, parsed_data, recording_date")
      .eq("id", transcription_id)
      .eq("user_id", user_id)
      .maybeSingle();
    if (txErr || !tx) return json({ error: "transcription not found" }, 404);

    const text = (tx.transcript_raw || tx.summary_structured || "").slice(0, 12000);
    if (text.length < 30) return json({ error: "transcript too short" }, 400);

    const [projectsRes, contactsRes, aliasesRes, fewShotRes, healthRes] = await Promise.all([
      sb.from("business_projects")
        .select("id, name, company, sector, need_summary")
        .eq("user_id", user_id)
        .neq("status", "closed")
        .limit(60),
      sb.from("people_contacts")
        .select("id, name, company, role")
        .eq("user_id", user_id)
        .limit(300),
      sb.from("contact_aliases")
        .select("contact_id, alias")
        .eq("user_id", user_id)
        .eq("is_dismissed", false)
        .limit(500),
      sb.from("jarvis_learned_patterns")
        .select("pattern_key, pattern_data, evidence_count")
        .eq("user_id", user_id)
        .eq("pattern_type", "classification_hint")
        .eq("status", "confirmed")
        .order("evidence_count", { ascending: false })
        .limit(8),
      sb.from("jarvis_suggestion_health")
        .select("suggestion_type, threshold_adjustment, status")
        .eq("user_id", user_id)
        .eq("suggestion_type", "classification_from_plaud")
        .maybeSingle(),
    ]);

    const projects = projectsRes.data || [];
    const contacts = contactsRes.data || [];
    const aliases = aliasesRes.data || [];
    const fewShots = fewShotRes.data || [];
    const thresholdAdjust = Number((healthRes.data as any)?.threshold_adjustment || 0);

    // Build alias index for resolution
    const aliasByContact = new Map<string, string[]>();
    for (const a of aliases) {
      if (!a.contact_id || !a.alias) continue;
      const arr = aliasByContact.get(a.contact_id) || [];
      arr.push(a.alias);
      aliasByContact.set(a.contact_id, arr);
    }

    const projectList = projects.map(p =>
      `- id:${p.id} | ${p.name}${p.company ? ` (${p.company})` : ""}${p.sector ? ` [${p.sector}]` : ""}${p.need_summary ? ` — ${String(p.need_summary).slice(0, 100)}` : ""}`
    ).join("\n");

    const contactList = contacts.map(c => {
      const al = aliasByContact.get(c.id) || [];
      return `- id:${c.id} | ${c.name}${c.company ? ` (${c.company})` : ""}${c.role ? ` [${c.role}]` : ""}${al.length ? ` aliases: ${al.join(", ")}` : ""}`;
    }).join("\n");

    const prompt = `Eres el clasificador de Plaud para JARVIS. Analiza esta transcripción y devuelve SOLO JSON.

TRANSCRIPCIÓN (título: "${tx.title || "—"}"):
"""
${text}
"""

PROYECTOS ACTIVOS DEL USUARIO:
${projectList || "(ninguno)"}

CONTACTOS CONOCIDOS (con aliases):
${contactList || "(ninguno)"}
${fewShots.length > 0 ? `
EJEMPLOS REALES APRENDIDOS DEL USUARIO (clasificaciones que él mismo confirmó/corrigió):
${fewShots.map((fs: any) => {
  const examples = (fs.pattern_data?.examples || []).slice(0, 2);
  const projectId = fs.pattern_data?.project_id;
  const projectName = projects.find(p => p.id === projectId)?.name || "?";
  return examples.map((e: any) => `- "${e.excerpt?.slice(0, 200)}" → proyecto: ${projectName} (id:${projectId})`).join("\n");
}).join("\n")}

Usa estos ejemplos como referencia: si el contenido es similar, prioriza esa clasificación.
` : ""}
Devuelve JSON con esta estructura exacta:
{
  "project_id": "id del proyecto que mejor encaja, o null si ninguno encaja",
  "project_name_suggested": "si project_id es null y propondrías crear un proyecto nuevo, su nombre; si no, null",
  "project_confidence": 0.0,
  "project_reasoning": "1 frase: por qué ese proyecto",
  "contacts": [
    {"id": "id si coincide con la lista", "name": "nombre tal como aparece en la transcripción", "confidence": 0.0}
  ],
  "context_type": "professional | family | personal",
  "summary_one_line": "1 frase con la esencia de la conversación"
}

Reglas:
- project_confidence ∈ [0,1]. Usa ≥0.8 solo si el match es claro (mismo cliente, mismo tema).
- Resuelve aliases (ej: "Juani"→Juana). Si una persona mencionada coincide claramente con un contacto, devuelve su id.
- Si una persona no está en la lista, devuélvela con id:null.
- NO inventes proyectos: si nada encaja, project_id=null y propón project_name_suggested si tiene sentido.
- Sin markdown, sin backticks, solo JSON.`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un clasificador preciso. Devuelves siempre JSON válido sin markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[plaud-classify] AI gateway error", aiResp.status, errText);
      if (aiResp.status === 429) return json({ error: "Rate limit" }, 429);
      if (aiResp.status === 402) return json({ error: "Sin créditos AI" }, 402);
      return json({ error: "AI gateway error" }, 500);
    }

    const aiData = await aiResp.json();
    const raw = aiData?.choices?.[0]?.message?.content?.trim() || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return json({ error: "AI returned non-JSON", raw }, 500);

    let parsed: any;
    try { parsed = JSON.parse(jsonMatch[0]); }
    catch (e) { return json({ error: "JSON parse error", raw }, 500); }

    // Resolve project name
    const matchedProject = parsed.project_id ? projects.find(p => p.id === parsed.project_id) : null;
    const result = {
      project_id: matchedProject?.id || null,
      project_name: matchedProject?.name || parsed.project_name_suggested || null,
      project_name_suggested: !matchedProject ? parsed.project_name_suggested : null,
      project_confidence: Number(parsed.project_confidence || 0),
      project_reasoning: parsed.project_reasoning || "",
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts.map((c: any) => ({
        id: c.id || null,
        name: c.name || "",
        confidence: Number(c.confidence || 0),
        resolved: c.id ? contacts.find(x => x.id === c.id)?.name || null : null,
      })) : [],
      context_type: parsed.context_type || "professional",
      summary_one_line: parsed.summary_one_line || "",
    };

    // Auto-link if high confidence (umbral ajustado por feedback)
    const HIGH = Math.min(0.95, 0.8 + thresholdAdjust);
    const autoLinkProject = result.project_id && result.project_confidence >= HIGH;
    const autoLinkedContactIds = result.contacts
      .filter((c: any) => c.id && c.confidence >= HIGH)
      .map((c: any) => c.id);

    const update: Record<string, any> = {
      context_type: result.context_type,
    };
    if (autoLinkProject) update.linked_project_id = result.project_id;
    if (autoLinkedContactIds.length > 0) update.linked_contact_ids = autoLinkedContactIds;

    if (Object.keys(update).length > 0) {
      await sb.from("plaud_transcriptions").update(update).eq("id", transcription_id);
    }

    // If not auto-linked OR there are unresolved entities, create a classification suggestion
    const needsReview = !autoLinkProject || result.contacts.some((c: any) => !c.id && c.name);
    if (needsReview) {
      await sb.from("suggestions").insert({
        user_id,
        suggestion_type: "classification_from_plaud",
        source_transcription_id: transcription_id,
        confidence: result.project_confidence,
        reasoning: result.project_reasoning,
        status: "pending",
        content: {
          transcription_id,
          title: tx.title,
          recording_date: tx.recording_date,
          excerpt: text.slice(0, 400),
          summary_one_line: result.summary_one_line,
          project_id: result.project_id,
          project_name: result.project_name,
          project_name_suggested: result.project_name_suggested,
          project_confidence: result.project_confidence,
          context_type: result.context_type,
          contacts: result.contacts,
          auto_linked_project: autoLinkProject,
          auto_linked_contacts: autoLinkedContactIds,
        },
      });
    }

    // If auto-linked to a project with high confidence, hydrate timeline immediately
    if (autoLinkProject) {
      await sb.from("business_project_timeline").insert({
        project_id: result.project_id,
        user_id,
        channel: "plaud",
        title: tx.title || "Grabación Plaud",
        description: result.summary_one_line || text.slice(0, 280),
        event_date: tx.recording_date || new Date().toISOString(),
        auto_detected: true,
        source_id: transcription_id,
        importance_score: Math.round(result.project_confidence * 100),
      });
    }

    return json({
      ok: true,
      auto_linked_project: autoLinkProject,
      auto_linked_contacts: autoLinkedContactIds,
      result,
    });
  } catch (e: any) {
    console.error("[plaud-classify] error", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});

// plaud-suggest-initial — Sugerencia previa al import de Plaud
// Input:  { user_id, title, transcript_excerpt }
// Output: { project, contacts[], context_type, auto_assign, confidence, reasoning, learned_patterns_used }
// Mucho más ligero que plaud-classify: NO escribe en BD, NO crea suggestions ni timeline.
// Combina:
//   1) heurística rápida (matching por nombre / aliases / proyecto)
//   2) few-shot del aprendizaje previo (jarvis_learned_patterns)
//   3) un único pase al modelo flash (sólo si hay >120 chars)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// --- Auto-assign rule -------------------------------------------------------
// Una sugerencia se marca auto_assign=true si:
//   - el patrón asociado (classification_hint) tiene evidence_count >= AUTO_MIN_EVIDENCE
//   - confianza del patrón >= AUTO_MIN_CONFIDENCE
//   - el match heurístico/LLM coincide con el project_id del patrón
const AUTO_MIN_EVIDENCE = 5;
const AUTO_MIN_CONFIDENCE = 0.85;

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

function quickContactMatches(
  text: string,
  contacts: any[],
  aliasByContact: Map<string, string[]>,
): { id: string; name: string; confidence: number }[] {
  const lower = text.toLowerCase();
  const out: { id: string; name: string; confidence: number }[] = [];
  for (const c of contacts) {
    const candidates = [c.name, ...(aliasByContact.get(c.id) || [])].filter(
      (s) => typeof s === "string" && s.trim().length >= 2,
    );
    let best = 0;
    for (const cand of candidates) {
      const n = String(cand).toLowerCase();
      if (!n) continue;
      // mención literal
      const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(lower)) {
        best = Math.max(best, 0.9);
      } else {
        // mención parcial (primer nombre)
        const first = n.split(/\s+/)[0];
        if (first.length >= 4 && new RegExp(`\\b${first}\\b`, "i").test(lower)) {
          best = Math.max(best, 0.65);
        }
      }
    }
    if (best > 0) out.push({ id: c.id, name: c.name, confidence: best });
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

function quickProjectMatch(
  text: string,
  projects: any[],
): { id: string; name: string; confidence: number; reasoning: string } | null {
  if (projects.length === 0) return null;
  const tokens = new Set(tokenize(text));
  let best: { id: string; name: string; confidence: number; reasoning: string } | null = null;
  for (const p of projects) {
    const corpus = [p.name, p.company, p.sector, p.need_summary].filter(Boolean).join(" ");
    const corpusTokens = tokenize(corpus);
    if (corpusTokens.length === 0) continue;
    let hits = 0;
    const matched: string[] = [];
    for (const t of corpusTokens) {
      if (tokens.has(t)) {
        hits++;
        if (matched.length < 3) matched.push(t);
      }
    }
    // bonus si el nombre del proyecto aparece literal
    const nameLower = String(p.name || "").toLowerCase();
    const nameHit = nameLower.length >= 4 && text.toLowerCase().includes(nameLower);
    const score = Math.min(0.9, hits / Math.max(4, corpusTokens.length) + (nameHit ? 0.4 : 0));
    if (score > (best?.confidence ?? 0)) {
      best = {
        id: p.id,
        name: p.name,
        confidence: score,
        reasoning: nameHit
          ? `Nombre del proyecto "${p.name}" mencionado literalmente.`
          : matched.length > 0
          ? `Coincidencias: ${matched.join(", ")}.`
          : "Coincidencia léxica débil.",
      };
    }
  }
  if (!best || best.confidence < 0.15) return null;
  return best;
}

function detectContextType(text: string): "professional" | "family" | "personal" {
  const lower = text.toLowerCase();
  const familyHints = ["bosco", "papá", "papa", "mamá", "mama", "hijo", "hija", "cole", "guarder", "pediatra"];
  const personalHints = ["médico", "medico", "gym", "vacaciones", "familia"];
  if (familyHints.some((w) => lower.includes(w))) return "family";
  if (personalHints.some((w) => lower.includes(w))) return "personal";
  return "professional";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { user_id, title, transcript_excerpt } = body || {};
    if (!user_id) return json({ error: "user_id required" }, 400);

    const titleStr = String(title || "").slice(0, 200);
    const excerpt = String(transcript_excerpt || "").slice(0, 4000);
    const text = `${titleStr}\n${excerpt}`.trim();
    if (text.length < 8) return json({ error: "Texto demasiado corto para sugerir." }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [projectsRes, contactsRes, aliasesRes, patternsRes] = await Promise.all([
      sb
        .from("business_projects")
        .select("id, name, company, sector, need_summary")
        .eq("user_id", user_id)
        .neq("status", "closed")
        .limit(60),
      sb
        .from("people_contacts")
        .select("id, name, company, role")
        .eq("user_id", user_id)
        .limit(300),
      sb
        .from("contact_aliases")
        .select("contact_id, alias")
        .eq("user_id", user_id)
        .eq("is_dismissed", false)
        .limit(500),
      sb
        .from("jarvis_learned_patterns")
        .select("id, pattern_key, pattern_data, evidence_count, confidence, status")
        .eq("user_id", user_id)
        .eq("pattern_type", "classification_hint")
        .eq("status", "confirmed")
        .order("evidence_count", { ascending: false })
        .limit(12),
    ]);

    const projects = projectsRes.data || [];
    const contacts = contactsRes.data || [];
    const aliases = aliasesRes.data || [];
    const patterns = patternsRes.data || [];

    const aliasByContact = new Map<string, string[]>();
    for (const a of aliases) {
      if (!a.contact_id || !a.alias) continue;
      const arr = aliasByContact.get(a.contact_id) || [];
      arr.push(a.alias);
      aliasByContact.set(a.contact_id, arr);
    }

    // 1) Heurística rápida
    const heurContacts = quickContactMatches(text, contacts, aliasByContact);
    const heurProject = quickProjectMatch(text, projects);
    const contextType = detectContextType(text);

    // 2) Boost por patrones aprendidos
    const usedPatterns: { pattern_id: string; project_id: string; evidence: number }[] = [];
    let projectSuggestion = heurProject;
    for (const p of patterns) {
      const projectId = (p.pattern_data as any)?.project_id;
      const examples = ((p.pattern_data as any)?.examples || []) as { excerpt?: string }[];
      if (!projectId) continue;
      // similitud cruda: ¿comparten 2+ tokens del excerpt aprendido?
      const seenTokens = new Set<string>();
      for (const ex of examples.slice(0, 3)) {
        for (const t of tokenize(String(ex.excerpt || ""))) seenTokens.add(t);
      }
      const inputTokens = tokenize(text);
      const overlap = inputTokens.filter((t) => seenTokens.has(t)).length;
      if (overlap >= 2) {
        const proj = projects.find((x) => x.id === projectId);
        if (proj) {
          const boost = Math.min(0.95, 0.6 + p.confidence * 0.4 + overlap * 0.05);
          if (!projectSuggestion || projectSuggestion.confidence < boost) {
            projectSuggestion = {
              id: proj.id,
              name: proj.name,
              confidence: boost,
              reasoning: `JARVIS aprendió ${p.evidence_count} casos similares para este proyecto.`,
            };
          }
          usedPatterns.push({ pattern_id: p.id, project_id: projectId, evidence: p.evidence_count });
        }
      }
    }

    // 3) Refinamiento opcional con LLM (sólo si tenemos texto sustancial)
    let llmContext = contextType;
    let llmSummary = "";
    if (text.length >= 120 && Deno.env.get("LOVABLE_API_KEY")) {
      try {
        const projectList = projects
          .slice(0, 30)
          .map((p) => `- id:${p.id} | ${p.name}${p.company ? ` (${p.company})` : ""}`)
          .join("\n");
        const contactList = contacts
          .slice(0, 80)
          .map((c) => `- id:${c.id} | ${c.name}`)
          .join("\n");

        const prompt = `Pre-clasifica esta grabación Plaud (todavía no se ha importado). Devuelve SOLO JSON.

TÍTULO: "${titleStr || "—"}"
EXTRACTO:
"""
${excerpt.slice(0, 2500)}
"""

PROYECTOS:
${projectList || "(ninguno)"}

CONTACTOS:
${contactList || "(ninguno)"}

JSON:
{
  "project_id": "id o null",
  "project_confidence": 0.0,
  "project_reasoning": "1 frase",
  "contacts": [{"id": "id o null", "name": "...", "confidence": 0.0}],
  "context_type": "professional|family|personal",
  "summary_one_line": "1 frase con la esencia"
}`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Devuelves siempre JSON válido sin markdown." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const raw = aiData?.choices?.[0]?.message?.content?.trim() || "";
          const m = raw.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = JSON.parse(m[0]);
            const llmProj = parsed.project_id
              ? projects.find((p) => p.id === parsed.project_id)
              : null;
            if (
              llmProj &&
              Number(parsed.project_confidence || 0) > (projectSuggestion?.confidence ?? 0)
            ) {
              projectSuggestion = {
                id: llmProj.id,
                name: llmProj.name,
                confidence: Number(parsed.project_confidence || 0),
                reasoning: parsed.project_reasoning || "Sugerencia del modelo.",
              };
            }
            // Merge contactos LLM (sólo los que tienen id)
            if (Array.isArray(parsed.contacts)) {
              for (const c of parsed.contacts) {
                if (!c.id) continue;
                const exists = heurContacts.find((h) => h.id === c.id);
                const conf = Number(c.confidence || 0);
                if (exists) exists.confidence = Math.max(exists.confidence, conf);
                else {
                  const known = contacts.find((x) => x.id === c.id);
                  if (known) heurContacts.push({ id: c.id, name: known.name, confidence: conf });
                }
              }
            }
            llmContext = parsed.context_type || contextType;
            llmSummary = parsed.summary_one_line || "";
          }
        }
      } catch (e) {
        console.warn("[plaud-suggest-initial] LLM fallo (no bloquea):", (e as Error).message);
      }
    }

    // 4) Auto-assign: ¿el proyecto sugerido coincide con un patrón maduro?
    let autoAssign = false;
    let autoAssignPatternId: string | null = null;
    if (projectSuggestion) {
      const matchedPattern = patterns.find(
        (p) =>
          (p.pattern_data as any)?.project_id === projectSuggestion!.id &&
          (p.evidence_count || 0) >= AUTO_MIN_EVIDENCE &&
          Number(p.confidence || 0) >= AUTO_MIN_CONFIDENCE,
      );
      if (matchedPattern && projectSuggestion.confidence >= 0.7) {
        autoAssign = true;
        autoAssignPatternId = matchedPattern.id;
        projectSuggestion.confidence = Math.max(projectSuggestion.confidence, 0.92);
      }
    }

    return json({
      ok: true,
      project: projectSuggestion,
      contacts: heurContacts.sort((a, b) => b.confidence - a.confidence).slice(0, 8),
      context_type: llmContext,
      summary_one_line: llmSummary,
      auto_assign: autoAssign,
      auto_assign_pattern_id: autoAssignPatternId,
      learned_patterns_used: usedPatterns,
    });
  } catch (e: any) {
    console.error("[plaud-suggest-initial] error", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});

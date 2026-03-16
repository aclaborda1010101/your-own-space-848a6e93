import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function truncate(s: string, max = 12000): string {
  if (!s || s.length <= max) return s;
  return s.substring(0, max) + "\n\n[... truncado]";
}

const SYSTEM_PROMPT = `Eres un analista estratégico senior especializado en evaluación de oportunidades SaaS B2B.
Tu trabajo es evaluar de forma OBJETIVA, CRÍTICA y REALISTA si un proyecto tiene potencial para convertirse en un SaaS escalable.

REGLAS ESTRICTAS:
- NO uses lenguaje promocional ni optimismo artificial
- Sé brutalmente honesto en cada puntuación
- Justifica CADA puntuación con datos del proyecto
- Si falta información, penaliza la puntuación y explícalo
- Formato Markdown profesional con H2 (##) y H3 (###). NO uses H1 (#)
- Usa tablas Markdown cuando se indique
- Idioma: Español
- Tono: consultoría estratégica, directo y analítico

ESTRUCTURA OBLIGATORIA:

## Evaluación de Oportunidad SaaS

### Opportunity Score

Calcula una puntuación global de 0 a 100 basada en la media ponderada de los factores.
Muestra el resultado como:

**Opportunity Score: XX / 100**

Tabla de interpretación:
| Score | Evaluación |
|-------|-----------|
| 80 – 100 | Oportunidad muy fuerte |
| 65 – 79 | Buena oportunidad |
| 50 – 64 | Oportunidad moderada |
| 35 – 49 | Oportunidad débil |
| 0 – 34 | No recomendable como SaaS |

Añade un párrafo breve explicando el resultado.

### Evaluación por factores

Evalúa cada factor de 0 a 10. La puntuación debe ser justificada con datos concretos del proyecto.

| Factor | Score | Explicación |
|--------|-------|-------------|
| Claridad del problema del mercado | X/10 | ... |
| Tamaño del mercado potencial | X/10 | ... |
| Nivel de competencia | X/10 | ... |
| Diferenciación del producto | X/10 | ... |
| Facilidad de adquisición de clientes | X/10 | ... |
| Economía SaaS (pricing vs CAC) | X/10 | ... |
| Escalabilidad tecnológica | X/10 | ... |
| Barreras de entrada | X/10 | ... |

### Fortalezas del proyecto

Identifica 3-5 factores concretos que aumentan la probabilidad de éxito.
Cada fortaleza debe estar basada en datos reales del proyecto.

### Riesgos principales

Identifica 3-5 riesgos concretos que pueden dificultar el éxito.
Cada riesgo debe estar justificado y ser específico al proyecto.

### Recomendación estratégica

Genera UNA recomendación final basada en el Opportunity Score:

1. **Convertir en SaaS** (Score >= 65) — Condiciones favorables para escalar.
2. **Validar antes de escalar** (Score 50-64) — Potencial pero requiere validación adicional.
3. **Mantener como solución personalizada** (Score < 50) — Mejor como automatización o servicio.

Incluye explicación clara y pasos concretos recomendados.

Al final, añade la etiqueta:
- Si Score >= 65: 🟢 **High SaaS Potential**
- Si Score 50-64: 🟡 **Medium Potential**
- Si Score < 50: 🔴 **Low Potential**

IMPORTANTE: Responde TAMBIÉN con un bloque JSON al final del documento (después de todo el markdown), 
encerrado entre las etiquetas <json_score> y </json_score>, con este formato exacto:
<json_score>{"score": XX, "label": "high|medium|low"}</json_score>`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: project, error: projErr } = await supabase
      .from("business_projects")
      .select("name, company, sector, business_type, business_size, need_summary, need_why, need_budget, need_deadline, input_content, user_id")
      .eq("id", projectId)
      .single();

    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load wizard steps
    const { data: steps } = await supabase
      .from("project_wizard_steps")
      .select("step_number, output_data, status")
      .eq("project_id", projectId)
      .in("step_number", [2, 3, 4, 5, 7, 100, 200]);

    const stepMap: Record<number, string> = {};
    for (const s of steps || []) {
      const raw = typeof s.output_data === "string" ? s.output_data : JSON.stringify(s.output_data);
      stepMap[s.step_number] = truncate(raw);
    }

    const contextParts: string[] = [];
    contextParts.push(`PROYECTO: ${project.name}`);
    if (project.company) contextParts.push(`EMPRESA/CLIENTE: ${project.company}`);
    if (project.sector) contextParts.push(`SECTOR: ${project.sector}`);
    if (project.business_type) contextParts.push(`TIPO DE NEGOCIO: ${project.business_type}`);
    if (project.business_size) contextParts.push(`TAMAÑO: ${project.business_size}`);
    if (project.need_summary) contextParts.push(`RESUMEN DE NECESIDAD: ${project.need_summary}`);
    if (project.need_why) contextParts.push(`POR QUÉ: ${project.need_why}`);
    if (project.need_budget) contextParts.push(`PRESUPUESTO: ${project.need_budget}`);
    if (project.need_deadline) contextParts.push(`DEADLINE: ${project.need_deadline}`);
    if (project.input_content) contextParts.push(`CONTEXTO INICIAL:\n${truncate(project.input_content, 5000)}`);

    if (stepMap[2]) contextParts.push(`\n--- BRIEFING ---\n${stepMap[2]}`);
    if (stepMap[3]) contextParts.push(`\n--- ALCANCE ---\n${stepMap[3]}`);
    if (stepMap[4]) contextParts.push(`\n--- AUDITORÍA ---\n${stepMap[4]}`);
    if (stepMap[5]) contextParts.push(`\n--- PRD TÉCNICO ---\n${stepMap[5]}`);
    if (stepMap[7]) contextParts.push(`\n--- MVP ---\n${stepMap[7]}`);
    if (stepMap[100]) contextParts.push(`\n--- PROPUESTA ---\n${stepMap[100]}`);
    if (stepMap[200]) contextParts.push(`\n--- ESTRATEGIA LANZAMIENTO ---\n${truncate(stepMap[200], 8000)}`);

    const userPrompt = `Analiza toda la información del siguiente proyecto y genera una EVALUACIÓN DE OPORTUNIDAD SAAS objetiva y crítica.

${contextParts.join("\n")}

Genera el análisis completo en Markdown. NO uses H1 (#), empieza con H2 (##). 
Sé crítico, realista y específico al proyecto. No inventes datos que no estén en el contexto.
Recuerda incluir el bloque <json_score> al final.`;

    console.log(`[evaluate-saas-opportunity] Generating for project ${projectId} (${project.name})`);

    const result = await chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      {
        model: "gemini-pro",
        temperature: 0.5,
        maxTokens: 16000,
      }
    );

    // Extract score from JSON block
    let score = 0;
    let label = "low";
    const jsonMatch = result.match(/<json_score>\s*({.*?})\s*<\/json_score>/s);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        score = parsed.score || 0;
        label = parsed.label || (score >= 65 ? "high" : score >= 50 ? "medium" : "low");
      } catch { /* ignore */ }
    }

    // Clean markdown (remove the json_score block)
    const markdown = result.replace(/<json_score>.*?<\/json_score>/s, "").trim();

    // Save as step 201 — delete+insert for reliability
    await supabase
      .from("project_wizard_steps")
      .delete()
      .eq("project_id", projectId)
      .eq("step_number", 201);

    const { error: insertErr } = await supabase
      .from("project_wizard_steps")
      .insert({
        project_id: projectId,
        step_number: 201,
        step_name: "saas_evaluation",
        output_data: JSON.stringify({ markdown, score, label }),
        status: "completed",
        version: 1,
        user_id: project.user_id,
      });

    if (upsertErr) {
      console.error("[evaluate-saas-opportunity] Upsert error:", upsertErr);
    }

    return new Response(JSON.stringify({ markdown, score, label, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[evaluate-saas-opportunity] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

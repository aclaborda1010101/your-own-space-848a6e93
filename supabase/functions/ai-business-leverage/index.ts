import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

async function callClaude(system: string, prompt: string, maxTokens = 8192): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      temperature: 0.4,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content?.find((b: any) => b.type === "text")?.text || "";
}

function parseJSON(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return JSON.parse(cleaned.trim());
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const userId = claimsData.claims.sub;

    const { action, project_id, ...params } = await req.json();
    console.log(`[ai-business-leverage] action=${action} project_id=${project_id}`);

    // Verify project ownership
    const { data: project, error: projErr } = await supabase
      .from("business_projects")
      .select("*")
      .eq("id", project_id)
      .eq("user_id", userId)
      .single();

    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), { status: 404, headers: corsHeaders });
    }

    let result: any;

    switch (action) {
      case "generate_questionnaire": {
        const sector = params.sector || project.sector || "general";
        const size = params.business_size || project.business_size || "micro";
        const maxQ = size === "micro" ? 8 : size === "small" ? 12 : size === "medium" ? 15 : 20;

        // Update project with sector/size if provided
        if (params.sector || params.business_size || params.business_type) {
          await supabase.from("business_projects").update({
            sector: params.sector || project.sector,
            business_size: params.business_size || project.business_size,
            business_type: params.business_type || project.business_type,
          }).eq("id", project_id);
        }

        const isFarmacia = /farmac|pharma/i.test(sector);
        let questionnaire: any;

        if (isFarmacia) {
          questionnaire = {
            business_type: "farmacia",
            business_size: size,
            max_questions: 12,
            questionnaire: [
              {
                id: "q1", question: "¿Qué sistema de gestión de farmacia utilizan actualmente?",
                type: "single_choice", options: ["Nixfarma", "Farmatic", "Unycop", "Consoft", "Otro ERP farmacéutico", "Hojas de cálculo / manual"],
                internal_reason: "Determina nivel de digitalización base y posibilidades de integración", priority: "high", area: "software"
              },
              {
                id: "q2", question: "¿Con qué frecuencia experimentan desabastecimientos de medicamentos?",
                type: "single_choice", options: ["Diariamente", "Varias veces por semana", "Semanalmente", "Algunas veces al mes", "Raramente"],
                internal_reason: "Cuantifica la magnitud del problema principal", priority: "high", area: "operations"
              },
              {
                id: "q3", question: "¿Cuántas farmacias gestiona o coordina su organización?",
                type: "single_choice", options: ["1 farmacia", "2-5 farmacias", "6-15 farmacias", "16-50 farmacias", "Más de 50 farmacias"],
                internal_reason: "Escala del problema y tipo de solución necesaria", priority: "high", area: "operations"
              },
              {
                id: "q4", question: "¿Disponen de datos históricos de ventas y stock de al menos 2 años en formato digital?",
                type: "single_choice", options: ["Sí, más de 3 años", "Sí, aproximadamente 2 años", "Sí, pero menos de 2 años", "Solo datos parciales", "No disponemos de datos históricos digitales"],
                internal_reason: "Viabilidad de modelos predictivos de IA", priority: "high", area: "data"
              },
              {
                id: "q5", question: "¿Cuál es el principal dolor o impacto que les causa el desabastecimiento de medicamentos?",
                type: "open", options: null,
                internal_reason: "Identifica el pain point prioritario para enfocar la solución", priority: "high", area: "pain_points"
              },
              {
                id: "q6", question: "¿Qué métodos utilizan actualmente para predecir la demanda y anticipar compras?",
                type: "single_choice", options: ["Intuición y experiencia del farmacéutico", "Revisión manual de históricos de ventas", "Alertas automáticas del ERP cuando hay stock bajo", "Software específico de predicción de demanda", "No hacemos predicción, compramos cuando se agota"],
                internal_reason: "Nivel actual de sofisticación en predicción", priority: "high", area: "operations"
              },
              {
                id: "q7", question: "¿Tienen acceso a datos de alertas de la AEMPS o del CISMED sobre problemas de suministro, y los consultan activamente para anticipar compras?",
                type: "single_choice", options: ["Sí, los consultamos regularmente", "Sí, pero no los usamos de forma sistemática", "Conocemos las fuentes pero no las consultamos", "No conocemos estas fuentes"],
                internal_reason: "Uso de fuentes externas oficiales para anticipación", priority: "high", area: "data"
              },
              {
                id: "q8", question: "¿Qué fuentes de datos externos integran o estarían dispuestos a integrar?",
                type: "multi_choice", options: ["Datos epidemiológicos (gripe, alergias, etc.)", "Previsiones meteorológicas", "Calendario de eventos locales", "Datos demográficos de la zona", "Alertas de la AEMPS/CISMED", "Datos de distribuidoras mayoristas", "Ninguna actualmente"],
                internal_reason: "Potencial de enriquecimiento de datos para predicción", priority: "medium", area: "data"
              },
              {
                id: "q9", question: "¿Con cuántos proveedores/distribuidoras mayoristas trabajan habitualmente?",
                type: "single_choice", options: ["1 proveedor principal", "2-3 proveedores", "4-6 proveedores", "Más de 6 proveedores"],
                internal_reason: "Complejidad de la cadena de suministro", priority: "medium", area: "operations"
              },
              {
                id: "q10", question: "¿Cuántas personas se dedican a gestión de inventario y compras?",
                type: "single_choice", options: ["1 persona a tiempo parcial", "1 persona a tiempo completo", "2-3 personas", "Más de 3 personas", "Todo el equipo colabora sin rol fijo"],
                internal_reason: "Recursos humanos dedicados y potencial de automatización", priority: "medium", area: "team"
              },
              {
                id: "q11", question: "¿Qué nivel de automatización tienen en el proceso de reposición de stock?",
                type: "single_choice", options: ["Totalmente manual", "Pedidos semi-automáticos con revisión manual", "Pedidos automáticos para productos de alta rotación", "Sistema automatizado con excepciones manuales", "Altamente automatizado con IA/algoritmos"],
                internal_reason: "Nivel actual de automatización y margen de mejora", priority: "medium", area: "operations"
              },
              {
                id: "q12", question: "¿Cuál es su presupuesto anual aproximado para inversión en tecnología?",
                type: "single_choice", options: ["Menos de €5.000", "€5.000 - €15.000", "€15.000 - €30.000", "€30.000 - €60.000", "Más de €60.000"],
                internal_reason: "Determina viabilidad económica de las soluciones propuestas", priority: "medium", area: "budget"
              }
            ]
          };
        } else {
          const systemPrompt = `Eres un consultor senior de transformación digital. Genera cuestionarios adaptados al sector y tamaño del negocio para diagnosticar oportunidades de mejora con IA. Responde SOLO con JSON válido.`;

          const userPrompt = `Genera un cuestionario de diagnóstico para:
- Negocio: ${project.name}
- Empresa: ${project.company || "No especificada"}
- Sector: ${sector}
- Tamaño: ${size}
- Máximo ${maxQ} preguntas

Áreas a cubrir (prioriza según sector): software actual, sistema de reservas/ventas, gestión de clientes, marketing y captación, nivel de automatización, volumen operativo, equipo humano, datos históricos, principales dolores, presupuesto orientativo.

Adapta: Si es peluquería, no preguntes por ERP. Si es despacho de abogados, no preguntes por gestión de mesas.

Formato JSON:
{
  "business_type": "string",
  "business_size": "${size}",
  "max_questions": ${maxQ},
  "questionnaire": [
    {
      "id": "q1",
      "question": "string",
      "type": "single_choice | multi_choice | open | yes_no | scale_1_10",
      "options": ["opt1", "opt2"] | null,
      "internal_reason": "string",
      "priority": "high | medium",
      "area": "software | crm | marketing | operations | data | team | pain_points | budget"
    }
  ]
}`;

          const raw = await callClaude(systemPrompt, userPrompt, 4096);
          questionnaire = parseJSON(raw);
        }

        // Save template
        const { data: template } = await supabase.from("bl_questionnaire_templates").insert({
          sector,
          business_size: size,
          max_questions: maxQ,
          questions: questionnaire.questionnaire,
        }).select().single();

        // Create response record with _questions fallback
        const { data: response } = await supabase.from("bl_questionnaire_responses").insert({
          project_id,
          template_id: template?.id || null,
          responses: { _questions: questionnaire.questionnaire },
        }).select().single();

        result = { questionnaire, template_id: template?.id, response_id: response?.id };
        break;
      }

      case "analyze_responses": {
        const { response_id } = params;

        // Get questionnaire response
        const { data: qResponse } = await supabase
          .from("bl_questionnaire_responses")
          .select("*, bl_questionnaire_templates(*)")
          .eq("id", response_id)
          .single();

        if (!qResponse) {
          return new Response(JSON.stringify({ error: "Response not found" }), { status: 404, headers: corsHeaders });
        }

        const systemPrompt = `Eres un consultor senior de transformación digital orientado a ROI real. Analiza las respuestas del cuestionario y genera un diagnóstico detallado. Sé específico, no genérico. Responde SOLO con JSON válido.`;

        const questions = (qResponse as any).bl_questionnaire_templates?.questions || [];
        const responses = qResponse.responses as Record<string, any>;

        const qaPairs = questions.map((q: any) => `P: ${q.question}\nR: ${responses[q.id] || "Sin respuesta"}`).join("\n\n");

        const userPrompt = `Analiza este diagnóstico de negocio:

Empresa: ${project.name} (${project.company || "N/A"})
Sector: ${project.sector || "general"}
Tamaño: ${project.business_size || "micro"}

RESPUESTAS:
${qaPairs}

Genera diagnóstico JSON:
{
  "scores": {
    "digital_maturity": 0-100,
    "automation_level": 0-100,
    "data_readiness": 0-100,
    "ai_opportunity": 0-100
  },
  "critical_findings": {
    "manual_processes": ["string"],
    "time_leaks": ["string"],
    "person_dependencies": ["string"],
    "bottlenecks": ["string"],
    "quick_wins": ["string"],
    "underused_tools": ["string"]
  },
  "data_gaps": [
    { "gap": "string", "impact": "string", "unlocks": "string" }
  ]
}`;

        const raw = await callClaude(systemPrompt, userPrompt, 4096);
        const diagnostic = parseJSON(raw);

        // Save diagnostic
        const { data: saved, error: saveError } = await supabase.from("bl_diagnostics").upsert({
          project_id,
          digital_maturity_score: diagnostic.scores.digital_maturity,
          automation_level: diagnostic.scores.automation_level,
          data_readiness: diagnostic.scores.data_readiness,
          ai_opportunity_score: diagnostic.scores.ai_opportunity,
          manual_processes: diagnostic.critical_findings.manual_processes,
          time_leaks: diagnostic.critical_findings.time_leaks,
          person_dependencies: diagnostic.critical_findings.person_dependencies,
          bottlenecks: diagnostic.critical_findings.bottlenecks,
          quick_wins: diagnostic.critical_findings.quick_wins,
          underused_tools: diagnostic.critical_findings.underused_tools,
          data_gaps: diagnostic.data_gaps,
        }, { onConflict: "project_id" }).select().single();

        if (saveError) throw new Error("Failed to save diagnostic: " + saveError.message);

        // Mark response as completed
        await supabase.from("bl_questionnaire_responses").update({ completed_at: new Date().toISOString() }).eq("id", response_id);

        result = { diagnostic, id: saved?.id };
        break;
      }

      case "generate_recommendations": {
        // Get diagnostic
        const { data: diag } = await supabase
          .from("bl_diagnostics")
          .select("*")
          .eq("project_id", project_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!diag) {
          return new Response(JSON.stringify({ error: "No diagnostic found. Run analyze_responses first." }), { status: 400, headers: corsHeaders });
        }

        const systemPrompt = `Eres un consultor senior de transformación digital. Genera recomendaciones concretas, cuantificadas y ordenadas por impacto. NUNCA recomendaciones genéricas. Cada una debe tener cuantificación con rangos y fuente de estimación. Responde SOLO con JSON válido.`;

        const userPrompt = `Genera plan de mejora por capas para:

Empresa: ${project.name} (${project.company || "N/A"})
Sector: ${project.sector || "general"}
Tamaño: ${project.business_size || "micro"}

DIAGNÓSTICO:
- Digital Maturity: ${diag.digital_maturity_score}/100
- Automation: ${diag.automation_level}/100
- Data Readiness: ${diag.data_readiness}/100
- AI Opportunity: ${diag.ai_opportunity_score}/100

Procesos manuales: ${JSON.stringify(diag.manual_processes)}
Fugas de tiempo: ${JSON.stringify(diag.time_leaks)}
Quick wins detectados: ${JSON.stringify(diag.quick_wins)}
Data gaps: ${JSON.stringify(diag.data_gaps)}

REGLAS:
- Capa 1: Quick Wins. Al menos 1 implementable en <14 días. Sin excepción.
- Capa 2: Optimización Workflow
- Capa 3: Ventaja Competitiva
- Capa 4: Nuevas Líneas de Ingreso
- Capa 5: Transformación (solo si hay base real)
- Para micro/small: priorizar soluciones simples y baratas
- Priority Score = (Impacto × confidence_score_internal) / Dificultad

JSON array:
[
  {
    "layer": 1-5,
    "title": "string",
    "description": "string detallado",
    "time_saved_hours_week_range": [min, max],
    "productivity_uplift_pct_range": [min, max],
    "revenue_impact_month_range": [min, max],
    "investment_month_range": [min, max],
    "difficulty": "low|medium|high",
    "difficulty_score": 1-5,
    "implementation_time": "string",
    "confidence_display": "high|medium|low",
    "confidence_score_internal": 0.0-1.0,
    "estimation_source": "sector_benchmark|similar_case|logical_estimation|requires_data",
    "priority_score": number,
    "implementable_under_14_days": boolean
  }
]`;

        const raw = await callClaude(systemPrompt, userPrompt, 8192);
        const recs = parseJSON(raw);

        // Delete old recommendations for this project
        await supabase.from("bl_recommendations").delete().eq("project_id", project_id);

        // Insert new ones
        const toInsert = (Array.isArray(recs) ? recs : recs.recommendations || []).map((r: any) => ({
          project_id,
          layer: r.layer,
          title: r.title,
          description: r.description,
          time_saved_hours_week_min: r.time_saved_hours_week_range?.[0],
          time_saved_hours_week_max: r.time_saved_hours_week_range?.[1],
          productivity_uplift_pct_min: r.productivity_uplift_pct_range?.[0],
          productivity_uplift_pct_max: r.productivity_uplift_pct_range?.[1],
          revenue_impact_month_min: r.revenue_impact_month_range?.[0],
          revenue_impact_month_max: r.revenue_impact_month_range?.[1],
          investment_month_min: r.investment_month_range?.[0],
          investment_month_max: r.investment_month_range?.[1],
          difficulty: r.difficulty,
          difficulty_score: r.difficulty_score,
          implementation_time: r.implementation_time,
          confidence_display: r.confidence_display,
          confidence_score_internal: r.confidence_score_internal,
          estimation_source: r.estimation_source,
          priority_score: r.priority_score,
          implementable_under_14_days: r.implementable_under_14_days,
        }));

        const { data: saved, error: saveRecsError } = await supabase.from("bl_recommendations").insert(toInsert).select();
        if (saveRecsError) throw new Error("Failed to save recommendations: " + saveRecsError.message);
        result = { recommendations: saved, count: saved?.length };
        break;
      }

      case "generate_roadmap": {
        // Get diagnostic + recommendations
        const [{ data: diag }, { data: recs }] = await Promise.all([
          supabase.from("bl_diagnostics").select("*").eq("project_id", project_id).order("created_at", { ascending: false }).limit(1).single(),
          supabase.from("bl_recommendations").select("*").eq("project_id", project_id).order("priority_score", { ascending: false }),
        ]);

        if (!diag || !recs?.length) {
          return new Response(JSON.stringify({ error: "Need diagnostic and recommendations first" }), { status: 400, headers: corsHeaders });
        }

        const systemPrompt = `Eres un consultor senior. Genera un roadmap profesional vendible, enviable al cliente sin edición. Formato markdown. Tono consultivo, profesional, orientado a ROI.`;

        const recsSummary = recs.map((r: any) =>
          `[Capa ${r.layer}] ${r.title} — Ahorro: ${r.time_saved_hours_week_min}-${r.time_saved_hours_week_max}h/sem | Revenue: €${r.revenue_impact_month_min}-${r.revenue_impact_month_max}/mes | Dificultad: ${r.difficulty} | Priority: ${r.priority_score}`
        ).join("\n");

        const userPrompt = `Genera roadmap vendible para:

Empresa: ${project.name} (${project.company || "N/A"})
Sector: ${project.sector || "general"}

DIAGNÓSTICO:
- Digital Maturity: ${diag.digital_maturity_score}/100
- Automation: ${diag.automation_level}/100
- Data Readiness: ${diag.data_readiness}/100
- AI Opportunity: ${diag.ai_opportunity_score}/100
- Data Gaps: ${JSON.stringify(diag.data_gaps)}

RECOMENDACIONES (${recs.length}):
${recsSummary}

ESTRUCTURA DEL DOCUMENTO:
1. Resumen Ejecutivo (max 5 líneas)
2. Diagnóstico Actual — scores, ineficiencias, data gaps
3. Oportunidades Detectadas — ordenadas por Priority Score
4. Quick Wins (primeros 14-30 días)
5. Plan 90 Días
6. Plan 12 Meses (si aplica capas 3-5)
7. Impacto Económico Global — ahorro, productividad, ingresos, ROI
8. Propuesta de Implementación y Pricing orientativo

Responde con JSON:
{
  "executive_summary": "string",
  "quick_wins_plan": [{"title": "string", "timeline": "string", "impact": "string"}],
  "plan_90_days": [{"title": "string", "timeline": "string", "impact": "string"}],
  "plan_12_months": [{"title": "string", "timeline": "string", "impact": "string"}],
  "economic_impact": {
    "time_saved_range": "string",
    "productivity_range": "string",
    "revenue_range": "string",
    "roi_range": "string"
  },
  "implementation_model": "saas|license|custom_software|hybrid",
  "pricing_recommendation": {
    "recommended_tier": "tier_1|tier_2|tier_3|tier_4",
    "setup_range": "string",
    "monthly_range": "string"
  },
  "full_document_md": "full markdown document"
}`;

        const raw = await callClaude(systemPrompt, userPrompt, 12000);
        const roadmap = parseJSON(raw);

        // Get existing version count
        const { count } = await supabase.from("bl_roadmaps").select("id", { count: "exact" }).eq("project_id", project_id);

        const { data: saved, error: saveRoadmapError } = await supabase.from("bl_roadmaps").insert({
          project_id,
          version: (count || 0) + 1,
          executive_summary: roadmap.executive_summary,
          quick_wins_plan: roadmap.quick_wins_plan,
          plan_90_days: roadmap.plan_90_days,
          plan_12_months: roadmap.plan_12_months,
          economic_impact: roadmap.economic_impact,
          implementation_model: roadmap.implementation_model,
          pricing_recommendation: roadmap.pricing_recommendation,
          full_document_md: roadmap.full_document_md,
        }).select().single();

        if (saveRoadmapError) throw new Error("Failed to save roadmap: " + saveRoadmapError.message);
        result = { roadmap: saved };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[ai-business-leverage] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function recordCost(
  supabase: ReturnType<typeof createClient>,
  params: {
    projectId: string;
    stepNumber: number;
    service: string;
    operation: string;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
    userId: string;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from("project_costs").insert({
    project_id: params.projectId,
    step_number: params.stepNumber,
    service: params.service,
    operation: params.operation,
    tokens_input: params.tokensInput,
    tokens_output: params.tokensOutput,
    cost_usd: params.costUsd,
    user_id: params.userId,
    metadata: params.metadata || {},
  });
}

// ── Gemini Flash for extraction ────────────────────────────────────────────

async function callGeminiFlash(systemPrompt: string, userPrompt: string) {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 16384, responseMimeType: "application/json" },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 404) {
      throw new Error(`Modelo Gemini no disponible. Verifica que tu API key tenga acceso al modelo solicitado. Detalle: ${err}`);
    }
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const usage = data.usageMetadata || {};
  return {
    text,
    tokensInput: usage.promptTokenCount || 0,
    tokensOutput: usage.candidatesTokenCount || 0,
  };
}

// ── Claude Sonnet for scope generation ─────────────────────────────────────

async function callClaudeSonnet(systemPrompt: string, userPrompt: string) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16384,
      temperature: 0.4,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.content?.find((b: { type: string }) => b.type === "text")?.text || "";
  return {
    text,
    tokensInput: data.usage?.input_tokens || 0,
    tokensOutput: data.usage?.output_tokens || 0,
  };
}

// ── Gemini Pro fallback for scope generation ──────────────────────────────

async function callGeminiPro(systemPrompt: string, userPrompt: string) {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 16384 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini Pro API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const usage = data.usageMetadata || {};
  return {
    text,
    tokensInput: usage.promptTokenCount || 0,
    tokensOutput: usage.candidatesTokenCount || 0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("authorization");
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, projectId, stepData } = body;
    const supabase = getSupabaseAdmin();

    // ── Action: extract (Step 2) ─────────────────────────────────────────

    if (action === "extract") {
      const { projectName, companyName, projectType, clientNeed, inputContent } = stepData;

      const systemPrompt = `Eres un analista senior de proyectos tecnológicos con 15 años de experiencia en consultoría. Tu trabajo es extraer TODA la información relevante de una transcripción, reunión o documento y convertirla en un briefing estructurado que permita a un equipo de desarrollo comenzar a trabajar sin necesidad de leer el material original.

REGLAS CRÍTICAS:
- NUNCA inventes información que no esté en el input. Si algo no está claro, márcalo como "[PENDIENTE DE CONFIRMAR]".
- EXTRAE TODOS los datos cuantitativos: cifras, porcentajes, cantidades, plazos, precios, dimensiones de equipo, número de usuarios/vehículos/empleados.
- PRIORIZA usando P0 (crítico para MVP), P1 (importante post-MVP), P2 (deseable futuro).
- IDENTIFICA decisiones ya tomadas vs. opciones abiertas. Las decisiones confirmadas son hechos, no sugerencias.
- CAPTURA el contexto comercial: expectativas de precio del cliente, señales de urgencia, riesgos de relación.
- Los stakeholders no son solo nombres y roles — incluye qué dolor específico sufre cada uno y qué poder de decisión tiene.
- Usa el idioma del input.
- Responde SOLO con JSON válido. Sin explicaciones, sin markdown, sin backticks.`;

      const userPrompt = `INPUT DEL USUARIO:
Nombre del proyecto: ${projectName}
Empresa cliente: ${companyName}
Tipo de proyecto: ${projectType}
Necesidad declarada por el cliente: ${clientNeed || "No proporcionada — extraer del material"}

Material de entrada:
${inputContent}

GENERA UN BRIEFING CON ESTA ESTRUCTURA EXACTA (JSON):
{
  "resumen_ejecutivo": "3-5 frases que capturan: qué empresa es, qué problema tiene, qué solución se plantea, y cuál es la magnitud",
  "cliente": {
    "empresa": "nombre legal si aparece",
    "nombre_comercial": "nombre de uso si difiere",
    "sector": "sector específico",
    "tamaño": "nº empleados/vehículos/sedes u otro indicador",
    "ubicaciones": ["sede 1", "sede 2"],
    "contexto_operativo": "cómo opera actualmente en 2-3 frases",
    "contexto_comercial": "expectativas de precio, urgencia percibida, señales de compromiso o duda"
  },
  "necesidad_principal": "la necesidad core en 2-3 frases, con datos cuantitativos si existen",
  "objetivos": [
    {"objetivo": "descripción", "prioridad": "P0/P1/P2", "métrica_éxito": "cómo se mide si aplica"}
  ],
  "problemas_detectados": [
    {"problema": "descripción con datos concretos", "gravedad": "alta/media/baja", "impacto": "a quién afecta y cómo"}
  ],
  "decisiones_confirmadas": [
    {"decisión": "qué se decidió", "contexto": "por qué", "implicación_técnica": "qué significa para el desarrollo"}
  ],
  "decisiones_pendientes": [
    {"tema": "qué hay que decidir", "opciones": ["opción A", "opción B"], "dependencia": "qué bloquea"}
  ],
  "alcance_preliminar": {
    "incluido": [{"funcionalidad": "descripción", "prioridad": "P0/P1/P2", "módulo": "nombre del módulo"}],
    "excluido": [{"funcionalidad": "descripción", "motivo": "por qué se excluye"}],
    "supuestos": ["supuesto 1 con contexto"]
  },
  "stakeholders": [
    {"nombre": "nombre", "rol": "rol en la empresa", "tipo": "decisor/usuario_clave/técnico/financiero", "dolor_principal": "qué problema sufre", "poder_decisión": "alto/medio/bajo", "notas": "detalles relevantes"}
  ],
  "datos_cuantitativos": {
    "cifras_clave": [{"descripción": "dato", "valor": "número/rango", "fuente": "quién lo dijo"}],
    "presupuesto_cliente": "lo mencionado o intuido",
    "estimación_proveedor": "lo estimado"
  },
  "restricciones": ["restricción con detalle"],
  "datos_faltantes": [
    {"qué_falta": "dato", "impacto": "qué bloquea", "responsable": "quién debe proporcionarlo"}
  ],
  "alertas": [
    {"descripción": "alerta", "gravedad": "alta/media/baja", "acción_sugerida": "qué hacer"}
  ],
  "integraciones_identificadas": [
    {"nombre": "sistema", "tipo": "API/manual/por definir", "estado": "confirmado/por evaluar", "notas": "detalles"}
  ],
  "nivel_complejidad": "bajo/medio/alto/muy alto",
  "urgencia": "baja/media/alta/crítica",
  "confianza_extracción": "alta/media/baja"
}`;

      const result = await callGeminiFlash(systemPrompt, userPrompt);

      // Parse JSON from response
      let briefing;
      try {
        let cleaned = result.text.trim();
        if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
        if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
        if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
        briefing = JSON.parse(cleaned.trim());
      } catch {
        briefing = { raw_text: result.text, parse_error: true };
      }

      // Calculate cost
      const costUsd = (result.tokensInput / 1_000_000) * 0.075 + (result.tokensOutput / 1_000_000) * 0.30;

      // Record cost
      await recordCost(supabase, {
        projectId, stepNumber: 2, service: "gemini-flash", operation: "extract_briefing",
        tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
        costUsd, userId: user.id,
      });

      // Save step
      const { data: existingStep } = await supabase
        .from("project_wizard_steps")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("step_number", 2)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const newVersion = existingStep ? existingStep.version + 1 : 1;

      await supabase.from("project_wizard_steps").upsert({
        id: existingStep?.id || undefined,
        project_id: projectId,
        step_number: 2,
        step_name: "Extracción Inteligente",
        status: "review",
        input_data: { projectName, companyName, projectType, clientNeed, inputContent: inputContent.substring(0, 500) },
        output_data: briefing,
        model_used: "gemini-2.5-flash",
        version: newVersion,
        user_id: user.id,
      });

      // Update project current_step
      await supabase.from("business_projects").update({ current_step: 2 }).eq("id", projectId);

      return new Response(JSON.stringify({ briefing, cost: costUsd, version: newVersion }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: generate_scope (Step 3) ──────────────────────────────────

    if (action === "generate_scope") {
      const { briefingJson, contactName, currentDate } = stepData;

      const systemPrompt = `Eres un director de proyectos senior de una consultora tecnológica premium. Generas documentos de alcance que se presentan directamente a comités de dirección y que sirven como base contractual.

ESTILO Y FORMATO:
- Profesional, preciso y accionable. Cada sección debe aportar valor, no relleno.
- Cuantifica SIEMPRE: plazos en semanas, costes en rangos, recursos necesarios, métricas de éxito.
- Las recomendaciones deben ser concretas y justificadas, nunca genéricas.
- Vincula SIEMPRE el cronograma con los costes: cada fase tiene tiempo Y coste asociado.
- Prioriza usando P0/P1/P2 heredados del briefing.
- Si detectas inconsistencias o riesgos no mencionados en el briefing, señálalos en la sección de riesgos.
- Idioma: español (España).
- Formato: Markdown con estructura clara.
- NO uses frases vacías tipo "se estudiará", "se analizará oportunamente". Sé específico.

REGLA DE ORO: Un lector debe poder entender el proyecto completo, su coste, sus fases y sus riesgos leyendo SOLO este documento.`;

      const briefingStr = typeof briefingJson === 'string' ? briefingJson : JSON.stringify(briefingJson, null, 2);

      const userPrompt = `BRIEFING APROBADO DEL PROYECTO:
${briefingStr}

DATOS DE CONTEXTO:
- Empresa ejecutora: Agustito (consultora tecnológica y marketing digital)
- Responsable del proyecto: Agustín Cifuentes
- Contacto cliente: ${contactName || "No especificado"}
- Fecha: ${currentDate || new Date().toISOString().split('T')[0]}

GENERA UN DOCUMENTO DE ALCANCE COMPLETO EN MARKDOWN con estas secciones:

# 1. PORTADA
Nombre del proyecto, cliente, ejecutor, fecha, versión, confidencialidad.

# 2. RESUMEN EJECUTIVO
3-5 párrafos: contexto del cliente, problema, solución propuesta, magnitud y beneficio esperado.

# 3. OBJETIVOS DEL PROYECTO
| Objetivo | Prioridad (P0/P1/P2) | Métrica de éxito | Plazo estimado |

# 4. STAKEHOLDERS Y RESPONSABILIDADES
| Nombre | Rol | Responsabilidad en el proyecto | Poder de decisión |

# 5. ALCANCE DETALLADO
## 5.1 Módulos y funcionalidades
| Módulo | Funcionalidades clave | Prioridad | Fase |
## 5.2 Arquitectura técnica
## 5.3 Integraciones
| Sistema | Tipo | Estado | Riesgo |
## 5.4 Exclusiones explícitas
## 5.5 Supuestos y dependencias

# 6. PLAN DE IMPLEMENTACIÓN POR FASES
Para CADA fase: nombre, duración en semanas, módulos/entregables, dependencias, criterios de aceptación.

# 7. INVERSIÓN Y ESTRUCTURA DE COSTES
## 7.1 Inversión por fase
| Fase | Alcance | Duración | Rango de inversión |
## 7.2 Costes recurrentes mensuales
## 7.3 Comparativa con alternativas (si aplica)

# 8. ANÁLISIS DE RIESGOS
| Riesgo | Probabilidad | Impacto | Mitigación | Responsable |

# 9. DATOS PENDIENTES Y BLOQUEOS
| Dato faltante | Impacto si no se obtiene | Responsable | Fecha límite sugerida |

# 10. DECISIONES TÉCNICAS CONFIRMADAS

# 11. PRÓXIMOS PASOS
| Acción | Responsable | Fecha Límite |

# 12. CONDICIONES Y ACEPTACIÓN
Validez de la propuesta, condiciones de cambio de alcance, firma.`;

      let result: { text: string; tokensInput: number; tokensOutput: number };
      let modelUsed = "claude-sonnet-4";
      let fallbackUsed = false;

      try {
        result = await callClaudeSonnet(systemPrompt, userPrompt);
      } catch (claudeError) {
        console.warn("Claude failed, falling back to Gemini Pro:", claudeError instanceof Error ? claudeError.message : claudeError);
        result = await callGeminiPro(systemPrompt, userPrompt);
        modelUsed = "gemini-2.5-pro";
        fallbackUsed = true;
      }

      const costUsd = fallbackUsed
        ? (result.tokensInput / 1_000_000) * 1.25 + (result.tokensOutput / 1_000_000) * 10.00
        : (result.tokensInput / 1_000_000) * 3.00 + (result.tokensOutput / 1_000_000) * 15.00;

      await recordCost(supabase, {
        projectId, stepNumber: 3, service: fallbackUsed ? "gemini-pro" : "claude-sonnet", operation: "generate_scope",
        tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
        costUsd, userId: user.id,
        metadata: fallbackUsed ? { fallback: true, original_error: "claude_unavailable" } : {},
      });

      // Save step
      const { data: existingStep } = await supabase
        .from("project_wizard_steps")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("step_number", 3)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const newVersion = existingStep ? existingStep.version + 1 : 1;

      await supabase.from("project_wizard_steps").upsert({
        id: existingStep?.id || undefined,
        project_id: projectId,
        step_number: 3,
        step_name: "Documento de Alcance",
        status: "review",
        input_data: { briefingJson: briefingStr.substring(0, 500) },
        output_data: { document: result.text },
        model_used: modelUsed,
        version: newVersion,
        user_id: user.id,
      });

      // Save document
      await supabase.from("project_documents").insert({
        project_id: projectId,
        step_number: 3,
        version: newVersion,
        content: result.text,
        format: "markdown",
        user_id: user.id,
      });

      await supabase.from("business_projects").update({ current_step: 3 }).eq("id", projectId);

      return new Response(JSON.stringify({ document: result.text, cost: costUsd, version: newVersion, modelUsed, fallbackUsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Generic step handler (Steps 4-9) ─────────────────────────────────

    const STEP_ACTION_MAP: Record<string, { stepNumber: number; stepName: string; useJson: boolean; model: "flash" | "claude" }> = {
      "run_audit":         { stepNumber: 4, stepName: "Auditoría Cruzada",    useJson: true,  model: "flash" },
      "generate_final_doc":{ stepNumber: 5, stepName: "Documento Final",      useJson: false, model: "claude" },
      "run_ai_leverage":   { stepNumber: 6, stepName: "AI Leverage",          useJson: true,  model: "flash" },
      "generate_prd":      { stepNumber: 7, stepName: "PRD Técnico",          useJson: false, model: "claude" },
      "generate_rags":     { stepNumber: 8, stepName: "Generación de RAGs",   useJson: true,  model: "claude" },
      "detect_patterns":   { stepNumber: 9, stepName: "Detección de Patrones",useJson: true,  model: "claude" },
    };

    const stepConfig = STEP_ACTION_MAP[action];
    if (stepConfig) {
      const { stepNumber, stepName, useJson, model } = stepConfig;
      
      // Build prompts based on step
      let systemPrompt = "";
      let userPrompt = "";
      const sd = stepData;
      const briefStr = typeof sd.briefingJson === "string" ? sd.briefingJson : JSON.stringify(sd.briefingJson || {}, null, 2);
      const scopeStr = typeof sd.scopeDocument === "string" ? sd.scopeDocument : JSON.stringify(sd.scopeDocument || {}, null, 2);
      const auditStr = typeof sd.auditJson === "string" ? sd.auditJson : JSON.stringify(sd.auditJson || {}, null, 2);
      const finalStr = typeof sd.finalDocument === "string" ? sd.finalDocument : JSON.stringify(sd.finalDocument || {}, null, 2);
      const aiLevStr = typeof sd.aiLeverageJson === "string" ? sd.aiLeverageJson : JSON.stringify(sd.aiLeverageJson || {}, null, 2);
      const prdStr = typeof sd.prdDocument === "string" ? sd.prdDocument : JSON.stringify(sd.prdDocument || {}, null, 2);

      if (action === "run_audit") {
        systemPrompt = `Eres un auditor de calidad de proyectos tecnológicos con 15 años de experiencia en consultoras Big Four. Compara el documento de alcance contra el material fuente original y detecta TODAS las discrepancias, omisiones o inconsistencias. Asigna códigos [H-XX] secuenciales. Clasifica por severidad: 🔴 CRÍTICO, 🟠 IMPORTANTE, 🟢 MENOR. Para CADA hallazgo incluye: sección afectada, problema, dato original textual (cita EXACTA), acción requerida, consecuencia de no corregir. Incluye tabla de puntuación por sección (0-100) con notas. Recomendación final: APROBAR / APROBAR CON CORRECCIONES / RECHAZAR Y REGENERAR. Responde SOLO con JSON válido.`;
        userPrompt = `MATERIAL FUENTE ORIGINAL:\n${sd.originalInput || ""}\n\nBRIEFING (Fase 2):\n${briefStr}\n\nDOCUMENTO DE ALCANCE (Fase 3):\n${scopeStr}\n\nGenera auditoría cruzada exhaustiva en JSON con: puntuación_global, resumen_auditoría, hallazgos (con codigo, tipo, severidad, indicador_visual, sección_afectada, descripción, dato_original_textual, acción_requerida, consecuencia_si_no_se_corrige), puntuación_por_sección, datos_original_no_usados, recomendación, resumen_hallazgos.`;
      } else if (action === "generate_final_doc") {
        systemPrompt = `Eres un director de proyectos senior. Se te proporciona un documento de alcance y una auditoría con hallazgos [H-XX]. Genera la VERSIÓN FINAL del documento incorporando TODAS las correcciones. Para cada [H-XX], genera texto listo para insertar. Si un hallazgo requiere nueva sección, escríbela completa. El documento final debe leerse como si siempre hubiera sido correcto. Al final incluye CHANGELOG INTERNO separado por --- con tabla: Hallazgo | Severidad | Acción tomada. Idioma: español (España).`;
        userPrompt = `DOCUMENTO DE ALCANCE (versión anterior):\n${scopeStr}\n\nRESULTADO DE AUDITORÍA:\n${auditStr}\n\nBRIEFING ORIGINAL:\n${briefStr}\n\nRegenera el documento COMPLETO con todas las correcciones integradas + changelog interno.`;
      } else if (action === "run_ai_leverage") {
        systemPrompt = `Eres un arquitecto de soluciones de IA con experiencia práctica. Analiza el proyecto y propone EXACTAMENTE dónde y cómo la IA aporta valor real, con estimaciones basadas en volúmenes reales. Si una regla de negocio simple resuelve el problema, marca como REGLA_NEGOCIO_MEJOR. Incluye Quick Wins y Stack IA recomendado. Responde SOLO con JSON válido.`;
        userPrompt = `DOCUMENTO DE ALCANCE FINAL:\n${finalStr}\n\nBRIEFING:\n${briefStr}\n\nGenera análisis de AI Leverage en JSON con: resumen, oportunidades (id, nombre, módulo, tipo, modelo_recomendado, como_funciona, coste_api_estimado, calculo_volumen, precisión, esfuerzo, roi_estimado, es_mvp, prioridad, dependencias), quick_wins, stack_ia_recomendado, coste_ia_total_mensual_estimado.`;
      } else if (action === "generate_prd") {
        systemPrompt = `Eres un Product Manager técnico senior. Generas PRDs que los equipos de desarrollo usan como fuente de verdad. Incluye: personas detalladas (mín 3) con perfil demográfico real, modelo de datos con tablas y campos REALES, flujos paso a paso por tipo de usuario, criterios DADO/CUANDO/ENTONCES con métricas, stack con tecnologías concretas. Idioma: español (España).`;
        userPrompt = `DOCUMENTO FINAL:\n${finalStr}\n\nAI LEVERAGE:\n${aiLevStr}\n\nBRIEFING:\n${briefStr}\n\nGenera PRD técnico completo en Markdown con: Visión, Personas, Arquitectura (stack, modelo de datos, integraciones), Funcionalidades por módulo (flujos, criterios de aceptación), Diseño de IA, API Design, Plan de Testing, Métricas, Roadmap.`;
      } else if (action === "generate_rags") {
        systemPrompt = `Eres un ingeniero de RAG especializado. Organiza la documentación del proyecto en 45-60 chunks semánticos autocontenidos (200-500 tokens). Cada chunk debe ser comprensible independientemente. Incluye distribución por categoría. FAQs deben explicar el "por qué" de las decisiones. Responde SOLO con JSON válido.`;
        userPrompt = `PRD Técnico:\n${prdStr}\n\nDocumento de Alcance:\n${finalStr}\n\nBriefing:\n${briefStr}\n\nAI Leverage:\n${aiLevStr}\n\nGenera estructura RAG completa en JSON con: proyecto "${sd.projectName}", total_chunks, distribución, chunks (id, categoría, módulo, fase, prioridad, título, contenido autocontenido, tags, dependencias), faqs_generadas, embeddings_config.`;
      } else if (action === "detect_patterns") {
        systemPrompt = `Eres un analista de negocio senior. Detecta patrones reutilizables (con nombre de producto tipo "DocCapture", "FleetDash") y oportunidades comerciales con pitches listos para reunión. Score del cliente con dimensiones + siguiente contacto con fecha y motivo. Responde SOLO con JSON válido.`;
        userPrompt = `Briefing:\n${briefStr}\n\nDocumento Final:\n${finalStr}\n\nPRD Técnico:\n${prdStr}\n\nAI Leverage:\n${aiLevStr}\n\nGenera análisis de patrones en JSON con: resumen, patrones_técnicos (con componente_extraíble), oportunidades_comerciales (con pitch_sugerido y timing), señales_necesidades_futuras, aprendizajes_proceso, score_cliente.`;
      }

      let result: { text: string; tokensInput: number; tokensOutput: number };
      let modelUsed = model === "flash" ? "gemini-2.5-flash" : "claude-sonnet-4";
      let fallbackUsed = false;

      if (model === "flash" || useJson && model === "flash") {
        result = await callGeminiFlash(systemPrompt, userPrompt);
      } else {
        try {
          result = await callClaudeSonnet(systemPrompt, userPrompt);
        } catch (claudeError) {
          console.warn(`Claude failed for step ${stepNumber}, falling back to Gemini Pro:`, claudeError instanceof Error ? claudeError.message : claudeError);
          result = await callGeminiPro(systemPrompt, userPrompt);
          modelUsed = "gemini-2.5-pro";
          fallbackUsed = true;
        }
      }

      // Parse output
      let outputData: any;
      if (useJson) {
        try {
          let cleaned = result.text.trim();
          if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
          if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
          if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
          outputData = JSON.parse(cleaned.trim());
        } catch {
          outputData = { raw_text: result.text, parse_error: true };
        }
      } else {
        outputData = { document: result.text };
      }

      // Calculate cost
      const costRates: Record<string, { input: number; output: number }> = {
        "gemini-2.5-flash": { input: 0.075, output: 0.30 },
        "claude-sonnet-4": { input: 3.00, output: 15.00 },
        "gemini-2.5-pro": { input: 1.25, output: 10.00 },
      };
      const rates = costRates[modelUsed] || costRates["gemini-2.5-flash"];
      const costUsd = (result.tokensInput / 1_000_000) * rates.input + (result.tokensOutput / 1_000_000) * rates.output;

      await recordCost(supabase, {
        projectId, stepNumber, service: modelUsed, operation: action,
        tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
        costUsd, userId: user.id,
        metadata: fallbackUsed ? { fallback: true } : {},
      });

      // Save step
      const { data: existingStep } = await supabase
        .from("project_wizard_steps")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("step_number", stepNumber)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const newVersion = existingStep ? existingStep.version + 1 : 1;

      await supabase.from("project_wizard_steps").upsert({
        id: existingStep?.id || undefined,
        project_id: projectId,
        step_number: stepNumber,
        step_name: stepName,
        status: "review",
        input_data: { action },
        output_data: outputData,
        model_used: modelUsed,
        version: newVersion,
        user_id: user.id,
      });

      // Save document for markdown steps
      if (!useJson) {
        await supabase.from("project_documents").insert({
          project_id: projectId,
          step_number: stepNumber,
          version: newVersion,
          content: result.text,
          format: "markdown",
          user_id: user.id,
        });
      }

      await supabase.from("business_projects").update({ current_step: stepNumber }).eq("id", projectId);

      return new Response(JSON.stringify({ output: outputData, cost: costUsd, version: newVersion, modelUsed, fallbackUsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: approve_step ─────────────────────────────────────────────

    if (action === "approve_step") {
      const { stepNumber, outputData } = stepData;

      await supabase
        .from("project_wizard_steps")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          output_data: outputData || undefined,
        })
        .eq("project_id", projectId)
        .eq("step_number", stepNumber)
        .order("version", { ascending: false })
        .limit(1);

      await supabase.from("business_projects")
        .update({ current_step: stepNumber + 1 })
        .eq("id", projectId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: get_costs ────────────────────────────────────────────────

    if (action === "get_costs") {
      const { data: costs } = await supabase
        .from("project_costs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      const totalCost = (costs || []).reduce((sum: number, c: { cost_usd: number }) => sum + Number(c.cost_usd), 0);

      return new Response(JSON.stringify({ costs: costs || [], totalCost }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("project-wizard-step error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

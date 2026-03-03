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

/** Truncate long strings to avoid prompt bloat and timeouts */
function truncate(s: string, max = 15000): string {
  if (!s || s.length <= max) return s;
  return s.substring(0, max) + "\n\n[... truncado a " + max + " caracteres]";
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

// ── Gemini Flash for markdown (no JSON mime type) ─────────────────────────

async function callGeminiFlashMarkdown(systemPrompt: string, userPrompt: string) {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 16384 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
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
      max_tokens: 8192,
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro:generateContent?key=${apiKey}`,
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

    // ── Action: generate_prd (Step 7) — 4 generative calls + 1 validation ──
    if (action === "generate_prd") {
      const sd = stepData;
      const finalStr = truncate(typeof sd.finalDocument === "string" ? sd.finalDocument : JSON.stringify(sd.finalDocument || {}, null, 2));
      const aiLevStr = truncate(typeof sd.aiLeverageJson === "string" ? sd.aiLeverageJson : JSON.stringify(sd.aiLeverageJson || {}, null, 2));
      const briefStr = truncate(typeof sd.briefingJson === "string" ? sd.briefingJson : JSON.stringify(sd.briefingJson || {}, null, 2));
      const targetPhase = sd.targetPhase || "Fase 0 + Fase 1 (MVP)";

      const prdSystemPrompt = `Eres un Product Manager técnico senior especializado en generar PRDs que se convierten directamente en aplicaciones funcionales via Lovable (plataforma de generación de código con IA).

## STACK OBLIGATORIO
Todo lo que generes DEBE usar exclusivamente este stack:
- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Supabase (Auth, PostgreSQL, Storage, Edge Functions con Deno, Realtime)
- Routing: react-router-dom
- Iconos: lucide-react
- Charts: recharts (si aplica)
- Estado: React hooks (useState, useEffect, useContext) — NO Redux, NO Zustand
- Pagos: Stripe via Supabase Edge Function (si aplica)

PROHIBIDO mencionar: Next.js, Express, NestJS, microservicios, JWT custom, AWS, Azure, Docker, Kubernetes, MongoDB, Firebase.
Si el documento de alcance o la auditoría IA mencionan estas tecnologías, TRADÚCELAS al stack Lovable equivalente.

## REGLAS DE ESCRITURA
1. FORMATO: Markdown plano con tablas Markdown, bloques de código y listas. NUNCA JSON anidado.
2. MEDIBLE: Cada requisito debe ser testeable. "El sistema debe ser rápido" → "Tiempo de carga <2s en 3G".
3. TRAZABLE: Cada módulo mapea a pantallas + entidades + endpoints concretos.
4. IA CON GUARDRAILS: Toda funcionalidad de IA DEBE tener: fallback si falla, logging en tabla auditoria_ia, coste por operación, y precisión esperada.
5. NÚMEROS HONESTOS: Si un ROI o métrica es hipotético (sin datos reales), márcalo como "[HIPÓTESIS — requiere validación con datos reales]".
6. LOVABLE-ESPECÍFICO: Los modelos de datos deben ser CREATE TABLE SQL ejecutable en Supabase. Las políticas de RLS deben estar incluidas. Los componentes IA deben ser Edge Functions con triggers.
7. POR FASE: Marca cada pantalla, tabla, componente y función con la fase en la que se introduce (Fase 0, 1, 2...).
8. IDIOMA: español (España).

## REGLAS DE NOMBRES PROPIOS
El nombre canónico del cliente es: "${sd.companyName || sd.briefingJson?.company_name || sd.briefingJson?.cliente?.empresa || sd.briefingJson?.cliente?.nombre_comercial || 'el cliente'}".
Usa SIEMPRE y EXCLUSIVAMENTE esta grafía exacta en todo el documento. Cualquier variación (typos, abreviaciones, traducciones) es un error grave.
Si aparece una variación en los documentos de entrada, corrígela silenciosamente a la forma canónica.`;

      let totalTokensInput = 0;
      let totalTokensOutput = 0;
      let mainModelUsed = "gemini-3.1-pro";
      let prdFallbackUsed = false;

      // Helper: call Gemini Pro with fallback to Claude Sonnet
      const callPrdModel = async (system: string, user: string): Promise<{ text: string; tokensInput: number; tokensOutput: number }> => {
        try {
          return await callGeminiPro(system, user);
        } catch (geminiError) {
          console.warn("[PRD] Gemini Pro failed, falling back to Claude Sonnet:", geminiError instanceof Error ? geminiError.message : geminiError);
          prdFallbackUsed = true;
          mainModelUsed = "claude-sonnet-4";
          return await callClaudeSonnet(system, user);
        }
      };

      // ── CALL 1: Sections 1-5 ──
      const contextBlock = `DOCUMENTO FINAL APROBADO:\n${finalStr}\n\nAI LEVERAGE (oportunidades IA):\n${aiLevStr}\n\nBRIEFING ORIGINAL:\n${briefStr}\n\nFASE OBJETIVO: ${targetPhase}`;

      const userPrompt1 = `${contextBlock}\n\nGENERA LAS SECCIONES 1 A 5 DEL PRD EN MARKDOWN:\n\n# 1. RESUMEN EJECUTIVO\nUn párrafo denso: empresa, problema cuantificado, solución, stack (React+Vite+Supabase), resultado esperado.\nIncluir: "Este PRD es Lovable-ready: cada sección se traduce directamente en código ejecutable."\n\n# 2. OBJETIVOS Y MÉTRICAS\n| ID | Objetivo | Prioridad | Métrica de éxito | Baseline | Target 6m | Fase |\nIncluir objetivos P0, P1 y P2 con métricas cuantificadas. Marcar hipótesis con [HIPÓTESIS].\n\n# 3. ALCANCE V1 CERRADO\n## 3.1 Incluido\n| Módulo | Funcionalidad | Prioridad | Fase | Pantalla(s) | Entidad(es) |\n## 3.2 Excluido\n| Funcionalidad | Motivo exclusión | Fase futura |\n## 3.3 Supuestos\nLista numerada de supuestos con impacto si fallan.\n\n# 4. PERSONAS Y ROLES\nPara cada tipo de usuario (mínimo 3):\n### Persona: [Nombre ficticio], [Rol]\n- Perfil, Dispositivos, Frecuencia uso, Nivel técnico, Dolor principal, Rol en el sistema, Pantallas principales\n## 4.1 Matriz de permisos\n| Recurso/Acción | [Rol 1] | [Rol 2] | [Rol 3] |\n\n# 5. FLUJOS PRINCIPALES\nPara cada flujo core (mínimo 3):\n### Flujo: [Nombre]\n| Paso | Actor | Acción en UI | Query/Mutation Supabase | Estado resultante |\nEdge cases con respuesta UI + manejo técnico.\n\nIMPORTANTE: Genera SOLO secciones 1-5. Sé exhaustivo. Termina con: ---END_PART_1---`;

      console.log("[PRD] Starting Part 1/4 (Sections 1-5)...");
      const result1 = await callPrdModel(prdSystemPrompt, userPrompt1);
      totalTokensInput += result1.tokensInput;
      totalTokensOutput += result1.tokensOutput;
      console.log(`[PRD] Part 1 done: ${result1.tokensOutput} tokens`);

      // ── CALL 2: Sections 6-10 ──
      const userPrompt2 = `CONTEXTO:\nDOCUMENTO FINAL: ${finalStr}\nAI LEVERAGE: ${aiLevStr}\nBRIEFING: ${briefStr}\n\nPARTE 1 YA GENERADA (para continuidad):\n${result1.text}\n\nGENERA LAS SECCIONES 6 A 10 DEL PRD EN MARKDOWN:\n\n# 6. MÓDULOS DEL PRODUCTO\nPara CADA módulo:\n## 6.X [Nombre del Módulo] — Fase [N] — [P0/P1/P2]\n- Pantallas: lista con ruta (ej: /dashboard/farmacias → FarmaciasList)\n- Entidades: tablas de BD involucradas\n- Edge Functions: funciones IA (si aplica)\n- Dependencias: qué módulos deben existir antes\n\n# 7. REQUISITOS FUNCIONALES\nPara cada módulo, user stories:\n### RF-001: [Título]\n- Como [rol] quiero [acción] para [beneficio]\n- Criterios de aceptación: DADO/CUANDO/ENTONCES con métricas\n- Prioridad y Fase\n\n# 8. REQUISITOS NO FUNCIONALES\n| ID | Categoría | Requisito | Métrica | Herramienta |\nIncluir: Rendimiento, Seguridad, RGPD, Disponibilidad, Accesibilidad.\n\n# 9. DATOS Y MODELO\n## 9.1 Schema SQL (ejecutable en Supabase)\nCREATE TABLE completo para CADA tabla con tipos, constraints, defaults.\nIMPORTANTE: Supabase usa auth.users para autenticación. NO crear tabla "usuarios" con email/password. La tabla perfiles REFERENCIA auth.users(id).\n## 9.2 RLS Policies completas\nPara CADA tabla, policies de seguridad.\n## 9.3 Storage Buckets\n| Bucket | Visibilidad | Max size | Tipos | Acceso |\n## 9.4 Diagrama Mermaid de relaciones\n\n# 10. INTEGRACIONES\n| Sistema | Tipo | Endpoint | Auth | Rate limit | Fallback | Edge Function | Secrets |\n\nIMPORTANTE: Genera SOLO secciones 6-10. Termina con: ---END_PART_2---`;

      console.log("[PRD] Starting Part 2/4 (Sections 6-10)...");
      const result2 = await callPrdModel(prdSystemPrompt, userPrompt2);
      totalTokensInput += result2.tokensInput;
      totalTokensOutput += result2.tokensOutput;
      console.log(`[PRD] Part 2 done: ${result2.tokensOutput} tokens`);

      // ── CALL 3: Sections 11-15 ──
      const userPrompt3 = `CONTEXTO:\nDOCUMENTO FINAL: ${finalStr}\nAI LEVERAGE: ${aiLevStr}\nBRIEFING: ${briefStr}\n\nPARTES 1 Y 2 YA GENERADAS:\n${result1.text}\n---\n${result2.text}\n\nGENERA LAS SECCIONES 11 A 15 DEL PRD EN MARKDOWN:\n\n# 11. DISEÑO DE IA\nPara CADA componente IA MVP/Fase1-2:\n## AI-XXX: [Nombre]\n- Edge Function: nombre\n- Trigger: qué lo dispara\n- Modelo/Proveedor: nombre exacto\n- Input/Output ejemplo: JSON\n- Prompt base (resumido)\n- Fallback: qué pasa si falla\n- Guardrails: límites (max tokens, timeout, validación output)\n- Logging: INSERT INTO auditoria_ia\n- Métricas de calidad\n- Coste/operación\n- Secrets en Supabase Vault\n\n# 12. TELEMETRÍA Y ANALÍTICA\n## 12.1 Eventos a trackear\n| Evento | Trigger | Datos | Tabla destino |\n## 12.2 KPIs dashboard admin\n| KPI | Query SQL | Frecuencia | Alerta si... |\n## 12.3 Alertas automáticas\n\n# 13. RIESGOS Y MITIGACIONES\n| ID | Riesgo | Probabilidad | Impacto | Mitigación técnica | Responsable | Indicador activación |\n\n# 14. PLAN DE FASES\nPara CADA fase:\n## Fase X: [Nombre] (X semanas)\n- Pantallas nuevas (con rutas)\n- Tablas nuevas\n- Edge Functions nuevas\n- Componentes nuevos\n- Criterio de éxito (medible)\n- Coste estimado (rango)\n\n# 15. ANEXOS\n## 15.1 Glosario de términos del dominio\n## 15.2 Checklist pre-desarrollo\n\nIMPORTANTE: Genera SOLO secciones 11-15. Termina con: ---END_PART_3---`;

      console.log("[PRD] Starting Part 3/4 (Sections 11-15)...");
      const result3 = await callPrdModel(prdSystemPrompt, userPrompt3);
      totalTokensInput += result3.tokensInput;
      totalTokensOutput += result3.tokensOutput;
      console.log(`[PRD] Part 3 done: ${result3.tokensOutput} tokens`);

      // ── CALL 4: Blueprint + Specs D1/D2 ──
      const userPrompt4 = `PARTES 1, 2 Y 3 DEL PRD YA GENERADAS:\n\nPARTE 1:\n${result1.text}\n\nPARTE 2:\n${result2.text}\n\nPARTE 3:\n${result3.text}\n\nFASE OBJETIVO PARA EL BLUEPRINT: ${targetPhase}\n\nGenera DOS bloques separados:\n\n---\n\n# LOVABLE BUILD BLUEPRINT\n\n> Este bloque está diseñado para copiarse y pegarse DIRECTAMENTE en Lovable.dev.\n> Contiene SOLO lo necesario para construir la fase indicada.\n> NO incluir funcionalidades de fases futuras.\n\n## Contexto\n[2-3 líneas: qué es la app, para quién, qué fase se construye]\n\n## Stack\nReact + Vite + TypeScript + Tailwind CSS + shadcn/ui + Supabase\nDeps npm: react-router-dom, @supabase/supabase-js, lucide-react, recharts\n\n## Pantallas y Rutas\n| Ruta | Componente | Acceso | Descripción |\n(SOLO las pantallas de la fase objetivo)\n\n## Wireframes Textuales\nPara CADA pantalla, describir:\n- Layout (sidebar? header? grid?)\n- Componentes visibles (cards, tablas, formularios, botones)\n- Estados (loading, empty, error, success)\n- Query Supabase que alimenta los datos\n\n## Componentes Reutilizables\n| Componente | Descripción | Usado en |\n\n## Base de Datos\n\`\`\`sql\n-- SOLO las tablas necesarias para esta fase\n-- Incluir RLS policies\n-- Incluir Storage buckets\n\`\`\`\n\n## Edge Functions\nPara cada una: Nombre, trigger, proceso, fallback, secrets\n\n## Design System\n- Colores: primary, secondary, accent, danger, background, surface\n- Tipografía: heading + body\n- Bordes, sombras, iconos\n- Tono visual\n\n## Auth Flow\nSupabase Auth con email+password. Redirect post-login según rol.\n\n## QA Checklist\n- [ ] Todas las rutas cargan sin error\n- [ ] Auth funciona (registro + login + redirect por rol)\n- [ ] RLS impide acceso no autorizado\n- [ ] Estados vacíos muestran mensaje apropiado\n- [ ] Edge Functions responden correctamente\n- [ ] Responsive en mobile\n\n---\n\n# SPECS PARA FASES POSTERIORES DEL PIPELINE (NO pegar en Lovable)\n\n## D1 — Spec RAG (Fase 8)\n- Fuentes de conocimiento, estrategia de chunking, quality gates, categorías, endpoints de consulta\n\n## D2 — Spec Detector de Patrones (Fase 9)\n- Señales a analizar, output esperado, métricas de calidad\n\nTermina con: ---END_PART_4---`;

      console.log("[PRD] Starting Part 4/4 (Blueprint + Specs)...");
      const result4 = await callPrdModel(prdSystemPrompt, userPrompt4);
      totalTokensInput += result4.tokensInput;
      totalTokensOutput += result4.tokensOutput;
      console.log(`[PRD] Part 4 done: ${result4.tokensOutput} tokens`);

      // ── CALL 5: Validation (Claude Sonnet as auditor) ──
      const validationSystemPrompt = `Eres un auditor técnico de PRDs. Recibes las 4 partes de un PRD y verificas su consistencia interna. NO reescribes nada — solo señalas problemas.\n\nREGLAS:\n- Verifica que los nombres de módulos son IDÉNTICOS entre todas las partes.\n- Verifica que los nombres de tablas SQL coinciden con las entidades en flujos y módulos.\n- Verifica que cada pantalla del Blueprint tiene wireframe textual.\n- Verifica que cada Edge Function del Blueprint está documentada en IA (sección 11).\n- Verifica que las fases son consistentes (sin saltos ni contradicciones).\n- Verifica que los RLS policies cubren todos los flujos de acceso.\n- Verifica que el stack es SOLO React+Vite+Supabase (sin Next.js, Express, AWS).\n- Verifica que los nombres propios están correctamente escritos.\n- Responde SOLO con JSON válido.`;

      const truncateForValidation = (s: string, max = 8000) => s.length > max ? s.substring(0, max) + "\n[...truncado para validación]" : s;

      const validationPrompt = `PRD PARTE 1 (resumen):\n${truncateForValidation(result1.text)}\n\nPRD PARTE 2 (resumen):\n${truncateForValidation(result2.text)}\n\nPRD PARTE 3 (resumen):\n${truncateForValidation(result3.text)}\n\nPRD PARTE 4 (Blueprint):\n${truncateForValidation(result4.text)}\n\nAnaliza las 4 partes y devuelve:\n{\n  "consistencia_global": 0-100,\n  "issues": [\n    {\n      "id": "PRD-V-001",\n      "severidad": "CRÍTICO/IMPORTANTE/MENOR",\n      "tipo": "NOMBRE_INCONSISTENTE/TABLA_FALTANTE/PANTALLA_SIN_WIREFRAME/RLS_INCOMPLETO/STACK_INCORRECTO/FASE_INCONSISTENTE/TYPO_NOMBRE_PROPIO",\n      "descripción": "descripción concreta",\n      "ubicación": "parte(s) y sección(es)",\n      "corrección_sugerida": "qué debería decir"\n    }\n  ],\n  "resumen": "X issues: Y críticos, Z importantes. Veredicto.",\n  "nombres_verificados": {\n    "empresa_cliente": "nombre correcto según briefing",\n    "stakeholders": ["nombre — OK/INCORRECTO"],\n    "producto": "nombre correcto"\n  }\n}`;

      console.log("[PRD] Starting validation call (Claude Sonnet as auditor)...");
      let validationResult: { text: string; tokensInput: number; tokensOutput: number } | null = null;
      let validationData: any = null;
      try {
        validationResult = await callClaudeSonnet(validationSystemPrompt, validationPrompt);
        totalTokensInput += validationResult.tokensInput;
        totalTokensOutput += validationResult.tokensOutput;
        console.log(`[PRD] Validation done: ${validationResult.tokensOutput} tokens`);

        try {
          let cleaned = validationResult.text.trim();
          if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
          if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
          if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
          validationData = JSON.parse(cleaned.trim());
        } catch {
          console.warn("[PRD] Validation JSON parse failed, continuing without validation data");
          validationData = { consistencia_global: -1, issues: [], resumen: "Validation parse failed" };
        }
      } catch (validationError) {
        console.warn("[PRD] Validation call failed, continuing without validation:", validationError instanceof Error ? validationError.message : validationError);
        validationData = { consistencia_global: -1, issues: [], resumen: "Validation call failed" };
      }

      // ── CONCATENATE & CLEAN ──
      const fullPrd = [result1.text, result2.text, result3.text, result4.text]
        .join("\n\n")
        .replace(/---END_PART_[1-4]---/g, "")
        .trim();

      const blueprintMatch = fullPrd.match(/# LOVABLE BUILD BLUEPRINT[\s\S]*?(?=# SPECS PARA FASES|$)/);
      const blueprint = blueprintMatch ? blueprintMatch[0].trim() : "";

      const specsMatch = fullPrd.match(/# SPECS PARA FASES[\s\S]*$/);
      const specs = specsMatch ? specsMatch[0].trim() : "";

      // ── COST CALCULATION ──
      const generativeTokensInput = totalTokensInput - (validationResult?.tokensInput || 0);
      const generativeTokensOutput = totalTokensOutput - (validationResult?.tokensOutput || 0);

      const generativeRates = prdFallbackUsed
        ? { input: 3.00, output: 15.00 }
        : { input: 1.25, output: 5.00 };

      const generativeCost = (generativeTokensInput / 1_000_000) * generativeRates.input +
                             (generativeTokensOutput / 1_000_000) * generativeRates.output;

      const validationCost = validationResult
        ? (validationResult.tokensInput / 1_000_000) * 3.00 + (validationResult.tokensOutput / 1_000_000) * 15.00
        : 0;

      const costUsd = generativeCost + validationCost;

      await recordCost(supabase, {
        projectId, stepNumber: 7, service: mainModelUsed, operation: "generate_prd",
        tokensInput: totalTokensInput, tokensOutput: totalTokensOutput,
        costUsd, userId: user.id,
        metadata: {
          parts: 4, validation: true,
          tokens_part1: result1.tokensOutput, tokens_part2: result2.tokensOutput,
          tokens_part3: result3.tokensOutput, tokens_part4: result4.tokensOutput,
          tokens_validation: validationResult?.tokensOutput || 0,
          consistencia_global: validationData?.consistencia_global || -1,
          validation_issues_count: validationData?.issues?.length || 0,
          fallback_used: prdFallbackUsed, generative_model: mainModelUsed,
          target_phase: targetPhase,
        },
      });

      // ── SAVE ──
      const { data: existingStep } = await supabase
        .from("project_wizard_steps")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("step_number", 7)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const newVersion = existingStep ? existingStep.version + 1 : 1;

      await supabase.from("project_wizard_steps").upsert({
        id: existingStep?.id || undefined,
        project_id: projectId,
        step_number: 7,
        step_name: "PRD Técnico",
        status: "review",
        input_data: { action: "generate_prd", targetPhase },
        output_data: {
          document: fullPrd,
          blueprint,
          specs,
          validation: validationData,
        },
        model_used: mainModelUsed,
        version: newVersion,
        user_id: user.id,
      });

      await supabase.from("project_documents").insert({
        project_id: projectId,
        step_number: 7,
        version: newVersion,
        content: fullPrd,
        format: "markdown",
        user_id: user.id,
      });

      if (blueprint) {
        await supabase.from("project_documents").insert({
          project_id: projectId,
          step_number: 7,
          version: newVersion,
          content: blueprint,
          format: "markdown",
          user_id: user.id,
        });
      }

      await supabase.from("business_projects").update({ current_step: 7 }).eq("id", projectId);

      return new Response(JSON.stringify({
        output: { document: fullPrd, blueprint, specs, validation: validationData },
        cost: costUsd,
        version: newVersion,
        modelUsed: mainModelUsed,
        fallbackUsed: prdFallbackUsed,
        parts: 4,
        validation: {
          consistencia: validationData?.consistencia_global || -1,
          issues: validationData?.issues?.length || 0,
          resumen: validationData?.resumen || "N/A",
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Generic step handler (Steps 4-6, 8-9) ───────────────────────────

    const STEP_ACTION_MAP: Record<string, { stepNumber: number; stepName: string; useJson: boolean; model: "flash" | "claude" }> = {
      "run_audit":         { stepNumber: 4, stepName: "Auditoría Cruzada",    useJson: true,  model: "claude" },
      "generate_final_doc":{ stepNumber: 5, stepName: "Documento Final",      useJson: false, model: "claude" },
      "run_ai_leverage":   { stepNumber: 6, stepName: "Auditoría IA",          useJson: true,  model: "claude" },
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
      const briefStr = truncate(typeof sd.briefingJson === "string" ? sd.briefingJson : JSON.stringify(sd.briefingJson || {}, null, 2));
      const scopeStr = truncate(typeof sd.scopeDocument === "string" ? sd.scopeDocument : JSON.stringify(sd.scopeDocument || {}, null, 2));
      const auditStr = truncate(typeof sd.auditJson === "string" ? sd.auditJson : JSON.stringify(sd.auditJson || {}, null, 2));
      const finalStr = truncate(typeof sd.finalDocument === "string" ? sd.finalDocument : JSON.stringify(sd.finalDocument || {}, null, 2));
      const aiLevStr = truncate(typeof sd.aiLeverageJson === "string" ? sd.aiLeverageJson : JSON.stringify(sd.aiLeverageJson || {}, null, 2));
      const prdStr = truncate(typeof sd.prdDocument === "string" ? sd.prdDocument : JSON.stringify(sd.prdDocument || {}, null, 2));

      if (action === "run_audit") {
        systemPrompt = `Eres un auditor de calidad de proyectos tecnológicos con 15 años de experiencia en consultoras Big Four. Tu trabajo es comparar un documento de alcance generado contra el material fuente original y detectar TODAS las discrepancias, omisiones o inconsistencias.

REGLAS:
- Sé exhaustivo y metódico. Revisa sección por sección del documento contra el material original.
- Asigna códigos secuenciales a cada hallazgo: [H-01], [H-02], etc.
- Clasifica por severidad con indicador visual:
  - 🔴 CRÍTICO: Bloquea el proyecto o la presentación al cliente. Requiere acción inmediata.
  - 🟠 IMPORTANTE: Afecta calidad o completitud. Debe corregirse antes de entregar.
  - 🟢 MENOR: Mejora deseable. Puede incorporarse sin urgencia.
- Distingue entre tipos: OMISIÓN (dato del original que falta), INCONSISTENCIA (dato que contradice el original), RIESGO_NO_CUBIERTO (situación sin mitigación), MEJORA (sugerencia que no es error).
- Para CADA hallazgo incluye obligatoriamente:
  1. Sección afectada del documento de alcance
  2. Problema concreto (no vago)
  3. Dato original textual: cita EXACTA del material fuente (con minuto si es transcripción o referencia si es documento)
  4. Acción requerida: qué hacer exactamente para corregirlo
  5. Consecuencia de no corregir: qué pasa si se ignora este hallazgo
- No generes falsos positivos. Si algo se simplificó correctamente, no lo marques como omisión.
- La tabla de puntuación por sección debe incluir notas breves que justifiquen la puntuación (como "Falta control horario, multi-sede, stack").
- La recomendación final debe ser UNA de: APROBAR / APROBAR CON CORRECCIONES / RECHAZAR Y REGENERAR.
- COMPARA SIEMPRE el orden de implementación del documento con lo acordado en la reunión original. Si el cliente o proveedor propuso demostrar X primero, eso debe reflejarse en Fase 1 del cronograma. Si no coincide, generar hallazgo de tipo INCONSISTENCIA.
- VERIFICA que todos los temas discutidos en la reunión tienen módulo asignado. Si se habló de control horario, pausas, horas extra u otra funcionalidad, debe existir un módulo para ello. Si falta, generar hallazgo de tipo OMISIÓN.
- NO permitas que el documento de alcance baje presupuestos a rangos irrealistas solo para alinear con expectativas del cliente. Si el presupuesto propuesto es insuficiente para el alcance definido, señálalo como hallazgo CRÍTICO de tipo RIESGO_NO_CUBIERTO.
- REGLA ESPECÍFICA MVP: Si en el material fuente el proveedor propuso una funcionalidad como PRIMERA DEMOSTRACIÓN DE VALOR (ej: 'validar reconocimiento de fotos', 'demo de OCR', 'probar la IA con datos reales'), esa funcionalidad DEBE estar en la Fase 1 del documento de alcance. Si el documento dice 'sin OCR' o excluye esa funcionalidad de la Fase 1 pero el proveedor ofreció demostrarla primero, márcalo como hallazgo de tipo INCONSISTENCIA con severidad CRÍTICO. Este es un error grave porque contradice la estrategia comercial acordada.
- Responde SOLO con JSON válido.`;
        userPrompt = `MATERIAL FUENTE ORIGINAL:\n${sd.originalInput || ""}\n\nBRIEFING EXTRAÍDO (Fase 2):\n${briefStr}\n\nDOCUMENTO DE ALCANCE GENERADO (Fase 3):\n${scopeStr}\n\nRealiza una auditoría cruzada exhaustiva. Compara cada dato del material fuente contra lo que aparece en el documento de alcance. Genera el siguiente JSON:\n{\n  "puntuación_global": 0-100,\n  "resumen_auditoría": "2-3 frases con la evaluación general. Ejemplo: 'El documento captura correctamente la mayoría de funcionalidades con estructura profesional. Requiere X correcciones (Y CRÍTICAS, Z IMPORTANTES) antes de presentar al cliente.'",\n  "hallazgos": [\n    {\n      "codigo": "H-01",\n      "tipo": "OMISIÓN/INCONSISTENCIA/RIESGO_NO_CUBIERTO/MEJORA",\n      "severidad": "CRÍTICO/IMPORTANTE/MENOR",\n      "indicador_visual": "🔴/🟠/🟢",\n      "sección_afectada": "sección exacta del documento de alcance",\n      "descripción": "descripción concreta del problema encontrado",\n      "dato_original_textual": "cita EXACTA del material fuente. Si es transcripción incluir minuto aproximado.",\n      "acción_requerida": "acción específica y concreta",\n      "consecuencia_si_no_se_corrige": "impacto concreto"\n    }\n  ],\n  "puntuación_por_sección": [\n    {\n      "sección": "nombre de la sección",\n      "puntuación": 0-100,\n      "notas": "justificación breve de la puntuación"\n    }\n  ],\n  "datos_original_no_usados": ["dato o detalle del material fuente que no aparece en ninguna parte del documento"],\n  "recomendación": "APROBAR / APROBAR CON CORRECCIONES / RECHAZAR Y REGENERAR",\n  "resumen_hallazgos": {\n    "total": número,\n    "críticos": número,\n    "importantes": número,\n    "menores": número\n  }\n}`;
      } else if (action === "generate_final_doc") {
        systemPrompt = `Eres un director de proyectos senior de una consultora premium. Se te proporciona un documento de alcance y el resultado de una auditoría de calidad con hallazgos codificados [H-XX]. Tu trabajo es generar la VERSIÓN FINAL del documento incorporando TODAS las correcciones.

REGLAS:
- Para CADA hallazgo [H-XX] de la auditoría, genera la corrección EXACTA:
  - Muestra QUÉ texto se añade o modifica y EN QUÉ sección.
  - Las correcciones deben ser texto listo para insertar, no descripciones vagas.
  - Si un hallazgo requiere una nueva sección completa (ej: Fase 0, módulo nuevo, riesgo nuevo), escríbela completa con el mismo estilo del documento.
- Si un hallazgo queda cubierto por la corrección de otro, márcalo: "[H-XX] → Ya cubierto con [H-YY]".
- Si un hallazgo requiere información que no tienes, marca como [PENDIENTE: descripción].
- El documento final debe leerse como si siempre hubiera sido correcto — NO añadas una sección visible de "correcciones aplicadas".
- Mantén la estructura, estilo y nivel de detalle del documento original.
- Al final, incluye un CHANGELOG INTERNO (separado por ---) con formato tabla.
- NUNCA bajes un presupuesto sin reducir alcance proporcionalmente. Si la auditoría indica que el presupuesto es excesivo para el cliente, la solución NO es poner un precio inferior por el mismo trabajo — es añadir una Fase 0/PoC de bajo coste como punto de entrada y mantener el presupuesto real para el proyecto completo.
- Verifica que TODAS las funcionalidades discutidas en el material original tienen módulo asignado en el documento final. Si alguna falta, añádela al módulo correspondiente o crea uno nuevo.
- REGLA OBLIGATORIA DE FASE 0/PoC: Si existe un gap >50% entre la expectativa del cliente (presupuesto mencionado o intuido) y el presupuesto real del proyecto, DEBES añadir obligatoriamente una "Fase 0 — Proof of Concept" como PRIMERA fase del plan de implementación, con estos 4 campos exactos:
  1. Duración: 2-3 semanas
  2. Coste: entre la expectativa del cliente y 5.000€ (ej: si el cliente espera 3.000€, la Fase 0 cuesta 3.000-5.000€)
  3. Entregables: demo funcional de la funcionalidad core (la que más valor demuestra) + maquetas/wireframes del resto
  4. Criterio de continuidad: si el cliente valida la demo y acepta el alcance completo, se procede con Fases 1-3 a presupuesto real
  NO es suficiente con un párrafo de justificación de precio. DEBE existir una Fase 0 como sección completa del cronograma con duración, coste, entregables y criterio.
- Idioma: español (España).`;
        userPrompt = `DOCUMENTO DE ALCANCE (versión anterior):\n${scopeStr}\n\nRESULTADO DE AUDITORÍA (con hallazgos codificados):\n${auditStr}\n\nBRIEFING ORIGINAL:\n${briefStr}\n\nINSTRUCCIONES:\n1. Lee cada hallazgo [H-XX] de la auditoría.\n2. Para cada uno, genera la corrección concreta como texto listo para insertar en la sección correspondiente.\n3. Si un hallazgo implica una sección nueva (ej: Fase 0, módulo nuevo), escríbela completa.\n4. Regenera el DOCUMENTO COMPLETO con todas las correcciones integradas de forma natural.\n5. Si varios hallazgos se resuelven con una misma corrección, indícalo en el changelog.\n6. IMPORTANTE: Si detectas un gap >50% entre expectativa del cliente y presupuesto real (revisa el briefing), incluye obligatoriamente una Fase 0/PoC al inicio del plan con: duración 2-3 semanas, coste entre expectativa cliente y 5.000€, entregables (demo core + maquetas), y criterio de continuidad.\n\nAl final del documento, después de una línea separadora (---), incluye:\n\n## CHANGELOG INTERNO (no incluir en entrega al cliente)\n| Hallazgo | Severidad | Acción tomada |\n| --- | --- | --- |\n| H-01: [descripción corta] | CRÍTICO/IMPORTANTE/MENOR | [qué se hizo exactamente] |`;
      } else if (action === "run_ai_leverage") {
        systemPrompt = `Eres un arquitecto de soluciones de IA con experiencia práctica implementando sistemas en producción (no teóricos). Tu trabajo es analizar un proyecto y proponer EXACTAMENTE dónde y cómo la IA aporta valor real, con estimaciones concretas basadas en volúmenes reales del proyecto.

REGLAS CRÍTICAS:
- Solo propón IA donde REALMENTE aporte valor sobre una solución no-IA. Si una regla de negocio simple resuelve el problema, marca el tipo como "REGLA_NEGOCIO_MEJOR" y explica por qué NO se necesita IA. La honestidad genera confianza.
- Para cada oportunidad, incluye TODOS estos campos en formato tabla:
  - Módulo afectado
  - Tipo: API_EXISTENTE / API_EXISTENTE + ajuste custom / MODELO_CUSTOM / REGLA_NEGOCIO_MEJOR
  - Modelo recomendado (nombre exacto: "Google Vision API + Claude Haiku 4.5", no genérico)
  - Cómo funciona: explicación técnica concreta del flujo
  - Coste API: cálculo explícito con volumen
  - Precisión esperada: % con justificación
  - Esfuerzo: horas concretas
  - ROI: cálculo explícito
  - Es MVP: ✅ Sí / ❌ No (con prioridad P0/P1/P2)
  - Dependencias: qué necesita estar listo antes
- Quick Wins: identifica las oportunidades de impacto alto y esfuerzo bajo que son demostrables en fases tempranas.
- Stack IA: justifica CADA componente.
- REGLA DE ESTIMACIÓN CONSERVADORA: Todos los cálculos de ROI y ahorro deben usar el ESCENARIO BAJO, no el alto. Si hay incertidumbre en volumen o ahorro, usa el 50% del valor optimista. Es mejor sorprender al cliente con resultados mejores que decepcionar con proyecciones infladas.
- REGLA DE FRAUDE/ANOMALÍAS: Para oportunidades de detección de fraude, anomalías o irregularidades, NO estimes valor monetario sin datos históricos reales. Usa "potencial de detección sin cuantificar — requiere datos históricos para estimar impacto".
- Responde SOLO con JSON válido.`;
        userPrompt = `DOCUMENTO DE ALCANCE FINAL:\n${finalStr}\n\nBRIEFING DEL PROYECTO:\n${briefStr}\n\nGenera un análisis exhaustivo de oportunidades de IA. Para cada oportunidad, calcula el ROI con los datos reales del proyecto. Estructura JSON:\n{\n  "resumen": "valoración general del potencial de IA en 2-3 frases, incluyendo número de oportunidades, coste total estimado y ROI global",\n  "oportunidades": [\n    {\n      "id": "AI-001",\n      "nombre": "nombre descriptivo",\n      "módulo_afectado": "módulo exacto del proyecto",\n      "descripción": "qué hace y por qué aporta valor en 1-2 frases",\n      "tipo": "API_EXISTENTE / API_EXISTENTE + ajuste custom / MODELO_CUSTOM / REGLA_NEGOCIO_MEJOR",\n      "modelo_recomendado": "nombre exacto del modelo/API",\n      "como_funciona": "explicación técnica del flujo paso a paso",\n      "coste_api_estimado": "€/mes con cálculo de volumen explícito",\n      "calculo_volumen": "desglose: unidades/día × días/mes = total/mes",\n      "precisión_esperada": "% con justificación",\n      "datos_necesarios": "qué datos hacen falta",\n      "esfuerzo_implementación": "nivel + horas",\n      "impacto_negocio": "qué resuelve cuantitativamente",\n      "roi_estimado": "cálculo explícito: ahorro anual vs coste IA anual",\n      "es_mvp": true,\n      "prioridad": "P0/P1/P2",\n      "dependencias": "qué necesita estar listo antes",\n      "fase_implementación": "en qué fase del proyecto se implementa"\n    }\n  ],\n  "quick_wins": ["AI-001", "AI-002 — justificación breve"],\n  "requiere_datos_previos": ["AI-005 — qué datos y cuánto tiempo"],\n  "stack_ia_recomendado": {\n    "ocr": "solución + justificación",\n    "nlp": "solución + justificación, o 'No aplica'",\n    "visión": "solución + justificación, o 'No aplica'",\n    "mapas": "solución + justificación, o 'No aplica'",\n    "analytics": "solución + justificación"\n  },\n  "coste_ia_total_mensual_estimado": "rango €/mes con nota",\n  "nota_implementación": "consideraciones prácticas en 2-3 frases"\n}`;
      } else if (action === "generate_rags") {
        systemPrompt = `Eres un ingeniero de RAG (Retrieval Augmented Generation) especializado en construir bases de conocimiento para asistentes de IA de proyectos. Tu trabajo es tomar toda la documentación de un proyecto y organizarla en chunks semánticos óptimos para retrieval.

REGLAS:
- Genera entre 45-60 chunks para proyectos medianos. Escala proporcionalmente.
- Cada chunk DEBE ser autocontenido: un desarrollador que lea SOLO ese chunk debe entender lo que describe sin necesidad de contexto adicional. No uses pronombres sin antecedente ni referencias a "lo anterior".
- Tamaño óptimo: 200-500 tokens por chunk.
- Incluye la distribución por categoría al inicio:
  - Funcionalidad: 18-22 chunks
  - Decisión: 10-15 chunks
  - Arquitectura: 6-8 chunks
  - Proceso: 5-6 chunks
  - Dato clave: 4-5 chunks
  - FAQ: 8-10 chunks
- Los chunks de FAQ deben explicar el "POR QUÉ" de las decisiones, no solo el "qué".
- Los chunks de decisión deben incluir: qué se decidió, por qué, y qué alternativa se descartó con su motivo.
- Responde SOLO con JSON válido.`;
        userPrompt = `PRD Técnico:\n${prdStr}\n\nDocumento de Alcance:\n${finalStr}\n\nBriefing:\n${briefStr}\n\nAI Leverage:\n${aiLevStr}\n\nGenera la estructura RAG completa. Cada chunk debe ser autocontenido. Formato JSON:\n{\n  "proyecto": "${sd.projectName || ""}",\n  "total_chunks": número,\n  "distribución_por_categoría": {\n    "funcionalidad": "18-22 chunks",\n    "decisión": "10-15 chunks",\n    "arquitectura": "6-8 chunks",\n    "proceso": "5-6 chunks",\n    "dato_clave": "4-5 chunks",\n    "faq": "8-10 chunks"\n  },\n  "categorías": ["arquitectura", "funcionalidad", "decisión", "integración", "faq", "proceso", "dato_clave"],\n  "chunks": [\n    {\n      "id": "CHK-001",\n      "categoría": "funcionalidad",\n      "módulo": "nombre del módulo",\n      "fase": "Fase X",\n      "prioridad": "P0/P1/P2",\n      "título": "título descriptivo corto",\n      "contenido": "texto autocontenido de 200-500 tokens",\n      "tags": ["tag1", "tag2"],\n      "preguntas_relacionadas": ["¿cómo funciona X?"],\n      "dependencias": ["CHK-003"],\n      "fuente": "PRD sección X / Briefing / Reunión"\n    }\n  ],\n  "faqs_generadas": [\n    {\n      "id": "CHK-FAQ-001",\n      "pregunta": "pregunta anticipada del equipo",\n      "respuesta": "respuesta DETALLADA que explica el 'por qué'",\n      "chunks_relacionados": ["CHK-001"]\n    }\n  ],\n  "embeddings_config": {\n    "modelo_recomendado": "text-embedding-3-small (OpenAI)",\n    "dimensiones": 1536,\n    "chunk_overlap": 50,\n    "separador_recomendado": "Splitting semántico por módulo/decisión"\n  }\n}`;
      } else if (action === "detect_patterns") {
        systemPrompt = `Eres un analista de negocio senior especializado en detectar patrones recurrentes en proyectos tecnológicos. Tu análisis tiene dos objetivos: (1) identificar componentes reutilizables que aceleren futuros proyectos similares, y (2) detectar oportunidades comerciales (upselling, cross-selling, servicios recurrentes) con pitches listos para usar.

REGLAS:
- Los patrones deben ser CONCRETOS y ACCIONABLES, no observaciones genéricas.
- Cada patrón técnico debe tener un "componente_extraíble" con NOMBRE DE PRODUCTO (ej: "DocCapture", "StepFlow", "FleetDash") — como si fuera un módulo que vendes.
- Las oportunidades comerciales deben incluir un pitch textual LISTO PARA USAR en una reunión (1-2 frases naturales, no corporativas).
- El timing de cada oportunidad debe ser concreto: "Cuando lleven 2-3 meses usando X" o "Al cerrar Fase 3", no "en el futuro".
- El score del cliente debe ser una tabla con dimensiones específicas + siguiente contacto con fecha concreta y motivo.
- Las señales de necesidades futuras deben tener timing concreto y acción preventiva.
- Los aprendizajes del proceso deben ser aplicables al pipeline interno de la agencia.
- REGLA DE ESTIMACIÓN CONSERVADORA: Los valores estimados en oportunidades comerciales deben usar el ESCENARIO BAJO. Si hay incertidumbre, usa el 50% del valor optimista. Los rangos de "Lifetime value estimado" deben ser conservadores.
- REGLA DE FRAUDE/ANOMALÍAS: Si algún patrón u oportunidad involucra detección de fraude o anomalías, NO estimes valor monetario sin datos reales. Usa "potencial de detección sin cuantificar" en su lugar.
- Responde SOLO con JSON válido.`;
        userPrompt = `Briefing:\n${briefStr}\n\nDocumento de Alcance:\n${finalStr}\n\nPRD Técnico:\n${prdStr}\n\nAI Leverage:\n${aiLevStr}\n\nCONTEXTO DE LA AGENCIA:\n- Nombre: Agustito\n- Servicios: Desarrollo tecnológico, marketing digital, consultoría IA\n\nGenera análisis de patrones con este formato JSON:\n{\n  "resumen": "valoración general en 2-3 frases",\n  "patrones_técnicos": [\n    {\n      "id": "PAT-001",\n      "patrón": "nombre descriptivo",\n      "descripción": "qué es el patrón en 1-2 frases",\n      "reutilizable": true,\n      "componente_extraíble": "nombre de producto + descripción",\n      "proyectos_aplicables": "tipos concretos de proyectos",\n      "ahorro_estimado": "horas concretas"\n    }\n  ],\n  "oportunidades_comerciales": [\n    {\n      "id": "OPP-001",\n      "oportunidad": "descripción concreta",\n      "tipo": "UPSELL / CROSS_SELL / SERVICIO_RECURRENTE / NUEVO_PROYECTO",\n      "timing": "cuándo proponerlo — concreto",\n      "valor_estimado": "€/mes o €/proyecto con rango",\n      "probabilidad": "alta/media/baja",\n      "pitch_sugerido": "frase NATURAL lista para usar en reunión"\n    }\n  ],\n  "señales_necesidades_futuras": [\n    {\n      "señal": "qué dijo o hizo el cliente",\n      "necesidad_inferida": "qué necesitará",\n      "cuándo": "estimación temporal concreta",\n      "acción": "qué hacer AHORA para posicionarse"\n    }\n  ],\n  "aprendizajes_proceso": [\n    {\n      "aprendizaje": "qué se aprendió",\n      "aplicable_a": "procesos internos / futuros proyectos / pipeline de ventas",\n      "acción_sugerida": "cambio concreto a implementar"\n    }\n  ],\n  "score_cliente": {\n    "dimensiones": [\n      {"dimensión": "Potencial recurrencia", "valoración": "alto/medio/bajo", "notas": "justificación"},\n      {"dimensión": "Potencial referidos", "valoración": "alto/medio/bajo", "notas": "justificación"},\n      {"dimensión": "Complejidad relación", "valoración": "alta/media/baja", "notas": "justificación"},\n      {"dimensión": "Lifetime value estimado", "valoración": "rango €", "notas": "desglose"}\n    ],\n    "siguiente_contacto_recomendado": {\n      "fecha": "fecha concreta o relativa",\n      "motivo": "qué presentar o discutir"\n    }\n  }\n}`;
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

      // Parse output with JSON repair + retry
      let outputData: any;
      if (useJson) {
        const parseJsonSafe = (raw: string): any => {
          let cleaned = raw.trim();
          if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
          if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
          if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
          cleaned = cleaned.trim();
          return JSON.parse(cleaned);
        };

        const repairJson = (raw: string): any => {
          let cleaned = raw.trim();
          if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
          if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
          if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
          cleaned = cleaned.trim();
          // Close open strings
          const quoteCount = (cleaned.match(/(?<!\\)"/g) || []).length;
          if (quoteCount % 2 !== 0) cleaned += '"';
          // Close open brackets/braces
          const openBrackets = (cleaned.match(/\[/g) || []).length - (cleaned.match(/\]/g) || []).length;
          const openBraces = (cleaned.match(/\{/g) || []).length - (cleaned.match(/\}/g) || []).length;
          for (let i = 0; i < openBrackets; i++) cleaned += ']';
          for (let i = 0; i < openBraces; i++) cleaned += '}';
          return JSON.parse(cleaned);
        };

        // Attempt 1: direct parse
        try {
          outputData = parseJsonSafe(result.text);
        } catch {
          // Attempt 2: repair truncated JSON
          console.warn(`Step ${stepNumber}: JSON parse failed, attempting repair...`);
          try {
            outputData = repairJson(result.text);
            console.log(`Step ${stepNumber}: JSON repair successful`);
          } catch {
            // Attempt 3: retry with lower temperature
            console.warn(`Step ${stepNumber}: JSON repair failed, retrying with lower temperature...`);
            try {
              let retryResult: { text: string; tokensInput: number; tokensOutput: number };
              if (model === "flash") {
                // Retry with flash but lower temp - call inline
                const apiKey = GEMINI_API_KEY;
                const retryResponse = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
                      generationConfig: { temperature: 0.1, maxOutputTokens: 16384, responseMimeType: "application/json" },
                    }),
                  }
                );
                const retryData = await retryResponse.json();
                retryResult = {
                  text: retryData.candidates?.[0]?.content?.parts?.[0]?.text || "",
                  tokensInput: retryData.usageMetadata?.promptTokenCount || 0,
                  tokensOutput: retryData.usageMetadata?.candidatesTokenCount || 0,
                };
              } else {
                // Retry with Claude at lower temp
                const retryResponse = await fetch("https://api.anthropic.com/v1/messages", {
                  method: "POST",
                  headers: {
                    "x-api-key": ANTHROPIC_API_KEY!,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 16384,
                    temperature: 0.1,
                    system: systemPrompt,
                    messages: [{ role: "user", content: userPrompt }],
                  }),
                });
                const retryData = await retryResponse.json();
                retryResult = {
                  text: retryData.content?.find((b: { type: string }) => b.type === "text")?.text || "",
                  tokensInput: retryData.usage?.input_tokens || 0,
                  tokensOutput: retryData.usage?.output_tokens || 0,
                };
              }
              // Add retry tokens to total
              result.tokensInput += retryResult.tokensInput;
              result.tokensOutput += retryResult.tokensOutput;
              outputData = parseJsonSafe(retryResult.text);
              console.log(`Step ${stepNumber}: Retry successful`);
            } catch (retryErr) {
              // All attempts failed
              console.error(`Step ${stepNumber}: All JSON parse attempts failed`, retryErr);
              outputData = { raw_text: result.text, parse_error: true };
            }
          }
        }
      } else {
        outputData = { document: result.text };
      }

      // Calculate cost
      const costRates: Record<string, { input: number; output: number }> = {
        "gemini-2.5-flash": { input: 0.075, output: 0.30 },
        "claude-sonnet-4": { input: 3.00, output: 15.00 },
        "gemini-2.5-pro": { input: 1.25, output: 5.00 },
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

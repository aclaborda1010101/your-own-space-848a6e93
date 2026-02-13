import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ═══════════════════════════════════════
// AI PROVIDER CALLERS
// ═══════════════════════════════════════

interface AIResult { content: string; tokens_in: number; tokens_out: number }

async function callAnthropic(systemPrompt: string, userMessage: string, model: string, maxTokens: number, temperature: number): Promise<AIResult> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system: systemPrompt, messages: [{ role: "user", content: userMessage }] }),
  });
  if (!res.ok) { const e = await res.text(); console.error("Anthropic error:", res.status, e); throw new Error(`Anthropic ${res.status}: ${e}`); }
  const d = await res.json();
  return { content: d.content?.find((b: any) => b.type === "text")?.text || "", tokens_in: d.usage?.input_tokens || 0, tokens_out: d.usage?.output_tokens || 0 };
}

async function callOpenAI(systemPrompt: string, userMessage: string, model: string, maxTokens: number, temperature: number): Promise<AIResult> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY not configured");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }] }),
  });
  if (!res.ok) { const e = await res.text(); console.error("OpenAI error:", res.status, e); throw new Error(`OpenAI ${res.status}: ${e}`); }
  const d = await res.json();
  return { content: d.choices?.[0]?.message?.content || "", tokens_in: d.usage?.prompt_tokens || 0, tokens_out: d.usage?.completion_tokens || 0 };
}

async function callGoogle(systemPrompt: string, userMessage: string, model: string, maxTokens: number, temperature: number): Promise<AIResult> {
  const key = Deno.env.get("GOOGLE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GOOGLE_AI_API_KEY not configured");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) { const e = await res.text(); console.error("Google error:", res.status, e); throw new Error(`Google ${res.status}: ${e}`); }
  const d = await res.json();
  const u = d.usageMetadata || {};
  return { content: d.candidates?.[0]?.content?.parts?.[0]?.text || "", tokens_in: u.promptTokenCount || 0, tokens_out: u.candidatesTokenCount || 0 };
}

async function callDeepSeek(systemPrompt: string, userMessage: string, model: string, maxTokens: number, temperature: number): Promise<AIResult> {
  const key = Deno.env.get("DEEPSEEK_API_KEY");
  if (!key) throw new Error("DEEPSEEK_API_KEY not configured");
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }] }),
  });
  if (!res.ok) { const e = await res.text(); console.error("DeepSeek error:", res.status, e); throw new Error(`DeepSeek ${res.status}: ${e}`); }
  const d = await res.json();
  return { content: d.choices?.[0]?.message?.content || "", tokens_in: d.usage?.prompt_tokens || 0, tokens_out: d.usage?.completion_tokens || 0 };
}

function callModel(provider: string, systemPrompt: string, userMessage: string, model: string, maxTokens: number, temperature: number): Promise<AIResult> {
  switch (provider) {
    case "anthropic": return callAnthropic(systemPrompt, userMessage, model, maxTokens, temperature);
    case "openai": return callOpenAI(systemPrompt, userMessage, model, maxTokens, temperature);
    case "google": return callGoogle(systemPrompt, userMessage, model, maxTokens, temperature);
    case "deepseek": return callDeepSeek(systemPrompt, userMessage, model, maxTokens, temperature);
    default: throw new Error(`Provider desconocido: ${provider}`);
  }
}

// ═══════════════════════════════════════
// SYSTEM PROMPTS (Español, detallados)
// ═══════════════════════════════════════

const SYSTEM_PROMPTS: Record<string, string> = {

classify: `Eres un clasificador experto de proyectos tecnológicos y de negocio. Tu trabajo es analizar una idea y clasificarla con precisión.

Analiza la idea proporcionada y devuelve EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin backticks, sin explicación). El JSON debe tener esta estructura exacta:

{
  "project_type": "saas" | "marketplace" | "pure_strategy" | "heavy_code" | "data_product" | "other",
  "technical_depth": "low" | "medium" | "high",
  "needs_code": true | false,
  "complexity_score": 1-10,
  "recommended_pipeline": "quick" | "standard" | "deep",
  "hallucination_risk": "low" | "medium" | "high",
  "market_uncertainty": "low" | "medium" | "high",
  "confidence": 0.0-1.0
}

Criterios de clasificación:
- project_type: Tipo predominante del proyecto
- technical_depth: Cuánta profundidad técnica requiere el análisis
- needs_code: Si el proyecto requiere desarrollo de software significativo
- complexity_score: 1=trivial, 5=moderado, 10=extremadamente complejo
- recommended_pipeline: quick=idea simple, standard=proyecto normal, deep=proyecto técnico complejo
- hallucination_risk: Riesgo de que el análisis contenga datos inventados
- market_uncertainty: Nivel de incertidumbre sobre el mercado objetivo
- confidence: Tu confianza en esta clasificación (0.0 a 1.0)

IMPORTANTE: Devuelve SOLO el JSON. Nada más.`,

step_1: `Eres un arquitecto de productos y estratega de startups de clase mundial. Tu misión es generar un DOCUMENTO TÉCNICO COMPLETO y exhaustivo a partir de una idea.

Genera un documento con EXACTAMENTE estas 12 secciones. Cada sección debe ser SUSTANCIAL (mínimo 300-500 palabras por sección). No relleno, no generalidades - contenido específico y accionable.

## 1. Resumen Ejecutivo
- Problema específico que resuelve (con datos si es posible)
- Solución propuesta (en 2-3 párrafos detallados)
- Propuesta de valor única (por qué ESTA solución y no otra)
- Modelo de negocio en una frase
- Métricas clave esperadas en 12 meses

## 2. Problema y Oportunidad de Mercado
- Descripción detallada del problema (quién lo sufre, con qué frecuencia, cuánto les cuesta)
- TAM (Total Addressable Market) con fuentes y cálculo
- SAM (Serviceable Addressable Market) con justificación
- SOM (Serviceable Obtainable Market) con estrategia de captura
- Tendencias de mercado que favorecen esta solución
- Timing: por qué AHORA es el momento

## 3. Value Proposition Canvas
- Customer Jobs (funcionales, sociales, emocionales)
- Pains (frustraciones, riesgos, obstáculos)
- Gains (beneficios esperados, deseados, inesperados)
- Pain Relievers (cómo la solución alivia cada pain)
- Gain Creators (cómo la solución crea cada gain)
- Fit: mapeo explícito pain→reliever y gain→creator

## 4. Análisis Competitivo (Porter + Mapa)
- 5 Fuerzas de Porter aplicadas al sector
- Competidores directos (mínimo 3, con pricing, features, debilidades)
- Competidores indirectos y sustitutos
- Mapa de posicionamiento (ejes relevantes)
- Ventaja competitiva sostenible propuesta
- Barreras de entrada del mercado

## 5. Personas de Usuario (3 detalladas)
- Para cada persona: nombre, edad, rol, contexto, goals, frustrations, tech savviness
- Escenario de uso típico paso a paso
- Willingness to pay y budget
- Canales donde encontrarla

## 6. Funcionalidades MVP (MoSCoW + RICE)
- Must Have: features absolutamente esenciales (con RICE score)
- Should Have: importantes pero no bloqueantes
- Could Have: nice-to-have para diferenciación
- Won't Have (this release): explícitamente excluidas y por qué
- Tabla RICE: Reach, Impact, Confidence, Effort para cada Must Have
- User stories formato "Como [persona], quiero [acción], para [beneficio]"

## 7. Arquitectura Técnica
- Stack tecnológico recomendado (frontend, backend, DB, infra) con justificación
- Diagrama de arquitectura (en texto/ASCII)
- Patrones de diseño aplicables
- Estrategia de escalabilidad
- Consideraciones de seguridad
- Integraciones externas necesarias (APIs, servicios third-party)

## 8. Modelo de Datos
- Entidades principales con atributos
- Relaciones entre entidades (diagrama ER textual)
- SQL schemas para las tablas principales
- Índices recomendados
- Consideraciones de migración y versionado

## 9. API e Integraciones
- Endpoints principales (método, ruta, request/response)
- Autenticación y autorización
- Rate limiting y throttling
- Webhooks necesarios
- Integraciones con servicios externos (pagos, email, analytics, etc.)
- Documentación API formato ejemplo

## 10. Diseño UX/UI
- Flujos de usuario principales (wireframes textuales)
- Pantallas clave descritas en detalle
- Principios de diseño adoptados
- Accesibilidad (WCAG nivel mínimo)
- Mobile-first vs Desktop-first con justificación
- Onboarding del usuario nuevo

## 11. Riesgos y Mitigaciones
- Riesgos técnicos (mínimo 5) con probabilidad, impacto y mitigación
- Riesgos de mercado (mínimo 3)
- Riesgos regulatorios/legales
- Riesgos de equipo
- Plan de contingencia para los 3 riesgos más críticos

## 12. Roadmap y Métricas
- Fase 1 (0-3 meses): MVP con milestones semanales
- Fase 2 (3-6 meses): Product-Market Fit
- Fase 3 (6-12 meses): Escala
- KPIs por fase (específicos, medibles)
- North Star Metric
- Presupuesto estimado por fase

IMPORTANTE: Sé exhaustivo, específico y usa datos reales cuando sea posible. Este documento debe ser lo suficientemente detallado para que un equipo pueda empezar a construir.`,

step_2: `Eres un crítico DESPIADADO de startups y auditor técnico. Tu trabajo es DESTRUIR ideas débiles y FORTALECER las buenas. No tienes piedad con el BS.

Analiza el documento del arquitecto con ojo clínico. Tu output debe incluir:

### ANÁLISIS CRÍTICO POR SECCIÓN

Para CADA una de las 12 secciones del documento:
- **Confidence Score**: 0-100% (0=inventado, 100=datos verificables)
- **Problemas encontrados**: Lista con severidad [CRÍTICO] [ALTO] [MEDIO] [BAJO]
- **Supuestos no validados**: Marcados con [SUPUESTO]
- **Datos posiblemente inventados**: Marcados con [ALUCINACIÓN]

### CUESTIONAMIENTO DE CIFRAS
- TAM/SAM/SOM: ¿De dónde salen estos números? ¿Son verificables? ¿Qué fuentes se usaron?
- Proyecciones financieras: ¿Son realistas? ¿Qué asume sobre crecimiento?
- Timelines: ¿Es factible con el equipo propuesto?
- Costes: ¿Están subestimados? ¿Qué falta?

### DETECCIÓN DE HUMO TÉCNICO
- ¿Hay buzzwords sin sustancia? (AI/ML/blockchain mencionados sin necesidad real)
- ¿La arquitectura es over-engineered para un MVP?
- ¿Las tecnologías elegidas son las correctas o solo las de moda?
- ¿Los schemas de datos tienen sentido para los flujos descritos?

### MVP SIMPLIFICADO
- Propuesta de MVP BRUTAL: ¿Cuál es el MÍNIMO absoluto para validar la hipótesis?
- Features a ELIMINAR del MVP propuesto
- Lo que se puede hacer con no-code/low-code primero
- Experimento de validación antes de escribir código

### TABLA DE SCORES
| Sección | Score | Veredicto |
|---------|-------|-----------|
(tabla completa)

### 5 PREGUNTAS INCÓMODAS PARA EL FOUNDER
Preguntas que el founder DEBE poder responder antes de invertir un euro.

### CONTRADICCIONES DETECTADAS
Inconsistencias entre secciones del documento.

### VEREDICTO FINAL
- Score general: X/100
- Recomendación: ADELANTE / PIVOTAR / VOLVER A PENSAR / ABANDONAR
- Los 3 cambios más urgentes

Sé DIRECTO. Sé INCÓMODO. Si algo es humo, dilo. No uses lenguaje diplomático. Tu trabajo es salvar al founder de perder tiempo y dinero.`,

step_3: `Eres un estratega visionario especializado en Blue Ocean Strategy, innovación exponencial y pensamiento no convencional. Tu trabajo es ver lo que los demás no ven.

Analiza el proyecto y proporciona:

### 1. GRID ERIC (Blue Ocean Strategy)
- **Eliminar**: ¿Qué factores que la industria da por sentado se pueden eliminar?
- **Reducir**: ¿Qué se puede reducir muy por debajo del estándar?
- **Incrementar**: ¿Qué se puede incrementar muy por encima del estándar?
- **Crear**: ¿Qué se puede crear que la industria nunca ha ofrecido?

### 2. OPORTUNIDADES OCULTAS
- Oportunidades que el arquitecto no vio
- Mercados adyacentes que podrían capturarse
- Casos de uso no obvios
- Partnerships estratégicos no considerados
- Datos como activo: qué datos genera el producto y cómo monetizarlos

### 3. NETWORK EFFECTS Y MOAT
- ¿Tiene potencial de network effects? ¿De qué tipo? (directo, indirecto, de datos)
- ¿Cómo ingeniería de network effects desde día 1?
- Estrategia de lock-in ético
- Moat sostenible a 5 años
- Switching costs para el usuario

### 4. AI-FIRST REIMAGINACIÓN
- ¿Cómo sería este producto si se construyera 100% AI-native?
- ¿Qué procesos manuales se pueden automatizar con IA desde el día 1?
- ¿Hay oportunidad de IA generativa?
- ¿Puede la IA ser la ventaja competitiva principal?

### 5. GROWTH HACKS ESPECÍFICOS
- 5 growth hacks específicos para este tipo de producto (no genéricos)
- Viral loops posibles
- Estrategia de contenido/comunidad
- Referral mechanics
- PLG (Product-Led Growth) tactics

### 6. MONETIZACIÓN NO CONVENCIONAL
- Modelos de revenue alternativos al propuesto
- Freemium vs Premium: análisis específico
- Marketplace fees, white-labeling, API as a product
- Revenue streams que el proyecto podría tener en 3 años

### 7. FUTURO A 5 AÑOS
- Evolución del producto: de herramienta a plataforma a ecosistema
- Amenazas futuras (competidores potenciales, cambios regulatorios)
- Pivots posibles si la tesis principal falla
- Exit strategies potenciales

Piensa 10x, no 10%. Sé creativo pero FUNDAMENTADO - cada idea debe tener un "por qué funcionaría" concreto.`,

step_4: `Eres un ingeniero de infraestructura senior con 20+ años de experiencia en sistemas distribuidos, DevOps, seguridad y arquitectura de software. Tu análisis es técnicamente PRECISO con números REALES.

### 1. VIABILIDAD TÉCNICA
- ¿Es técnicamente factible con la tecnología actual? Score 1-10
- Retos técnicos principales y cómo resolverlos
- ¿Hay algún "unsolved problem" en la propuesta?
- Proof of concept: qué construir primero para validar viabilidad

### 2. COSTES DE INFRAESTRUCTURA REALES
(Usar precios ACTUALES de AWS/GCP/Azure, no estimaciones)
- Hosting/Compute: instancias específicas con pricing mensual
- Base de datos: tipo, tamaño, coste
- CDN/Storage: GB estimados, coste
- APIs third-party: costes por llamada/mes
- Monitoring/Logging: herramientas y coste
- CI/CD: pipeline estimado
- TOTAL MES 1 vs MES 6 vs MES 12 (con crecimiento)
- Coste por usuario activo

### 3. STACK ALTERNATIVO
- Stack propuesto vs Stack alternativo más económico
- Pros/cons de cada opción
- ¿Se puede empezar con un stack más simple y migrar después?
- Serverless vs Containers vs VMs: recomendación específica

### 4. DEUDA TÉCNICA
- Deuda técnica inevitable en el MVP y plan de pago
- Decisiones técnicas que parecen shortcuts pero son trampas
- Patrones de diseño que evitarán refactoring costoso
- Testing strategy desde día 1

### 5. SEGURIDAD Y COMPLIANCE
- Requisitos de seguridad mínimos para lanzar
- GDPR/LOPD: qué implementar y cuándo
- Autenticación y autorización: recomendación específica
- Vulnerabilidades comunes en este tipo de producto
- Plan de incident response básico

### 6. EQUIPO MÍNIMO
- Roles necesarios con seniority level
- Coste mensual por rol (mercado español/europeo)
- ¿Qué se puede externalizar vs qué debe ser in-house?
- Organización del equipo: squads, rotaciones, on-call
- Timeline de contratación

### 7. TIME-TO-MARKET
- Timeline realista para MVP funcional (no optimista, REALISTA)
- Milestones técnicos semanales
- Dependencias críticas que pueden bloquear
- Riesgos de timeline y buffers recomendados

### 8. CÓDIGO Y ARQUITECTURA
- Estructura de carpetas recomendada
- Snippets de código para componentes críticos
- Configuración de CI/CD
- Testing: unit, integration, e2e - qué cubrir primero
- Monitoring y alertas desde día 1

Proporciona NÚMEROS CONCRETOS, no rangos. Si dices "entre 50-200€/mes", investiga y da el número real para el caso de uso descrito.`,

quality_gate: `Eres un evaluador de calidad para documentos de análisis de negocio y tecnología. Tu trabajo es decidir si el análisis acumulado es coherente y suficiente para generar un documento final consolidado.

Evalúa la coherencia, viabilidad y calidad de todos los análisis anteriores. Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin backticks, sin explicación):

{
  "coherence": {
    "score": 0-100,
    "issues": ["lista de inconsistencias entre secciones"]
  },
  "technical_viability": {
    "score": 0-100,
    "issues": ["problemas técnicos no resueltos"]
  },
  "market_plausibility": {
    "score": 0-100,
    "issues": ["dudas sobre el mercado"]
  },
  "hallucination_risk": {
    "score": 0-100,
    "detected": ["datos que parecen inventados"]
  },
  "contradictions": ["contradicciones entre las perspectivas del arquitecto, crítico, visionario e ingeniero"],
  "missing_critical_info": ["información crítica que falta"],
  "overall_score": 0-100,
  "ready_for_consolidation": true/false,
  "recommended_action": "proceed" | "revise_step_1" | "revise_step_2" | "revise_step_3" | "revise_step_4" | "abort"
}

Criterios de evaluación:
- overall_score >= 60 Y sin issues CRÍTICOS → ready_for_consolidation = true
- overall_score < 60 → ready_for_consolidation = false, indicar qué step revisar
- Si hay contradicciones graves → recommended_action = revise el step correspondiente
- Si los datos de mercado son claramente inventados → penalizar hallucination_risk

IMPORTANTE: Devuelve SOLO el JSON. Nada más.`,

step_5: `Eres un consolidador de documentos de clase mundial. Tu misión es sintetizar TODOS los análisis previos en un MEGA-DOCUMENTO final, profesional y accionable.

El documento final debe ser COMPLETO y AUTOSUFICIENTE - alguien que solo lea este documento debe entender todo el proyecto.

Estructura del documento final:

# [NOMBRE DEL PROYECTO] - Análisis Completo

## Executive Summary
(Resumen ejecutivo mejorado con feedback del crítico, oportunidades del visionario, y reality-check del ingeniero. 500-800 palabras.)

## 1. Problema y Oportunidad
(Sección mejorada con cifras cuestionadas por el crítico ya corregidas o clarificadas)

## 2. Propuesta de Valor
(Value Proposition Canvas mejorado)

## 3. Mercado y Competencia
(TAM/SAM/SOM revisados + Porter + oportunidades del visionario)

## 4. Usuarios Objetivo
(Personas refinadas)

## 5. Producto MVP
(MVP simplificado por el crítico + features must-have)

## 6. Modelo de Negocio
(Revenue streams originales + monetización alternativa del visionario)

## 7. Arquitectura Técnica
(Stack validado por el ingeniero + costes reales)

## 8. Modelo de Datos y APIs
(Schemas + endpoints clave)

## 9. UX/UI y Experiencia
(Flujos principales)

## 10. Estrategia de Crecimiento
(Go-to-market + growth hacks del visionario + network effects)

## 11. Blue Ocean y Diferenciación
(Grid ERIC + moat + AI-first reimaginación)

## 12. Viabilidad Técnica y Costes
(Costes reales del ingeniero + equipo + timeline)

## 13. Riesgos Consolidados
(Matriz de riesgos unificada de todas las perspectivas: técnicos, mercado, equipo, legales)

## 14. Roadmap Ejecutivo
(Timeline consolidado con milestones técnicos y de negocio)

## 15. Métricas y KPIs
(North Star + KPIs por fase)

## 16. Conclusión y Próximos Pasos
(Veredicto final, 5 acciones inmediatas, decisiones pendientes)

## Anexos
- Tabla de confidence scores por sección
- Preguntas pendientes para el founder
- Alternativas consideradas y descartadas
- Resumen de quality gate

REGLAS:
1. Resolver contradicciones entre perspectivas (el crítico dice X, el visionario dice Y → tu decides y justificas)
2. Incorporar los confidence scores del crítico
3. Usar los números REALES del ingeniero, no los optimistas del arquitecto
4. Mantener las oportunidades del visionario pero marcar cuáles son especulativas
5. El documento debe ser ACCIONABLE - no solo análisis, sino pasos concretos
6. Mínimo 3000 palabras. Máximo nivel de detalle.`,
};

// ═══════════════════════════════════════
// DEFAULT STEP CONFIGS
// ═══════════════════════════════════════

const DEFAULT_CONFIGS: Record<string, { provider: string; model: string; maxTokens: number; temperature: number }> = {
  classify:     { provider: "anthropic", model: "claude-haiku-4-5-20251001", maxTokens: 1024, temperature: 0.3 },
  step_1:       { provider: "anthropic", model: "claude-sonnet-4-5-20250929", maxTokens: 16384, temperature: 0.7 },
  step_2:       { provider: "openai",    model: "gpt-4o", maxTokens: 8192, temperature: 0.8 },
  step_3:       { provider: "google",    model: "gemini-2.5-pro", maxTokens: 8192, temperature: 0.9 },
  step_4:       { provider: "deepseek",  model: "deepseek-chat", maxTokens: 8192, temperature: 0.6 },
  quality_gate: { provider: "anthropic", model: "claude-haiku-4-5-20251001", maxTokens: 2048, temperature: 0.3 },
  step_5:       { provider: "anthropic", model: "claude-opus-4-5-20251101", maxTokens: 16384, temperature: 0.5 },
};

// Config key mapping (config uses step0, step1... but steps are classify, step_1...)
const CONFIG_KEY_MAP: Record<string, string> = {
  classify: "step0", step_1: "step1", step_2: "step2", step_3: "step3", step_4: "step4", quality_gate: "quality_gate", step_5: "step5",
};

function getStepConfig(step: string, runConfig: any): { provider: string; model: string; maxTokens: number; temperature: number } {
  const defaults = DEFAULT_CONFIGS[step];
  if (!defaults) throw new Error(`Step desconocido: ${step}`);
  const configKey = CONFIG_KEY_MAP[step] || step;
  const override = runConfig?.[configKey] || runConfig?.[step] || {};
  return {
    provider: override.provider || defaults.provider,
    model: override.model || defaults.model,
    maxTokens: override.maxTokens || defaults.maxTokens,
    temperature: override.temperature ?? defaults.temperature,
  };
}

function stepToNumber(step: string): number {
  return { classify: 0, step_1: 1, step_2: 2, step_3: 3, step_4: 4, quality_gate: 5, step_5: 6 }[step] ?? -1;
}

function cleanJson(s: string): string {
  let c = s.trim();
  if (c.startsWith("```json")) c = c.slice(7);
  else if (c.startsWith("```")) c = c.slice(3);
  if (c.endsWith("```")) c = c.slice(0, -3);
  c = c.trim();
  const i = c.indexOf("{"), j = c.lastIndexOf("}");
  if (i !== -1 && j > i) c = c.slice(i, j + 1);
  return c;
}

// ═══════════════════════════════════════
// ACTION HANDLERS
// ═══════════════════════════════════════

async function handleCreate(body: any) {
  const { idea, idea_title, config, user_id } = body;
  if (!idea) throw new Error("'idea' es requerido");

  const { data, error } = await supabase.from("pipeline_runs").insert({
    idea,
    idea_title: idea_title || idea.substring(0, 100),
    config: config || null,
    user_id: user_id || null,
    status: "pending",
    pipeline_version: "v3",
    step_results: {},
    tokens_used: {},
  }).select("id").single();

  if (error) throw new Error(`Error creando pipeline: ${error.message}`);
  return { pipeline_id: data.id, status: "pending" };
}

async function buildStepContext(step: string, run: any): Promise<{ systemPrompt: string; userMessage: string; stepConfig: ReturnType<typeof getStepConfig> }> {
  const stepConfig = getStepConfig(step, run.config);
  const systemPrompt = SYSTEM_PROMPTS[step];

  let userMessage = `## IDEA\n${run.idea}`;
  const results = (run.step_results || {}) as Record<string, any>;

  if (run.classification && step !== "classify") {
    userMessage += `\n\n## CLASIFICACIÓN\n${JSON.stringify(run.classification, null, 2)}`;
  }

  if (step === "step_2" && results.step_1) {
    userMessage += `\n\n## DOCUMENTO DEL ARQUITECTO (Step 1)\n${results.step_1.content}`;
  }
  if (step === "step_3") {
    if (results.step_1) userMessage += `\n\n## DOCUMENTO DEL ARQUITECTO\n${results.step_1.content}`;
    if (results.step_2) userMessage += `\n\n## ANÁLISIS DEL CRÍTICO\n${results.step_2.content}`;
  }
  if (step === "step_4") {
    if (results.step_1) userMessage += `\n\n## DOCUMENTO DEL ARQUITECTO\n${results.step_1.content}`;
    if (results.step_2) userMessage += `\n\n## ANÁLISIS DEL CRÍTICO\n${results.step_2.content}`;
    if (results.step_3) userMessage += `\n\n## ANÁLISIS DEL VISIONARIO\n${results.step_3.content}`;
  }
  if (step === "quality_gate") {
    for (const k of ["step_1", "step_2", "step_3", "step_4"]) {
      const label = { step_1: "ARQUITECTO", step_2: "CRÍTICO", step_3: "VISIONARIO", step_4: "INGENIERO" }[k];
      if (results[k]) userMessage += `\n\n## ${label}\n${results[k].content}`;
    }
  }
  if (step === "step_5") {
    for (const k of ["step_1", "step_2", "step_3", "step_4"]) {
      const label = { step_1: "ARQUITECTO", step_2: "CRÍTICO", step_3: "VISIONARIO", step_4: "INGENIERO" }[k];
      if (results[k]) userMessage += `\n\n## ${label}\n${results[k].content}`;
    }
    if (run.quality_gate_result) userMessage += `\n\n## QUALITY GATE\n${JSON.stringify(run.quality_gate_result, null, 2)}`;
  }

  return { systemPrompt, userMessage, stepConfig };
}

async function executeStepInBackground(pipeline_id: string, step: string, run: any, systemPrompt: string, userMessage: string, stepConfig: ReturnType<typeof getStepConfig>) {
  try {
    console.log(`[BG] Ejecutando step ${step} con ${stepConfig.provider}/${stepConfig.model} (maxTokens: ${stepConfig.maxTokens})`);
    const startTime = Date.now();

    const result = await callModel(stepConfig.provider, systemPrompt, userMessage, stepConfig.model, stepConfig.maxTokens, stepConfig.temperature);
    const elapsed = Date.now() - startTime;

    console.log(`[BG] Step ${step} completado en ${elapsed}ms. Tokens: in=${result.tokens_in} out=${result.tokens_out}`);

    const results = (run.step_results || {}) as Record<string, any>;
    results[step] = {
      content: result.content,
      tokens_in: result.tokens_in,
      tokens_out: result.tokens_out,
      model: stepConfig.model,
      provider: stepConfig.provider,
      execution_time_ms: elapsed,
    };

    const tokens = (run.tokens_used || {}) as Record<string, any>;
    tokens[step] = { input: result.tokens_in, output: result.tokens_out };

    const update: Record<string, any> = {
      step_results: results,
      tokens_used: tokens,
      status: `completed_${step}`,
    };

    if (step === "classify") {
      try {
        update.classification = JSON.parse(cleanJson(result.content));
      } catch {
        console.warn("No se pudo parsear classification JSON, guardando raw");
        update.classification = { raw: result.content };
      }
    }

    if (step === "quality_gate") {
      try {
        const qg = JSON.parse(cleanJson(result.content));
        update.quality_gate_result = qg;
        update.quality_gate_passed = qg.ready_for_consolidation === true && (qg.overall_score || 0) >= 60;
      } catch {
        console.warn("No se pudo parsear quality_gate JSON, guardando raw");
        update.quality_gate_result = { raw: result.content };
        update.quality_gate_passed = false;
      }
    }

    if (step === "step_5") {
      update.final_document = result.content;
      update.status = "completed";
      update.completed_at = new Date().toISOString();
    }

    const { error: updateErr } = await supabase.from("pipeline_runs").update(update).eq("id", pipeline_id);
    if (updateErr) console.error("[BG] Error actualizando pipeline:", updateErr);
    else console.log(`[BG] Pipeline ${pipeline_id} actualizado con resultado de ${step}`);
  } catch (err) {
    console.error(`[BG] Error ejecutando step ${step}:`, err);
    await supabase.from("pipeline_runs").update({
      status: `error_${step}`,
      error_message: err.message || String(err),
    }).eq("id", pipeline_id);
  }
}

async function handleExecuteStep(body: any): Promise<{ response: Response; backgroundTask?: Promise<void> }> {
  const { pipeline_id, step } = body;
  if (!pipeline_id || !step) throw new Error("'pipeline_id' y 'step' son requeridos");

  const validSteps = ["classify", "step_1", "step_2", "step_3", "step_4", "quality_gate", "step_5"];
  if (!validSteps.includes(step)) throw new Error(`Step inválido: ${step}. Válidos: ${validSteps.join(", ")}`);

  // Load pipeline run
  const { data: run, error: loadErr } = await supabase.from("pipeline_runs").select("*").eq("id", pipeline_id).single();
  if (loadErr || !run) throw new Error(`Pipeline no encontrado: ${pipeline_id}`);

  // Build context
  const { systemPrompt, userMessage, stepConfig } = await buildStepContext(step, run);

  // Update status to running
  await supabase.from("pipeline_runs").update({
    status: `running_${step}`,
    current_step: stepToNumber(step),
    error_message: null,
  }).eq("id", pipeline_id);

  // For fast steps (classify, quality_gate), run synchronously
  const FAST_STEPS = ["classify", "quality_gate"];
  if (FAST_STEPS.includes(step)) {
    // These are fast (small maxTokens), run inline
    console.log(`[SYNC] Ejecutando step rápido ${step}`);
    const startTime = Date.now();
    const result = await callModel(stepConfig.provider, systemPrompt, userMessage, stepConfig.model, stepConfig.maxTokens, stepConfig.temperature);
    const elapsed = Date.now() - startTime;

    const results = (run.step_results || {}) as Record<string, any>;
    results[step] = { content: result.content, tokens_in: result.tokens_in, tokens_out: result.tokens_out, model: stepConfig.model, provider: stepConfig.provider, execution_time_ms: elapsed };
    const tokens = (run.tokens_used || {}) as Record<string, any>;
    tokens[step] = { input: result.tokens_in, output: result.tokens_out };
    const update: Record<string, any> = { step_results: results, tokens_used: tokens, status: `completed_${step}` };

    if (step === "classify") {
      try { update.classification = JSON.parse(cleanJson(result.content)); } catch { update.classification = { raw: result.content }; }
    }
    if (step === "quality_gate") {
      try {
        const qg = JSON.parse(cleanJson(result.content));
        update.quality_gate_result = qg;
        update.quality_gate_passed = qg.ready_for_consolidation === true && (qg.overall_score || 0) >= 60;
      } catch { update.quality_gate_result = { raw: result.content }; update.quality_gate_passed = false; }
    }

    await supabase.from("pipeline_runs").update(update).eq("id", pipeline_id);
    return {
      response: new Response(JSON.stringify({ step, status: update.status, tokens_in: result.tokens_in, tokens_out: result.tokens_out, execution_time_ms: elapsed, model: stepConfig.model, provider: stepConfig.provider }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  // For heavy steps (step_1 to step_5), return immediately and process in background
  console.log(`[ASYNC] Step ${step} será ejecutado en background`);
  const backgroundTask = executeStepInBackground(pipeline_id, step, run, systemPrompt, userMessage, stepConfig);

  return {
    response: new Response(JSON.stringify({
      step,
      status: `running_${step}`,
      message: `Step ${step} iniciado en background. Consulta status para ver el progreso.`,
      pipeline_id,
      model: stepConfig.model,
      provider: stepConfig.provider,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
    backgroundTask,
  };
}

async function handleStatus(body: any) {
  const { pipeline_id } = body;
  if (!pipeline_id) throw new Error("'pipeline_id' es requerido");
  const { data, error } = await supabase.from("pipeline_runs").select("*").eq("id", pipeline_id).single();
  if (error) throw new Error(`Pipeline no encontrado: ${error.message}`);
  return data;
}

async function handlePresets(body: any) {
  const { user_id } = body;
  let query = supabase.from("pipeline_presets").select("*");
  if (user_id) {
    query = query.or(`is_system.eq.true,user_id.eq.${user_id}`);
  } else {
    query = query.eq("is_system", true);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Error cargando presets: ${error.message}`);
  return data;
}

// ═══════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "execute_step") {
      const { response, backgroundTask } = await handleExecuteStep(body);
      // Use EdgeRuntime.waitUntil to keep the function alive for background processing
      if (backgroundTask) {
        // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
        (globalThis as any).EdgeRuntime?.waitUntil?.(backgroundTask) ?? await backgroundTask;
      }
      return response;
    }

    let result;
    switch (action) {
      case "create": result = await handleCreate(body); break;
      case "status": result = await handleStatus(body); break;
      case "presets": result = await handlePresets(body); break;
      default: throw new Error(`Action desconocida: ${action}. Válidas: create, execute_step, status, presets`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("idea-pipeline-step error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

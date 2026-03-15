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

const SYSTEM_PROMPT = `Eres un consultor estratégico senior especializado en lanzamiento de productos SaaS B2B. 
Generas documentos de estrategia comercial de alta calidad, accionables y específicos.

REGLAS:
- Formato Markdown profesional con títulos ##, subtítulos ###, tablas y listas
- Tono de consultoría estratégica: directo, concreto, sin relleno genérico
- Usa tablas Markdown cuando aporten claridad (competidores, pricing, riesgos, unit economics, TAM/SAM/SOM)
- Cada sección debe tener conclusiones accionables
- Extensión: 7-10 páginas equivalentes (~4000-6000 palabras)
- Idioma: Español
- NO uses encabezados H1 (#). Empieza directamente con H2 (##)
- Basa tus análisis en los datos reales del proyecto, no inventes información genérica

ESTRUCTURA OBLIGATORIA:

## 1. Mercado Objetivo (ICP)
- Tipo de empresa, sector, tamaño, perfil del decisor
- Problema principal que resuelve el producto
- Contexto en el que aparece el problema
- Tabla: Segmentos prioritarios con descripción y potencial
- Perfil del early adopter

## 2. Tamaño de Mercado (TAM / SAM / SOM)
Analizar el tamaño potencial del mercado si se lanza como SaaS.
### TAM — Total Addressable Market
Número total de empresas o clientes potenciales a nivel global.
### SAM — Serviceable Available Market
Subconjunto del TAM considerando sector, tipo de empresa, nivel tecnológico y contexto de uso.
### SOM — Serviceable Obtainable Market
Porción realista capturable en los primeros 3-5 años.
Tabla obligatoria:
| Métrica | Descripción | Estimación |
|---------|------------|------------|
| TAM | Mercado total potencial | ... |
| SAM | Mercado alcanzable | ... |
| SOM | Mercado capturable (3-5 años) | ... |

## 3. Propuesta de Valor del Producto
Sintetizar claramente el valor diferencial del producto.
### Situación actual
Cómo se resuelve hoy el problema (procesos manuales, herramientas genéricas, etc.)
### Solución propuesta
Cómo el producto mejora esa situación de forma concreta.
### Beneficios principales
Lista de beneficios clave: eficiencia, reducción de carga operativa, calidad del servicio, escalabilidad.
El resumen debe ser utilizable para comunicación comercial, página web y material de ventas.

## 4. Análisis de Mercado, Competencia y Pricing
### Competidores directos
Tabla comparativa: nombre, tipo, fortalezas, debilidades, precio
### Competidores indirectos
Alternativas actuales (Excel, procesos manuales, consultoría, herramientas generalistas)
### Posicionamiento de mercado
Huecos identificados, oportunidad diferencial
### Benchmark de precios
Tabla: modelo de pricing, rango de precios, ticket medio recomendado, estrategia de monetización

## 5. Unit Economics del SaaS
Estimar las métricas fundamentales del negocio SaaS para evaluar viabilidad económica.
Tabla obligatoria:
| Métrica | Estimación |
|---------|------------|
| Precio mensual estimado | ... |
| ACV (Annual Contract Value) | ... |
| CAC estimado | ... |
| Tiempo de recuperación CAC | ... |
| LTV estimado | ... |
| Ratio LTV/CAC | ... |
| Margen bruto estimado | ... |
| Coste de infraestructura aproximado | ... |
Incluir análisis de viabilidad económica del modelo.

## 6. Ventaja Competitiva Tecnológica
Identificar los factores que generan ventaja competitiva sostenible y dificultan la copia del producto.
Analizar factores como:
- Integración profunda con herramientas existentes
- Dataset propietario generado por clientes
- Arquitectura técnica específica
- Automatización avanzada con IA
- Conocimiento especializado del sector
Explicar por qué el producto podría mantener ventaja frente a competidores a medio-largo plazo.

## 7. Estrategia de Adquisición de Clientes
- Máximo 3 canales principales priorizados
- Para cada canal: descripción, dificultad, CAC estimado, justificación estratégica
- Tabla resumen de canales

## 8. Canales de Lanzamiento y Estrategia de Marketing
Definir cómo se dará a conocer el producto al mercado durante el lanzamiento.
### 8.1 Canales principales de lanzamiento
Identificar los 3-5 canales más efectivos para lanzar el producto (outbound B2B, comunidades profesionales, contenido especializado, partnerships estratégicos, marketplaces, eventos del sector, referral program, etc.).
Tabla obligatoria:
| Canal | Objetivo | Prioridad | Justificación |
|-------|----------|-----------|---------------|
### 8.2 Estrategia de marketing
Definir el enfoque de marketing más adecuado para el producto:
- Tipo de marketing más efectivo (contenido, ventas directas, comunidad, partnerships)
- Posicionamiento del producto en el mercado
- Narrativa del producto y mensajes clave
- Propuesta de valor comunicada al mercado
### 8.3 Uso estratégico de redes sociales
Analizar qué redes sociales son útiles para el lanzamiento. Evaluar LinkedIn, Twitter/X, YouTube, TikTok, Instagram y comunidades especializadas.
Tabla obligatoria:
| Red social | Objetivo | Tipo de contenido | Prioridad |
|------------|----------|-------------------|-----------|
Para cada red: indicar relevancia, tipo de contenido que funcionaría y cómo apoya el crecimiento.
### 8.4 Plan inicial de visibilidad (primeros 3 meses)
Definir acciones concretas: publicación de contenido especializado, outreach a early adopters, colaboraciones con expertos, presencia en comunidades profesionales, demostraciones del producto.
Priorizar pocos canales con alto impacto. Evitar recomendaciones genéricas.

## 9. Estrategia de Lanzamiento (Go-To-Market)
### Fase 1 — Early Adopters
Objetivo, acciones clave, métricas de éxito
### Fase 2 — Lanzamiento Público
Objetivo, acciones clave, métricas de éxito
### Fase 3 — Expansión
Objetivo, acciones clave, métricas de éxito

## 10. Estrategia de Crecimiento
- Modelo recomendado (PLG, outbound, contenido, partnerships, etc.)
- Justificación de por qué es el más adecuado
- Recursos necesarios
- Potencial de crecimiento estimado

## 11. Activación y Retención de Usuarios
- Onboarding recomendado (pasos concretos)
- Time-to-value estimado
- Mecanismos de engagement
- Mejoras para aumentar retención

## 12. Riesgos del Lanzamiento
Tabla: riesgo, impacto (alto/medio/bajo), probabilidad, recomendación de mitigación
Mínimo 5 riesgos específicos al producto

## 13. Roadmap Comercial
### Capa 1 — Validación (0-3 meses)
Objetivo, acciones, métricas
### Capa 2 — Go-To-Market (3-6 meses)
Objetivo, acciones, métricas
### Capa 3 — Escala (6-12 meses)
Objetivo, acciones, métricas

Al final de la sección, añadir una etiqueta visual:
- Si Score >= 65: 🟢 **High SaaS Potential**
- Si Score 50-64: 🟡 **Medium Potential**
- Si Score < 50: 🔴 **Low Potential**
`;
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

    // Load project metadata
    const { data: project, error: projErr } = await supabase
      .from("business_projects")
      .select("name, company, sector, business_type, business_size, need_summary, need_why, need_budget, need_deadline, status, project_type, input_content, user_id")
      .eq("id", projectId)
      .single();

    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load wizard steps (briefing=2, scope=3, audit=4, PRD=5, MVP=7)
    const { data: steps } = await supabase
      .from("project_wizard_steps")
      .select("step_number, output_data, status")
      .eq("project_id", projectId)
      .in("step_number", [2, 3, 4, 5, 7, 100]);

    const stepMap: Record<number, string> = {};
    for (const s of steps || []) {
      const raw = typeof s.output_data === "string" ? s.output_data : JSON.stringify(s.output_data);
      stepMap[s.step_number] = truncate(raw);
    }

    // Build context
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

    if (stepMap[2]) contextParts.push(`\n--- BRIEFING (F2) ---\n${stepMap[2]}`);
    if (stepMap[3]) contextParts.push(`\n--- ALCANCE (F3) ---\n${stepMap[3]}`);
    if (stepMap[4]) contextParts.push(`\n--- AUDITORÍA (F4) ---\n${stepMap[4]}`);
    if (stepMap[5]) contextParts.push(`\n--- PRD TÉCNICO (F5) ---\n${stepMap[5]}`);
    if (stepMap[7]) contextParts.push(`\n--- MVP (F7) ---\n${stepMap[7]}`);
    if (stepMap[100]) contextParts.push(`\n--- PROPUESTA DE SOLUCIÓN (F100) ---\n${stepMap[100]}`);

    const userPrompt = `Analiza toda la información del siguiente proyecto y genera un DOCUMENTO ESTRATÉGICO DE LANZAMIENTO completo siguiendo la estructura de 8 secciones obligatorias.

El documento debe evaluar la viabilidad de lanzar este producto al mercado como un SaaS escalable y definir su estrategia comercial inicial.

${contextParts.join("\n")}

Genera el documento completo en Markdown. Recuerda: NO uses H1 (#), empieza con H2 (##). Sé específico al proyecto, evita generalidades.`;

    console.log(`[generate-launch-strategy] Generating for project ${projectId} (${project.name})`);

    const markdown = await chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      {
        model: "gemini-pro",
        temperature: 0.6,
        maxTokens: 65536,
      }
    );

    // Save as step 200
    const { error: upsertErr } = await supabase
      .from("project_wizard_steps")
      .upsert(
        {
          project_id: projectId,
          step_number: 200,
          step_name: "launch_strategy",
          output_data: markdown,
          status: "completed",
          version: 1,
          user_id: project.user_id,
        },
        { onConflict: "project_id,step_number" }
      );

    if (upsertErr) {
      console.error("[generate-launch-strategy] Upsert error:", upsertErr);
    }

    return new Response(JSON.stringify({ markdown, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-launch-strategy] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

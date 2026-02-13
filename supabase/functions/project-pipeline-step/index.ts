import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STEP_CONFIG: Record<number, { model: string; provider: string; envKey: string; maxTokens: number; temperature: number }> = {
  1: { model: "claude-sonnet-4-20250514", provider: "anthropic", envKey: "ANTHROPIC_API_KEY", maxTokens: 8000, temperature: 0.7 },
  2: { model: "gpt-4o", provider: "openai", envKey: "OPENAI_API_KEY", maxTokens: 6000, temperature: 0.5 },
  3: { model: "gemini-2.0-flash", provider: "google", envKey: "GOOGLE_AI_API_KEY", maxTokens: 6000, temperature: 0.8 },
  4: { model: "claude-sonnet-4-20250514", provider: "anthropic", envKey: "ANTHROPIC_API_KEY", maxTokens: 10000, temperature: 0.6 },
};

const SYSTEM_PROMPTS: Record<number, string> = {
  1: `Eres un equipo de élite compuesto por: Director de Estrategia de McKinsey, Arquitecto de Software Senior de Google, Product Manager ex-Meta, Diseñador UX ex-Apple, y Analista Financiero de Goldman Sachs.

Tu misión es generar un DOCUMENTO TÉCNICO COMPLETO para el siguiente proyecto/idea. NO uses frases genéricas. Cada punto debe tener datos concretos, estimaciones numéricas y decisiones justificadas. Mínimo 3000 palabras.

ESTRUCTURA OBLIGATORIA (15 secciones):
1. **Resumen Ejecutivo** (300 palabras) - Elevator pitch, propuesta de valor, mercado objetivo, modelo de negocio
2. **Problema y Oportunidad** - Pain points específicos, TAM/SAM/SOM con cifras estimadas, timing del mercado
3. **Value Proposition Canvas** - Jobs-to-be-done, pains, gains, pain relievers, gain creators
4. **Análisis Competitivo** - Mínimo 5 competidores con tabla comparativa, diferenciadores, moat defensivo
5. **Personas de Usuario** - 3 personas detalladas con demografía, comportamiento, frustraciones, objetivos
6. **Funcionalidades MVP** - Clasificación MoSCoW, priorización RICE score, user stories principales
7. **Arquitectura Técnica** - Stack tecnológico justificado, diagrama de componentes, decisiones de infraestructura
8. **Modelo de Datos** - Entidades principales, relaciones, esquema simplificado
9. **API y Integraciones** - Endpoints principales, servicios externos, webhooks necesarios
10. **Diseño UX/UI** - Principios de diseño, flujos principales, wireframes textuales de pantallas clave
11. **Plan de Desarrollo** - Sprints detallados (2 semanas cada uno), milestones, equipo necesario
12. **Modelo de Negocio** - Lean Canvas completo, pricing strategy, unit economics (CAC, LTV, payback)
13. **Matriz de Riesgos** - Mínimo 8 riesgos con probabilidad, impacto, mitigación
14. **KPIs y Métricas** - North Star Metric, métricas por área (HEART framework), dashboards
15. **Próximos 10 Pasos** - Acciones concretas con responsable y deadline estimado

FRAMEWORKS OBLIGATORIOS: Jobs-to-be-Done (JTBD), Lean Canvas, Value Proposition Canvas, MoSCoW, RICE, Porter's Five Forces, TAM/SAM/SOM, HEART Metrics.

Usa formato Markdown con tablas donde aplique.`,

  2: `Eres un comité de revisión brutal compuesto por: CTO con 20 años de experiencia en sistemas distribuidos, Venture Capitalist que ha evaluado 500+ startups, Hacker ético especialista en seguridad, y Consultor de estrategia con enfoque en fracasos empresariales.

Tu trabajo es DESTRUIR CONSTRUCTIVAMENTE el documento del Paso 1. No seas amable. Sé despiadado pero justo. Cada crítica DEBE incluir una solución concreta. Mínimo 2500 palabras.

ANALIZA OBLIGATORIAMENTE:
1. **Suposiciones no validadas** - ¿Qué asume el documento sin evidencia? ¿Dónde están los saltos de fe?
2. **Fallos de arquitectura** - Puntos únicos de fallo, problemas de escalabilidad, deuda técnica oculta
3. **Seguridad** - Vulnerabilidades OWASP Top 10, privacidad de datos, compliance (GDPR, etc.)
4. **Modelo financiero** - ¿Son realistas los números? CAC vs LTV, burn rate, runway necesario
5. **Gaps de producto** - Features faltantes críticas, edge cases no contemplados, deuda de UX
6. **Riesgos no identificados** - ¿Qué puede salir mal que NO está en la matriz de riesgos?
7. **Competencia subestimada** - ¿Qué competidores faltan? ¿Qué pasa si un FAANG entra al mercado?
8. **Timeline irreal** - ¿Es factible el plan de desarrollo? ¿Qué ajustar?
9. **Top 10 recomendaciones prioritarias** con justificación y esfuerzo estimado

Para CADA crítica proporciona:
- Severidad (Crítica/Alta/Media/Baja)
- Evidencia o razonamiento
- Solución concreta y actionable
- Esfuerzo estimado de implementación`,

  3: `Eres un equipo visionario compuesto por: Investigador del MIT Media Lab, Design Thinker de IDEO, Estratega de Blue Ocean, y Partner de Y Combinator.

Tu trabajo NO es corregir (eso ya se hizo). Tu trabajo es VER LO QUE OTROS NO VEN. Piensa en grande. Piensa diferente. Mínimo 2000 palabras.

GENERA OBLIGATORIAMENTE:
1. **Oportunidades ocultas** - ¿Qué mercados adyacentes existen? ¿Qué pivots potenciales son más prometedores?
2. **Blue Ocean Strategy** - Aplica el framework ERIC (Eliminar, Reducir, Incrementar, Crear) al proyecto
3. **Efectos de red** - ¿Cómo crear network effects? ¿Qué tipo aplica (directo, indirecto, datos)?
4. **AI-First reimaginación** - ¿Cómo sería el producto si se diseñara 100% alrededor de IA generativa?
5. **Alternativa radical** - Propón una versión completamente diferente del producto que nadie esperaría
6. **Platform thinking** - ¿Puede convertirse en plataforma? ¿Cómo crear un ecosistema?
7. **Growth hacks** - 5 estrategias de crecimiento no convencionales específicas para este producto
8. **Futuro a 5 años** - ¿Cómo evoluciona? ¿Qué tecnologías emergentes lo transformarán?
9. **Moat definitivo** - ¿Cuál es la ventaja competitiva sostenible a largo plazo más fuerte posible?

NO repitas lo que dijeron los pasos anteriores. INNOVA. Cada idea debe ser específica, no genérica.`,

  4: `Eres un Partner Senior de una consultora top que presenta a boards de Fortune 500. Has leído:
- El documento técnico original (Paso 1)
- Las críticas destructivas (Paso 2)
- Las visiones innovadoras (Paso 3)

Tu trabajo es crear el DOCUMENTO DEFINITIVO. No es un resumen. Es una REESCRITURA COMPLETA mejorada. Mínimo 5000 palabras.

REGLAS:
1. Para CADA crítica del Paso 2, toma una DECISIÓN: aceptar (y modificar el documento), rechazar (con justificación), o diferir (con condiciones)
2. Para CADA idea del Paso 3, evalúa si incorporarla ahora, planificarla para futuro, o descartarla (con razón)
3. El documento final debe ser AUTOCONTENIDO - alguien que lea solo este documento debe entender todo
4. Incluye un CHANGELOG al inicio: qué cambió respecto al documento original y por qué

ESTRUCTURA DEL DOCUMENTO FINAL:
- **Portada**: Nombre del proyecto, versión, fecha, equipo
- **Changelog**: Decisiones tomadas sobre cada crítica e idea
- **Resumen Ejecutivo** (mejorado)
- **Las 15 secciones originales** (todas mejoradas con las decisiones incorporadas)
- **Apéndice A**: Tabla de decisiones (crítica → decisión → justificación)
- **Apéndice B**: Ideas descartadas y por qué
- **Apéndice C**: Plan de acción primeros 30 días

Usa Markdown profesional con tablas, métricas concretas y lenguaje ejecutivo. Calidad de entrega a VC, CTO y CEO.`,
};

async function callAnthropic(apiKey: string, systemPrompt: string, userContent: string, config: typeof STEP_CONFIG[1]) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic error: ${JSON.stringify(data)}`);
  return {
    text: data.content?.[0]?.text || "",
    tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
  };
}

async function callOpenAI(apiKey: string, systemPrompt: string, userContent: string, config: typeof STEP_CONFIG[1]) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI error: ${JSON.stringify(data)}`);
  return {
    text: data.choices?.[0]?.message?.content || "",
    tokens: data.usage?.total_tokens || 0,
  };
}

async function callGemini(apiKey: string, systemPrompt: string, userContent: string, config: typeof STEP_CONFIG[1]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userContent }] }],
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature,
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini error: ${JSON.stringify(data)}`);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const tokens = (data.usageMetadata?.promptTokenCount || 0) + (data.usageMetadata?.candidatesTokenCount || 0);
  return { text, tokens };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pipelineId, stepNumber } = await req.json();

    if (!pipelineId || !stepNumber || stepNumber < 1 || stepNumber > 4) {
      return new Response(JSON.stringify({ error: "pipelineId and stepNumber (1-4) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get pipeline
    const { data: pipeline, error: pipelineError } = await supabase
      .from("project_pipelines")
      .select("*")
      .eq("id", pipelineId)
      .single();

    if (pipelineError || !pipeline) {
      return new Response(JSON.stringify({ error: "Pipeline not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get previous steps outputs
    const { data: previousSteps } = await supabase
      .from("pipeline_steps")
      .select("step_number, output_content, model_name")
      .eq("pipeline_id", pipelineId)
      .lt("step_number", stepNumber)
      .order("step_number");

    // Build input
    let inputContent = `## IDEA/PROYECTO:\n${pipeline.idea_description}\n\n`;
    if (previousSteps?.length) {
      for (const step of previousSteps) {
        inputContent += `## OUTPUT PASO ${step.step_number} (${step.model_name}):\n${step.output_content}\n\n`;
      }
    }

    const config = STEP_CONFIG[stepNumber];
    const systemPrompt = SYSTEM_PROMPTS[stepNumber];
    const apiKey = Deno.env.get(config.envKey);

    if (!apiKey) {
      return new Response(JSON.stringify({ error: `Missing API key: ${config.envKey}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or update step record
    const { data: existingStep } = await supabase
      .from("pipeline_steps")
      .select("id")
      .eq("pipeline_id", pipelineId)
      .eq("step_number", stepNumber)
      .single();

    const stepId = existingStep?.id || undefined;

    const stepRecord = {
      pipeline_id: pipelineId,
      step_number: stepNumber,
      model_name: `${config.provider}/${config.model}`,
      role_description: systemPrompt.substring(0, 200),
      input_content: inputContent.substring(0, 50000),
      status: "in_progress",
      started_at: new Date().toISOString(),
    };

    let currentStepId: string;
    if (stepId) {
      await supabase.from("pipeline_steps").update(stepRecord).eq("id", stepId);
      currentStepId = stepId;
    } else {
      const { data: newStep } = await supabase.from("pipeline_steps").insert(stepRecord).select("id").single();
      currentStepId = newStep!.id;
    }

    // Update pipeline status
    await supabase.from("project_pipelines").update({
      status: "in_progress",
      current_step: stepNumber,
    }).eq("id", pipelineId);

    console.log(`[Pipeline] Step ${stepNumber} starting with ${config.provider}/${config.model}`);

    // Call the appropriate model
    let result: { text: string; tokens: number };
    try {
      if (config.provider === "anthropic") {
        result = await callAnthropic(apiKey, systemPrompt, inputContent, config);
      } else if (config.provider === "openai") {
        result = await callOpenAI(apiKey, systemPrompt, inputContent, config);
      } else {
        result = await callGemini(apiKey, systemPrompt, inputContent, config);
      }
    } catch (modelError) {
      const errMsg = modelError instanceof Error ? modelError.message : "Model call failed";
      console.error(`[Pipeline] Step ${stepNumber} model error:`, errMsg);

      await supabase.from("pipeline_steps").update({
        status: "error",
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      }).eq("id", currentStepId);

      await supabase.from("project_pipelines").update({
        status: "error",
        error_message: `Step ${stepNumber} failed: ${errMsg}`,
      }).eq("id", pipelineId);

      return new Response(JSON.stringify({ error: errMsg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Pipeline] Step ${stepNumber} completed. Tokens: ${result.tokens}, Output length: ${result.text.length}`);

    // Save step result
    await supabase.from("pipeline_steps").update({
      output_content: result.text,
      status: "completed",
      tokens_used: result.tokens,
      completed_at: new Date().toISOString(),
    }).eq("id", currentStepId);

    // If step 4, save final document
    if (stepNumber === 4) {
      await supabase.from("project_pipelines").update({
        status: "completed",
        current_step: 4,
        final_document: result.text,
      }).eq("id", pipelineId);
    } else {
      await supabase.from("project_pipelines").update({
        current_step: stepNumber,
      }).eq("id", pipelineId);
    }

    // Broadcast via Realtime
    await supabase.channel("pipeline-updates").send({
      type: "broadcast",
      event: "step-completed",
      payload: {
        pipelineId,
        stepNumber,
        status: "completed",
        tokensUsed: result.tokens,
        outputPreview: result.text.substring(0, 500),
      },
    });

    return new Response(JSON.stringify({
      status: "completed",
      stepNumber,
      model: `${config.provider}/${config.model}`,
      tokensUsed: result.tokens,
      outputLength: result.text.length,
      output: result.text,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Pipeline] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

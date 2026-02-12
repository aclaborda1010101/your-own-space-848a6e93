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

  try {
    const { pipelineId } = await req.json();

    if (!pipelineId) {
      return new Response(JSON.stringify({ error: "pipelineId required" }), {
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

    // Get step 4 output
    const { data: step4 } = await supabase
      .from("pipeline_steps")
      .select("output_content")
      .eq("pipeline_id", pipelineId)
      .eq("step_number", 4)
      .eq("status", "completed")
      .single();

    if (!step4?.output_content) {
      return new Response(JSON.stringify({ error: "Step 4 not completed yet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Eres un experto en Lovable.dev (la plataforma de desarrollo con IA). Tu tarea es convertir un documento técnico completo de un proyecto en un PROMPT OPTIMIZADO para pegar directamente en Lovable.dev que genere una aplicación funcional completa.

El prompt que generes debe ser autocontenido - Lovable debe poder generar toda la app solo con este prompt.

ESTRUCTURA DEL PROMPT QUE DEBES GENERAR:

1. **Descripción del Proyecto** (2-3 párrafos claros)
   - Qué hace la app, para quién, problema que resuelve
   
2. **Stack Técnico**
   - React + TypeScript + Tailwind CSS + Shadcn/UI + Supabase
   - Librerías adicionales necesarias (especificar nombres exactos de npm)

3. **Páginas y Rutas** (lista completa)
   - Ruta, componente, descripción, autenticación requerida

4. **Componentes Principales** (para cada uno)
   - Nombre, props, estado interno, comportamiento

5. **Modelo de Datos Supabase** (SQL listo para ejecutar)
   - CREATE TABLE con tipos, constraints, defaults
   - RLS policies completas
   - Triggers si aplica

6. **Edge Functions** (para cada una)
   - Nombre, endpoint, método, body esperado, respuesta
   - Lógica principal resumida

7. **Flujos de Usuario** (paso a paso)
   - Registro/Login
   - Flujo principal de la app
   - Flujos secundarios

8. **Diseño UI/UX**
   - Tema (dark/light), paleta de colores
   - Layout principal, navegación
   - Componentes clave con descripción visual

REGLAS:
- NO uses lenguaje vago. Sé específico con nombres de componentes, tablas, columnas, rutas.
- El prompt debe poder copiarse y pegarse directamente en Lovable.dev
- Incluye TODOS los detalles necesarios para que Lovable genere la app sin preguntas adicionales
- Usa formato Markdown limpio
- Extensión: entre 3000 y 5000 palabras`;

    const userContent = `Genera el prompt para Lovable.dev basándote en este documento técnico completo del proyecto:\n\n${step4.output_content}`;

    console.log("[Lovable Prompt] Generating prompt for pipeline:", pipelineId);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        temperature: 0.6,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[Lovable Prompt] Anthropic error:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: `Anthropic error: ${data.error?.message || "unknown"}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const promptText = data.content?.[0]?.text || "";
    const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

    console.log(`[Lovable Prompt] Generated. Tokens: ${tokens}, Length: ${promptText.length}`);

    // Save to pipeline
    await supabase.from("project_pipelines").update({
      lovable_prompt: promptText,
    }).eq("id", pipelineId);

    return new Response(JSON.stringify({
      prompt: promptText,
      tokensUsed: tokens,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Lovable Prompt] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

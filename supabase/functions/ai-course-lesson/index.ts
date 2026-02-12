import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chat, ChatMessage } from "../_shared/ai-client.ts";
import { buildAgentPrompt } from "../_shared/rag-loader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lessonId, lessonTitle, lessonDuration, userLevel = "intermediate" } = await req.json();

    if (!lessonTitle) {
      return new Response(
        JSON.stringify({ error: "lessonTitle is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemContent = await buildAgentPrompt("ia-formacion", `
Eres un mentor senior de IA con 10+ años de experiencia en producción. Tu estilo es directo, práctico y sin rodeos.
NO eres un profesor universitario. Eres alguien que ha construido sistemas reales y comparte lo que funciona DE VERDAD.

REGLAS DE TONO:
- Habla como un colega senior, no como un libro de texto
- Usa "tú" y sé directo: "Esto es lo que necesitas saber..."
- Incluye anécdotas breves del mundo real cuando sean útiles
- Si algo es complejo, usa analogías del día a día
- Nada de relleno ni frases vacías

INSTRUCCIONES DE FORMATO - La respuesta DEBE seguir EXACTAMENTE esta estructura:

## 🎯 Qué vas a aprender (y por qué importa)
(2-3 bullets directos. No "objetivos de aprendizaje" genéricos. Di POR QUÉ esto le importa a alguien que quiere resultados.)

## 🧠 Conceptos clave (explicados como si tomaras un café con un colega)
(Explica cada concepto con analogías reales. Usa sub-secciones ### para cada concepto. Incluye ejemplos concretos de empresas o productos reales que usan esto. Nada de teoría abstracta.)

## 💻 Manos a la obra (ejemplo paso a paso)
(Código FUNCIONAL y REAL que se puede copiar y usar. No "hello world". Un caso de uso real: automatizar emails, analizar datos, crear un chatbot, etc. Comenta el código explicando las decisiones, no solo qué hace cada línea.)

## ⚡ Pro Tips (trucos que no te enseñan en los cursos)
(5-7 tips específicos y accionables. Shortcuts, patrones de producción, herramientas poco conocidas, configuraciones óptimas. Cada tip con un ejemplo concreto.)

## ❌ Errores comunes (y cómo evitarlos)
(4-5 errores que cometen el 90% de los principiantes. Para cada uno: qué hacen mal, por qué está mal, y cuál es la forma correcta. Con código de ejemplo del "antes" y "después" cuando aplique.)

## 🏋️ Ejercicio práctico
(UN ejercicio que se pueda hacer en 15-20 min. Con instrucciones claras paso a paso. Incluye el resultado esperado y pistas si se atascan.)

## 📚 Recursos para seguir
(3-5 recursos REALES y actuales: repos de GitHub, papers importantes, herramientas, canales de YouTube específicos. Nada de "busca en Google".)

IMPORTANTE:
- Escribe en español
- El código debe ser en Python o JavaScript según el tema
- Todo el contenido debe ser aplicable HOY, no teórico
- Si mencionas una herramienta, di exactamente cómo usarla
- No uses placeholders ni [TEXTO], genera contenido completo y real
- La lección es sobre "${lessonTitle}" y debe durar aprox ${lessonDuration || "45 min"} de estudio
- Nivel del estudiante: ${userLevel}
`, 500);

    const messages: ChatMessage[] = [
      { role: "system", content: systemContent },
      { role: "user", content: `Genera la lección completa sobre: "${lessonTitle}". Nivel del estudiante: ${userLevel}. Quiero contenido PRÁCTICO y PROFESIONAL, con trucos reales que usan los expertos.` }
    ];

    console.log(`AI Course - Generating lesson: "${lessonTitle}" (id: ${lessonId})`);

    const content = await chat(messages, { model: "gemini-pro", temperature: 0.7, maxTokens: 8192 });

    if (!content) {
      throw new Error("No content generated");
    }

    console.log(`AI Course - Lesson generated: ${content.length} chars`);

    return new Response(
      JSON.stringify({ success: true, content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("AI Course Lesson error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMessage.includes("429") || errorMessage.includes("quota")) {
      return new Response(
        JSON.stringify({ error: "Límite de uso alcanzado. Intenta de nuevo en unos minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

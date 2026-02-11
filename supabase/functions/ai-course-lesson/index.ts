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
Eres un profesor experto en IA creando una lección interactiva.

INSTRUCCIONES ESTRICTAS DE FORMATO:
Genera una lección completa sobre "${lessonTitle}" para un estudiante de nivel ${userLevel}.
La lección debe durar aproximadamente ${lessonDuration || "45 min"} de estudio.

La respuesta DEBE seguir EXACTAMENTE esta estructura con estos encabezados markdown:

## 🎯 Objetivos de aprendizaje
(3-4 objetivos claros en bullet points)

## 📖 Introducción
(2-3 párrafos motivacionales explicando qué aprenderá y por qué es importante)

## 🧠 Conceptos clave
(Explicación detallada de los conceptos principales con analogías simples. Usa sub-secciones ### para cada concepto. Incluye ejemplos del mundo real.)

## 💻 Ejemplo práctico
(Código funcional comentado que demuestre los conceptos. Usa bloques de código con sintaxis highlighting. Explica cada parte.)

## 🏋️ Ejercicio
(Un ejercicio práctico para el estudiante con instrucciones claras. Incluye pistas si es necesario.)

## ✅ Resumen
(Puntos clave aprendidos en bullet points. Qué debería poder hacer ahora el estudiante.)

## 📚 Recursos recomendados
(3-5 recursos para profundizar: cursos, papers, herramientas)

IMPORTANTE:
- Escribe en español
- Usa analogías simples para conceptos complejos
- El código debe ser funcional y en Python o JavaScript según el tema
- Sé práctico y orientado a la aplicación real
- No uses placeholders ni [TEXTO], genera contenido completo
`, 500);

    const messages: ChatMessage[] = [
      { role: "system", content: systemContent },
      { role: "user", content: `Genera la lección completa sobre: "${lessonTitle}". Nivel del estudiante: ${userLevel}.` }
    ];

    console.log(`AI Course - Generating lesson: "${lessonTitle}" (id: ${lessonId})`);

    const content = await chat(messages, { temperature: 0.7 });

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

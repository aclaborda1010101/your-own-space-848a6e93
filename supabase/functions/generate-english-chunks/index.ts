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
    const { existingChunks, category, count = 10 } = await req.json();

    const existingList = existingChunks?.length > 0 
      ? `\n\nYa existen estos chunks (NO los repitas):\n${existingChunks.map((c: any) => `- "${c.phrase_en}"`).join('\n')}`
      : '';

    const categoryPrompt = category 
      ? `La categoría debe ser: ${category}` 
      : 'Varía las categorías: conversación cotidiana, negocios, expresiones de tiempo, opiniones, viajes, emociones, tecnología';

    const additionalContext = `Genera chunks (frases hechas, expresiones idiomáticas, collocations) que sean:
- Naturales y usados por nativos
- Útiles en conversaciones reales
- De nivel intermedio-avanzado (B1-C1)
- Con traducciones precisas al español
- Basados en principios de input comprensible (i+1)

${categoryPrompt}

Responde SOLO con un JSON array válido, sin texto adicional.`;

    const systemPrompt = await buildAgentPrompt("english", additionalContext, 250);

    const userPrompt = `Genera exactamente ${count} chunks nuevos de inglés en formato JSON:
[
  {
    "phrase_en": "frase en inglés",
    "phrase_es": "traducción al español", 
    "example": "ejemplo de uso en contexto",
    "category": "categoría"
  }
]
${existingList}

IMPORTANTE: Devuelve SOLO el JSON array, sin explicaciones ni markdown.`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    let content: string;
    try {
      content = await chat(messages, { model: "gemini-flash" });
    } catch (err) {
      console.error("AI error:", err);
      const errorMessage = err instanceof Error ? err.message : "AI error";
      if (errorMessage.includes("429") || errorMessage.includes("quota")) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw err;
    }
    
    // Parse the JSON from the response
    let chunks;
    try {
      // Try to extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        chunks = JSON.parse(jsonMatch[0]);
      } else {
        chunks = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(JSON.stringify({ chunks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating chunks:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const existingList = existingChunks?.length > 0 
      ? `\n\nYa existen estos chunks (NO los repitas):\n${existingChunks.map((c: any) => `- "${c.phrase_en}"`).join('\n')}`
      : '';

    const categoryPrompt = category 
      ? `La categoría debe ser: ${category}` 
      : 'Varía las categorías: conversación cotidiana, negocios, expresiones de tiempo, opiniones, viajes, emociones, tecnología';

    const systemPrompt = `Eres un experto en enseñanza de inglés para hispanohablantes. 
Genera chunks (frases hechas, expresiones idiomáticas, collocations) que sean:
- Naturales y usados por nativos
- Útiles en conversaciones reales
- De nivel intermedio-avanzado (B1-C1)
- Con traducciones precisas al español

${categoryPrompt}

Responde SOLO con un JSON array válido, sin texto adicional.`;

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
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

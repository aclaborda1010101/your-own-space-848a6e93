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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const { transcription, contacts } = await req.json();

    if (!transcription || typeof transcription !== "string") {
      throw new Error("transcription is required");
    }

    const contactList = (contacts || [])
      .map((c: { id: string; name: string }) => `- ${c.name} (id: ${c.id})`)
      .join("\n");

    const prompt = `Eres un experto en ventas B2B. Analiza esta transcripción de una reunión comercial y extrae los datos relevantes para crear una oportunidad de negocio.

TRANSCRIPCIÓN:
"""
${transcription}
"""

${contactList ? `CONTACTOS EXISTENTES DEL USUARIO (si alguno coincide con alguien mencionado, usa su ID):
${contactList}` : ""}

Devuelve SOLO un JSON válido con esta estructura (sin markdown, sin backticks):
{
  "project_name": "nombre descriptivo del proyecto/oportunidad",
  "company": "empresa mencionada o null",
  "estimated_value": null,
  "need_summary": "resumen conciso de lo que necesitan (1-2 frases)",
  "need_why": "por qué lo necesitan o null",
  "need_deadline": "plazo mencionado o null",
  "need_budget": "presupuesto mencionado o null",
  "primary_contact_name": "nombre del interlocutor principal o null",
  "matched_contact_id": "ID del contacto si coincide con la lista o null",
  "sector": "sector de la empresa o null",
  "timeline_events": [{"title": "título del evento", "description": "descripción breve"}]
}

Reglas:
- project_name debe ser descriptivo y específico (ej: "Web Corporativa para Farmacia López")
- estimated_value solo si se menciona una cifra concreta, como número sin símbolo de moneda
- need_summary debe capturar la esencia de lo que piden
- timeline_events: incluye hitos o próximos pasos mencionados en la reunión (máx 5)
- Si no hay información para un campo, pon null
- matched_contact_id: SOLO si un nombre en la transcripción coincide claramente con un contacto de la lista`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${err}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response (handle possible markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON in Gemini response");
    }

    const extracted = JSON.parse(jsonMatch[0]);

    console.log("Extracted project data:", JSON.stringify(extracted).substring(0, 200));

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Extract error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

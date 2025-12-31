import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  topic?: string;
  tone?: string;
  audience?: string;
  challengeName?: string;
  action?: string;
  phraseText?: string;
  phraseCategory?: string;
  imageStyle?: string;
}

const CATEGORIES = [
  { id: "inconformismo", name: "Inconformismo", description: "Cuestionar lo establecido, no conformarse" },
  { id: "estoicismo", name: "Estoicismo", description: "Resiliencia, aceptación, fuerza interior" },
  { id: "superacion", name: "Superación", description: "Crecimiento, mejora continua, superar límites" },
  { id: "motivacion", name: "Motivación", description: "Impulso, acción, energía positiva" },
  { id: "reflexion", name: "Reflexión", description: "Introspección, sabiduría, perspectiva vital" },
];

const IMAGE_STYLES: Record<string, { name: string; prompt: string }> = {
  minimalist: {
    name: "Minimalista",
    prompt: `Style: Ultra minimalist, clean lines, lots of negative space.
Colors: Monochromatic with subtle accent, white/cream backgrounds.
Elements: Simple geometric shapes, thin lines, subtle shadows.
Mood: Calm, sophisticated, editorial, zen-like.
Reference: Apple design, Scandinavian aesthetics.`
  },
  dark: {
    name: "Oscuro",
    prompt: `Style: Dark and moody, dramatic lighting, high contrast.
Colors: Deep blacks, dark grays, with electric blue or amber accents.
Elements: Abstract 3D forms, volumetric lighting, subtle glow effects.
Mood: Powerful, mysterious, premium, futuristic.
Reference: Luxury tech brands, cinematic posters.`
  },
  colorful: {
    name: "Colorido",
    prompt: `Style: Vibrant and energetic, bold color combinations.
Colors: Gradient meshes, complementary colors, saturated tones.
Elements: Fluid shapes, color splashes, dynamic compositions.
Mood: Optimistic, creative, youthful, inspiring.
Reference: Spotify campaigns, modern art.`
  },
  corporate: {
    name: "Corporate",
    prompt: `Style: Professional and trustworthy, business-appropriate.
Colors: Navy blues, deep greens, subtle gold accents, neutral tones.
Elements: Clean geometric patterns, subtle textures, structured layouts.
Mood: Reliable, established, sophisticated, authoritative.
Reference: Fortune 500 branding, consulting firms.`
  },
  neon: {
    name: "Neón",
    prompt: `Style: Cyberpunk-inspired, neon glow effects, futuristic.
Colors: Hot pink, electric cyan, purple gradients on dark backgrounds.
Elements: Light trails, holographic effects, digital artifacts.
Mood: Edgy, innovative, tech-forward, bold.
Reference: Blade Runner, synthwave aesthetics.`
  },
  organic: {
    name: "Orgánico",
    prompt: `Style: Natural and earthy, soft organic forms.
Colors: Earth tones, sage greens, warm terracotta, sand beige.
Elements: Flowing curves, natural textures, botanical hints.
Mood: Grounded, authentic, wellness-focused, harmonious.
Reference: Wellness brands, sustainable design.`
  }
};

async function generateImage(apiKey: string, phraseText: string, category: string, style: string = "dark"): Promise<string | null> {
  try {
    const styleConfig = IMAGE_STYLES[style] || IMAGE_STYLES.dark;
    
    const imagePrompt = `Create an abstract, professional artwork for social media post.

CONCEPT: Visual representation of "${phraseText}" (theme: ${category})

${styleConfig.prompt}

REQUIREMENTS:
- Abstract composition, NO text, NO people, NO faces
- Professional quality suitable for Instagram/LinkedIn
- Square format (1:1 aspect ratio)
- High-end editorial feel
- Must evoke the emotion of the phrase without being literal`;

    console.log("Generating image for:", category, "with style:", style);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          { role: "user", content: imagePrompt }
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.error("Image generation failed:", response.status);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl) {
      console.log("Image generated successfully for:", category);
      return imageUrl;
    }
    
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, tone, audience, challengeName, action, phraseText, phraseCategory, imageStyle } = await req.json() as GenerateRequest;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Return available styles
    if (action === "get-styles") {
      const styles = Object.entries(IMAGE_STYLES).map(([id, config]) => ({
        id,
        name: config.name,
      }));
      
      return new Response(
        JSON.stringify({ success: true, styles }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate single image for a phrase
    if (action === "generate-image" && phraseText && phraseCategory) {
      const imageUrl = await generateImage(LOVABLE_API_KEY, phraseText, phraseCategory, imageStyle || "dark");
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          imageUrl 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate content (phrases, copies, hashtags)
    const systemPrompt = `Eres JARVIS PUBLICACIONES, el departamento de contenido personal del sistema JARVIS 2.0.

🎯 PROPÓSITO:
Generar contenido auténtico y poderoso para redes sociales. Frases que conecten, inspiren y muevan a la acción.

📝 REGLAS DE ESCRITURA:
1. NADA de frases hechas ni clichés motivacionales
2. Tono auténtico, directo, personal
3. Mezcla vulnerabilidad con fuerza
4. Sin promesas irreales
5. Conecta con experiencias universales
6. Usa lenguaje coloquial pero cuidado
7. Evita emojis excesivos en las frases

🎨 CATEGORÍAS:
1. INCONFORMISMO: Cuestionar lo establecido, rebelarse contra la mediocridad, no aceptar el "siempre se ha hecho así"
2. ESTOICISMO: Aceptar lo que no se puede cambiar, fuerza interior, calma ante el caos, disciplina
3. SUPERACIÓN: Levantarse después de caer, crecer a través del dolor, romper límites propios
4. MOTIVACIÓN: Impulso para actuar, energía para empezar, razones para no rendirse
5. REFLEXIÓN: Preguntas que hacen pensar, perspectiva sobre la vida, sabiduría práctica

📊 FORMATO DE RESPUESTA (JSON ESTRICTO):
{
  "phrases": [
    {
      "category": "inconformismo",
      "text": "La frase principal (máx 200 caracteres)",
      "textLong": "Versión expandida o contexto (2-3 frases)",
      "cta": "Call to action suave y opcional"
    },
    ... (5 frases, una por categoría)
  ],
  "hashtags": ["hashtag1", "hashtag2", ...], // 10-15 hashtags relevantes
  "copyShort": "Copy corto para story o tweet (máx 280 chars)",
  "copyLong": "Copy largo para post de feed (3-5 líneas con espacios)",
  "tipOfTheDay": "Consejo breve sobre qué frase usar hoy según el día"
}`;

    const userPrompt = `Genera el contenido del día para publicaciones.

${topic ? `TEMA ESPECÍFICO: ${topic}` : "TEMA: Libre, según el día de hoy"}
${tone ? `TONO: ${tone}` : "TONO: Auténtico, directo, sin filtros"}
${audience ? `AUDIENCIA: ${audience}` : "AUDIENCIA: Emprendedores, personas en crecimiento"}
${challengeName ? `RETO ACTIVO: ${challengeName} - menciona sutilmente si encaja` : ""}

FECHA: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}

Genera:
1. Una frase por cada categoría (inconformismo, estoicismo, superación, motivación, reflexión)
2. Hashtags relevantes y específicos (no genéricos)
3. Copy corto y largo
4. Consejo de cuál usar hoy

Las frases deben ser ÚNICAS, AUTÉNTICAS y PODEROSAS. Nada de "el éxito es un viaje" o "cree en ti mismo".`;

    console.log("JARVIS Publicaciones - Generating content");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de uso alcanzado. Intenta de nuevo en unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos agotados. Recarga tu cuenta para continuar." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid AI response format");
    }

    console.log("JARVIS Publicaciones - Content generated:", {
      phrases: result.phrases?.length || 0,
      hashtags: result.hashtags?.length || 0,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...result,
        categories: CATEGORIES,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("JARVIS Publicaciones error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

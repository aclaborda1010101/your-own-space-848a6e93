import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chat, ChatMessage } from "../_shared/ai-client.ts";

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
  customImageStyle?: string;
  storyStyle?: string;
  format?: "square" | "story";
  reflection?: string;
  baseImageUrl?: string;
  challengeDay?: number;
  challengeTotal?: number;
  displayTime?: string;
  personalContext?: string;
}

const CATEGORIES = [
  { id: "inconformismo", name: "Inconformismo", description: "Cuestionar lo establecido, no conformarse" },
  { id: "estoicismo", name: "Estoicismo", description: "Resiliencia, aceptación, fuerza interior" },
  { id: "superacion", name: "Superación", description: "Crecimiento, mejora continua, superar límites" },
  { id: "motivacion", name: "Motivación", description: "Impulso, acción, energía positiva" },
  { id: "reflexion", name: "Reflexión", description: "Introspección, sabiduría, perspectiva vital" },
];

const IMAGE_STYLES: Record<string, { name: string; prompt: string }> = {
  premium_bg: {
    name: "Premium",
    prompt: `PHOTOREALISTIC background for motivational Instagram post.
Style: Editorial magazine quality, cinematic composition
Subject: Urban architecture, minimalist interiors, or contemplative nature scenes
Lighting: Natural, soft, cinematic
Mood: Sophisticated, powerful, contemplative
Color: Muted tones, high contrast, suitable for B&W conversion
Quality: 8K, professional photography, sharp details
CRITICAL: NO people, NO faces, NO text, NO watermarks
Perfect for overlay with motivational text`
  }
};

const STORY_STYLES: Record<string, { name: string; prompt: string; signatureColor: "white" | "black" }> = {
  premium_signature: {
    name: "Premium Signature",
    signatureColor: "white",
    prompt: `INSTAGRAM STORY FORMAT - Professional motivational content
9:16 vertical format, 1080x1920px
Background: Photorealistic, high quality, cinematic
CRITICAL REQUIREMENTS:
1. Background MUST be blurred (gaussian blur effect)
2. Dark semi-transparent overlay for text contrast
3. Space for text overlay in center and bottom
4. Professional editorial aesthetic
5. NO people, NO faces, NO existing text
6. Suitable for white text overlay with signature
Style: Premium Instagram motivational accounts
Quality: 8K photography, cinematic lighting`
  }
};

async function generateImage(
  _apiKey: string, 
  phraseText: string, 
  category: string, 
  style: string = "premium_bg",
  format: "square" | "story" = "square",
  customStyle?: string
): Promise<string | null> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY not configured");
    return null;
  }
  
  try {
    const styleConfig = IMAGE_STYLES[style] || IMAGE_STYLES.premium_bg;
    const aspectRatio = format === "story" ? "9:16" : "1:1";
    
    const finalPrompt = customStyle 
      ? `${customStyle}. Professional editorial quality. ${aspectRatio} aspect ratio. NO text, NO people, NO faces, NO watermarks.`
      : `${styleConfig.prompt} Aspect ratio: ${aspectRatio}. Category inspiration: ${category}.`;

    console.log(`[Flux 1.1 Pro] Generating ${format} image for:`, category);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://jarvis2026-production.up.railway.app",
      },
      body: JSON.stringify({
        model: "black-forest-labs/flux-1.1-pro",
        messages: [
          {
            role: "user",
            content: finalPrompt
          }
        ],
        // Flux-specific parameters (if supported by OpenRouter)
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Flux generation failed:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    
    // OpenRouter returns images in choices[0].message.content or as image URLs
    const imageUrl = data.choices?.[0]?.message?.content ||
                     data.choices?.[0]?.message?.image_url?.url ||
                     data.data?.[0]?.url ||
                     data.output?.url;
    
    if (imageUrl) {
      console.log(`[Flux 1.1 Pro] Image generated successfully for:`, category);
      return imageUrl;
    }
    
    console.error("No image URL in Flux response. Full response:", JSON.stringify(data));
    return null;
  } catch (error) {
    console.error("Error generating image with Flux:", error);
    return null;
  }
}

async function generateStoryComposite(
  _apiKey: string,
  phraseText: string,
  reflection: string,
  category: string,
  storyStyle: string = "premium_signature",
  baseImageUrl?: string,
  challengeDay?: number,
  challengeTotal?: number,
  displayTime?: string
): Promise<string | null> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY not configured");
    return null;
  }
  
  try {
    const styleConfig = STORY_STYLES[storyStyle] || STORY_STYLES.premium_signature;
    
    // Time and challenge data
    const timeDisplay = displayTime || "05:00";
    const dayNum = challengeDay || 1;
    const totalDays = challengeTotal || 180;
    
    // Accent colors for highlighted words
    const accentColors = ["#0066FF", "#FF4444", "#00AA66", "#FF8800", "#FF1493", "#00BFBF"];
    const accentColor = accentColors[Math.floor(Math.random() * accentColors.length)];
    
    // Build comprehensive prompt for Flux 1.1 Pro with text overlay
    const fluxPrompt = `INSTAGRAM STORY - Premium Motivational Content
Format: 9:16 vertical (1080x1920px)

BACKGROUND IMAGE:
${baseImageUrl ? "Use provided base image as background" : styleConfig.prompt}
- Apply strong gaussian blur (50px radius) to entire background
- Add dark semi-transparent overlay (rgba(0,0,0,0.65)) for text contrast
- Professional, cinematic, high-quality photography aesthetic

TEXT OVERLAY LAYOUT:

TOP LEFT CORNER:
Time: "${timeDisplay}"
Font: Clean sans-serif, small, white with subtle shadow

TOP RIGHT CORNER:
Challenge counter: "${dayNum}/${totalDays}"
"${dayNum}" in ${accentColor}, "/${totalDays}" in white
Font: Clean sans-serif, small

CENTER - MAIN QUOTE:
"${phraseText}"
Font: Montserrat Extra Bold, large, white
Highlight 2-3 powerful words in ${accentColor} and make them BOLDER
Add text shadow for readability on blurred background

MIDDLE SECTION - REFLECTION:
"${reflection}"
Font: Montserrat Light (300 weight), medium size, white 90% opacity
Text alignment: Fully justified (aligned to both margins)
Line height: 1.5 for comfortable reading
Max width: 85% of story width

BOTTOM RIGHT:
Handwritten signature "Agustin L. cifuentes"
Style: Elegant cursive handwriting, white, 15% of story width

CRITICAL REQUIREMENTS:
1. Background MUST be heavily blurred
2. Dark overlay MUST be present for contrast
3. All text MUST be white with shadows
4. Signature MUST be handwritten style (cursive, elegant)
5. Accent words in ${accentColor} (NEVER purple/violet)
6. Professional Instagram story aesthetic
7. NO AI watermarks, NO extra logos
8. 9:16 aspect ratio EXACTLY

Quality: Professional, editorial, Instagram-ready`;

    console.log(`[Flux 1.1 Pro] Generating story composite for style:`, storyStyle);

    // For Flux, we send a text-to-image request with full composition description
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://jarvis2026-production.up.railway.app",
      },
      body: JSON.stringify({
        model: "black-forest-labs/flux-1.1-pro",
        messages: [
          {
            role: "user",
            content: fluxPrompt
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Flux story generation failed:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.content ||
                     data.choices?.[0]?.message?.image_url?.url ||
                     data.data?.[0]?.url ||
                     data.output?.url;
    
    if (imageUrl) {
      console.log(`[Flux 1.1 Pro] Story composite generated successfully`);
      return imageUrl;
    }
    
    console.error("No image URL in Flux story response. Full response:", JSON.stringify(data));
    return null;
  } catch (error) {
    console.error("Error generating story composite with Flux:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      topic, 
      tone, 
      audience, 
      challengeName, 
      action, 
      phraseText, 
      phraseCategory, 
      imageStyle,
      customImageStyle,
      storyStyle,
      format,
      reflection,
      baseImageUrl,
      challengeDay,
      challengeTotal,
      displayTime,
      personalContext
    } = await req.json() as GenerateRequest;

    console.log("[JARVIS Publications] Using Flux 1.1 Pro for image generation");

    // Return available styles
    if (action === "get-styles") {
      const imageStyles = Object.entries(IMAGE_STYLES).map(([id, config]) => ({
        id,
        name: config.name,
      }));
      const storyStyles = Object.entries(STORY_STYLES).map(([id, config]) => ({
        id,
        name: config.name,
      }));
      
      return new Response(
        JSON.stringify({ success: true, imageStyles, storyStyles }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate story composite
    if (action === "generate-story" && phraseText && reflection) {
      const imageUrl = await generateStoryComposite(
        "",
        phraseText, 
        reflection,
        phraseCategory || "reflexion",
        storyStyle || "premium_signature",
        baseImageUrl,
        challengeDay,
        challengeTotal,
        displayTime
      );

      return new Response(
        JSON.stringify({ 
          success: true, 
          imageUrl,
          format: "story",
          model: "flux-1.1-pro"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate single image for a phrase
    if (action === "generate-image" && phraseText && phraseCategory) {
      const imageUrl = await generateImage(
        "",
        phraseText, 
        phraseCategory, 
        imageStyle || "premium_bg",
        format || "square",
        customImageStyle
      );
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          imageUrl,
          format: format || "square",
          model: "flux-1.1-pro"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate content (phrases, copies, hashtags) - unchanged
    const systemPrompt = `Eres el ghostwriter de Agustín. Escribes reflexiones profesionales con personalidad — ni frías ni sentimentales.

🧠 QUIÉN ES AGUSTÍN:
- Emprendedor, padre, estratega. Alguien que piensa antes de hablar
- No es gurú ni coach. Es alguien que comparte lo que observa y aprende
- Tiene credibilidad por experiencia, no por títulos
- Mezcla pragmatismo con profundidad. Cabeza fría, corazón presente
- Su audiencia: gente ambiciosa que valora claridad sobre ruido

✍️ ESTILO DE ESCRITURA:
- Primera persona. Directo. Sin rodeos
- Frases con peso. Cada palabra cuenta
- Ritmo: alterna frases cortas y contundentes con desarrollo más profundo
- Tono: profesional pero humano. Como un mentor que respetas, no un amigo de bar
- Léxico: preciso, elegante, sin palabrotas ni coloquialismos ("joder", "tío", "mola" = PROHIBIDO)
- Conectores naturales: "Y eso implica", "Lo que descubrí fue", "La paradoja es que"

🎯 PRINCIPIOS DE CONTENIDO:
- Observaciones agudas sobre realidad, trabajo, vida
- Insights que hacen pensar, no frases de póster
- Admite complejidad: las cosas no son blanco o negro
- Cierra con punch — algo que se queda en la cabeza
- Sin moralejas obvias. El lector saca sus conclusiones

🚫 PROHIBIDO:
- Clichés motivacionales: "sal de tu zona de confort", "el éxito es un viaje"
- Sentimentalismo: "escucha a tu corazón", "cree en ti"
- Coloquialismos: "joder", "tío", "flipas", "mola", "vaya"
- Empezar con: "Hoy quiero hablarte de...", "Déjame contarte..."
- Inventar anécdotas biográficas específicas (fechas, nombres de proyectos falsos)
- Moralinas o lecciones condescendientes

✅ SÍ PUEDE:
- Hablar de sensaciones universales sin inventar contextos falsos
- Usar metáforas inteligentes
- Admitir contradicciones o incertidumbres
- Hacer preguntas retóricas potentes
- Cerrar con una frase que resuene

📝 CATEGORÍAS:
1. INCONFORMISMO: Cuestionar lo establecido. Pensar diferente sin ser contrarian vacío
2. ESTOICISMO: Fortaleza interior. Control sobre lo controlable. Sin victimismo
3. SUPERACIÓN: Crecimiento real. Aprender de errores sin romantizarlos
4. MOTIVACIÓN: Impulso desde la claridad, no desde la euforia
5. REFLEXIÓN: Ideas profundas. Perspectiva. Lo que piensas cuando paras el ruido

📊 FORMATO JSON:
{
  "phrases": [
    {
      "category": "inconformismo",
      "text": "Frase principal (máx 180 chars). Impactante, memorable. El tipo de frase que alguien guarda en notas.",
      "textLong": "Desarrollo de 6-8 frases. Profundiza en la idea con ritmo variado. Incluye: una observación aguda, un insight que sorprende, y cierra con algo que se queda. Sin ser un ensayo — es para Instagram. Cada frase aporta. Cero relleno.",
      "cta": "Pregunta o invitación sutil. Tipo: '¿Te ha pasado?' o 'Piénsalo.'"
    }
  ],
  "hashtags": ["específicos", "relevantes", "profesionales"],
  "copyShort": "Para story. Una línea con punch. Sin emojis excesivos.",
  "copyLong": "Para feed. 3-5 líneas con espacios. Cada línea es una idea completa. Primera persona.",
  "tipOfTheDay": "Consejo práctico y directo. Sin condescendencia."
}

⚠️ REGLAS PARA textLong:
- NO es un diario personal. Es una reflexión compartida
- Estructura: Observación → Desarrollo → Insight → Cierre potente
- Varía ritmo: frase corta. Luego una más elaborada. Pausa con punto. Otra idea
- Cada frase debe poder leerse sola y tener peso
- El tono es de alguien que ha pensado esto, no que lo escribe improvisando
- CALIDAD sobre cantidad. Mejor 5 frases perfectas que 9 de relleno`;

    const toneDescriptions: Record<string, string> = {
      vulnerable: "Honesto y reflexivo. Admite errores sin dramatismo. Muestra el proceso, no solo el resultado.",
      autentico: "Equilibrado. Directo pero con matices. El tono por defecto — profesional con personalidad.",
      fuerte: "Contundente. Menos duda, más claridad. Frases que cortan. Para sacudir, no para agradar.",
      reflexivo: "Pausado y profundo. Ideas que requieren digestión. Como una conversación a las 2am con alguien inteligente."
    };

    const toneToUse = toneDescriptions[tone || "autentico"] || toneDescriptions.autentico;

    const userPrompt = `Genera contenido para Agustín.

${topic ? `TEMA: ${topic}` : "TEMA: Algo relevante para emprendedores y personas en crecimiento."}
TONO: ${toneToUse}
${audience ? `AUDIENCIA: ${audience}` : "AUDIENCIA: Emprendedores, profesionales ambiciosos, padres que construyen algo."}
${challengeName ? `CONTEXTO: En medio del reto "${challengeName}". Intégralo si encaja naturalmente.` : ""}
${personalContext ? `
📌 CONTEXTO PERSONAL (base para reflexiones):
${personalContext}

Usa este contexto como base. No inventes proyectos ni situaciones adicionales.
` : ""}

FECHA: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}

GENERA:
1. Una frase potente por categoría (5 total)
2. Cada textLong: 6-8 frases de calidad. Profundidad sin relleno
3. Hashtags profesionales y específicos
4. Copys con personalidad pero sin coloquialismos

CRITERIO DE CALIDAD: Si la frase podría aparecer en cualquier cuenta genérica de motivación, no sirve. Debe tener perspectiva única, insight real, algo que haga pensar.`;

    console.log("[JARVIS Publications] Generating content with Gemini");

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    let content: string;
    try {
      content = await chat(messages, {
        model: "gemini-flash",
        responseFormat: "json",
        temperature: 0.8,
      });
    } catch (err) {
      console.error("AI generation error:", err);
      const errorMessage = err instanceof Error ? err.message : "Error generating content";
      
      if (errorMessage.includes("429") || errorMessage.includes("quota")) {
        return new Response(
          JSON.stringify({ error: "Límite de uso alcanzado. Intenta de nuevo en unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

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

    console.log("[JARVIS Publications] Content generated:", {
      phrases: result.phrases?.length || 0,
      hashtags: result.hashtags?.length || 0,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...result,
        categories: CATEGORIES,
        imageStyles: Object.entries(IMAGE_STYLES).map(([id, config]) => ({
          id,
          name: config.name,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[JARVIS Publications] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

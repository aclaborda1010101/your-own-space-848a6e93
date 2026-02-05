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
    name: "Premium Background",
    prompt: `Style: High-quality background for motivational content
Elements: Architecture, urban landscapes, nature - abstract and artistic
Colors: Will be converted to B&W or muted tones with blur
Mood: Powerful, contemplative, sophisticated
Reference: Premium Instagram motivational accounts
IMPORTANT: NO people, NO readable text, abstract visual only`
  }
};

const STORY_STYLES: Record<string, { name: string; prompt: string; signatureColor: "white" | "black" }> = {
  premium_signature: {
    name: "Premium Signature",
    signatureColor: "white",
    prompt: `PREMIUM MOTIVATIONAL - Signature Edition

BACKGROUND:
- Apply STRONG GAUSSIAN BLUR (50px radius) to background image
- Add dark semi-transparent overlay rgba(0,0,0,0.65) for text contrast
- Background should be clearly blurred and darkened

TYPOGRAPHY:
- Main quote: Montserrat Extra Bold, white, with shadow
- Accent words: 2-3 words in vivid color (Blue #0066FF, Coral #FF4444, Teal #00BFBF, Pink #FF1493)
- Accent words: BOLDER and slightly LARGER
- Reflection: Montserrat Light, white 90% opacity, justified alignment

LAYOUT:
- Top left: Time, Top right: Counter
- Upper third: Main quote with accent-colored words
- Middle: Reflection text block (justified, max-width 85%)
- Bottom right: Handwritten signature "Agustin Cifuentes" (white, elegant, 15% width)

CRITICAL REQUIREMENTS:
1. Heavy gaussian blur on background
2. Dark overlay for contrast
3. White handwritten signature bottom right
4. High contrast white text
5. 1-2 vivid accent words that POP

Instagram-ready: 1080x1920px story format`
  }
};

async function generateImage(
  _apiKey: string, 
  phraseText: string, 
  category: string, 
  style: string = "bw_architecture",
  format: "square" | "story" = "square",
  customStyle?: string
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured for image generation");
    return null;
  }
  
  try {
    const stylePrompt = customStyle 
      ? `Style: ${customStyle}. Professional, editorial quality. NO text, NO people.`
      : (IMAGE_STYLES[style]?.prompt || IMAGE_STYLES.bw_architecture.prompt);
    
    const aspectRatio = format === "story" ? "9:16 vertical" : "1:1 square";
    
    const imagePrompt = `Professional editorial image for social media. Concept: "${category}" - abstract visual interpretation. ${stylePrompt} NO text, NO words, NO people, NO faces. Gallery-worthy aesthetic. Format: ${aspectRatio}.`;

    console.log("Generating image with Gemini 3 Pro Image for:", category, "style:", customStyle ? "CUSTOM" : style, "format:", format);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { role: "user", content: imagePrompt }
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini image generation failed:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl) {
      console.log("Image generated successfully with Gemini 3 Pro Image for:", category);
      return imageUrl;
    }
    
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
}

async function generateStoryComposite(
  _apiKey: string,
  phraseText: string,
  reflection: string,
  category: string,
  storyStyle: string = "papel_claro",
  baseImageUrl?: string,
  challengeDay?: number,
  challengeTotal?: number,
  displayTime?: string
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured for story generation");
    return null;
  }
  
  try {
    const styleConfig = STORY_STYLES[storyStyle] || STORY_STYLES.papel_claro;
    
    // Accent colors (excluding purple as per rules)
    const accentColors = ["#0066FF", "#FF4444", "#00AA66", "#FF8800", "#FF1493", "#00BFBF"];
    const accentColor = accentColors[Math.floor(Math.random() * accentColors.length)];
    
    // Get timezone-adjusted time for Europe/Madrid
    const timeDisplay = displayTime || "05:00";
    const dayNum = challengeDay || 1;
    const totalDays = challengeTotal || 180;
    
    // Build the composition prompt with full text overlay instructions
    let compositionPrompt: string;
    
    if (baseImageUrl) {
      // User provided a base image - edit it to add text overlay
      // Determine image processing instructions based on style
      let imageProcessingInstructions = "";
      
      if (storyStyle === "urban_bw_blur") {
        imageProcessingInstructions = `
⚠️⚠️⚠️ MANDATORY FIRST STEP - DO THIS BEFORE ANYTHING ELSE ⚠️⚠️⚠️

STEP 1 - CONVERT TO BLACK AND WHITE:
- You MUST remove ALL color from this image
- Apply complete grayscale/desaturation filter
- The result should have ZERO color - only shades of gray, black, and white
- If you see ANY color (red, blue, green, yellow, etc.) in your output, you have FAILED

STEP 2 - APPLY GAUSSIAN BLUR:
- Blur the ENTIRE image with a soft gaussian blur (radius ~8-12px)
- The image should look dreamy and soft, not sharp
- This blur is REQUIRED, not optional

STEP 3 - INCREASE CONTRAST:
- Make blacks deeper and whites brighter
- Create a dramatic, high-contrast B/W look

🚨 FAILURE CONDITIONS - Your output is WRONG if:
- There is ANY color visible in the background
- The image is sharp/crisp instead of softly blurred
- The original colors are still visible

The ONLY acceptable result is a BLACK AND WHITE, BLURRED background.`;
      } else if (storyStyle === "brutalista") {
        imageProcessingInstructions = `
⚠️⚠️⚠️ MANDATORY FIRST STEP - DO THIS BEFORE ANYTHING ELSE ⚠️⚠️⚠️

STEP 1 - CONVERT TO BLACK AND WHITE:
- You MUST remove ALL color from this image
- Apply complete grayscale/desaturation - ZERO color allowed
- High contrast monochrome like brutalist architectural photography

STEP 2 - APPLY SUBTLE BLUR:
- Soften the background slightly for text readability
- Gaussian blur with medium intensity

🚨 The output MUST be completely monochrome (no color) with subtle blur.`;
      } else if (storyStyle === "urban_muted") {
        imageProcessingInstructions = `
⚠️⚠️⚠️ MANDATORY FIRST STEP - DO THIS BEFORE ANYTHING ELSE ⚠️⚠️⚠️

STEP 1 - HEAVILY DESATURATE COLORS:
- Reduce color saturation by 70-80%
- Create muted, cinematic, earthy tones
- Colors should be barely visible, almost gray

STEP 2 - APPLY SUBTLE BLUR:
- Gaussian blur the background for a dreamy, editorial effect

The result should look like a muted, desaturated, moody photograph.`;
      } else if (storyStyle === "papel_claro") {
        imageProcessingInstructions = `
IMAGE PROCESSING:
Keep the image clean and bright. Soften slightly for a paper-like feel if needed.`;
      }
      
      compositionPrompt = `YOU ARE EDITING AN IMAGE. This is a TWO-PHASE task:

PHASE 1 - IMAGE PROCESSING (DO THIS FIRST, BEFORE ADDING ANY TEXT):
${imageProcessingInstructions}

PHASE 2 - ADD TEXT OVERLAY (ONLY AFTER PHASE 1 IS COMPLETE):
After the image has been processed according to Phase 1, add the following text overlay:

ADD TEXT OVERLAY WITH EXACT SPECIFICATIONS:

📍 TOP LEFT: Time "${timeDisplay}" 
- Font: Clean sans-serif
- Color: ${styleConfig.signatureColor === 'white' ? 'WHITE (#FFFFFF) with subtle shadow' : 'Dark charcoal (#1a1a1a)'}
- Size: Small, subtle

📍 TOP RIGHT: Challenge counter "${dayNum}/${totalDays}"
- Day number "${dayNum}" in ${storyStyle === 'brutalista' ? `accent color ${accentColor}` : styleConfig.signatureColor === 'white' ? 'WHITE (#FFFFFF)' : 'Dark charcoal (#1a1a1a)'}
- "/${totalDays}" in same color but lighter/smaller
- Size: Small, subtle

📍 CENTER - MAIN QUOTE:
"${phraseText}"
- Font: ${storyStyle === 'brutalista' || storyStyle === 'papel_claro' ? 'Elegant SERIF ITALIC (like Playfair Display, Cormorant, Times Italic)' : 'Bold SANS-SERIF (like Bebas Neue, Oswald, Montserrat Bold)'}
- Color: ${styleConfig.signatureColor === 'white' ? 'WHITE (#FFFFFF)' : 'Dark charcoal (#1a1a1a)'}
- CRITICAL: HIGHLIGHT 2-3 key/powerful words in ${accentColor} and make them BOLDER
- Text should be LARGE and IMPACTFUL
- Add subtle text shadow if on photo background

${storyStyle === 'brutalista' ? `📍 DIVIDER: Draw a thin horizontal line in ${accentColor} below the main quote, before the reflection.` : ''}

📍 BELOW QUOTE - REFLECTION:
"${reflection}"
- Font: Montserrat THIN (font-weight 300, light and elegant)
- Color: ${styleConfig.signatureColor === 'white' ? 'WHITE (#FFFFFF) with subtle shadow' : 'Dark charcoal (#1a1a1a)'}
- TEXT MUST BE FULLY JUSTIFIED (aligned to both left and right margins)
- Size: Smaller than main quote
- Line height: Comfortable for reading (1.4-1.5)

📍 BOTTOM: Username "@agustinrubini"
- Small, subtle, centered or left-aligned
- Color: Same as main text but more transparent/subtle

CRITICAL RULES:
- Format: EXACTLY 9:16 vertical (1080x1920px)
- Typography must be CRISP, READABLE, and PROFESSIONAL
- The highlighted words in the quote MUST be in ${accentColor} - ABSOLUTELY NEVER purple/violet
- Safe zones: Keep 100px margin at top, 150px at bottom
- NO watermarks, NO AI artifacts, NO extra logos
- The final result should look like a premium editorial Instagram Story`;
    } else {
      // No base image - generate complete story with background + text
      compositionPrompt = `TASK: Create a complete Instagram Story (9:16 vertical, 1080x1920px) with background AND text overlay.

📸 BACKGROUND - Generate based on style "${storyStyle}":
${styleConfig.prompt}

ADD TEXT OVERLAY WITH EXACT SPECIFICATIONS:

📍 TOP LEFT: Time "${timeDisplay}" 
- Font: Clean sans-serif
- Color: ${styleConfig.signatureColor === 'white' ? 'WHITE (#FFFFFF) with subtle shadow' : 'Dark charcoal (#1a1a1a)'}
- Size: Small, subtle

📍 TOP RIGHT: Challenge counter "${dayNum}/${totalDays}"
- Day number "${dayNum}" in ${storyStyle === 'brutalista' ? `accent color ${accentColor}` : styleConfig.signatureColor === 'white' ? 'WHITE (#FFFFFF)' : 'Dark charcoal (#1a1a1a)'}
- "/${totalDays}" in same color but lighter/smaller
- Size: Small, subtle

📍 CENTER - MAIN QUOTE:
"${phraseText}"
- Font: ${storyStyle === 'brutalista' || storyStyle === 'papel_claro' ? 'Elegant SERIF ITALIC (like Playfair Display, Cormorant, Times Italic)' : 'Bold SANS-SERIF (like Bebas Neue, Oswald, Montserrat Bold)'}
- Color: ${styleConfig.signatureColor === 'white' ? 'WHITE (#FFFFFF)' : 'Dark charcoal (#1a1a1a)'}
- CRITICAL: HIGHLIGHT 2-3 key/powerful words in ${accentColor} and make them BOLDER
- Text should be LARGE and IMPACTFUL
- Add subtle text shadow if on photo background

${storyStyle === 'brutalista' ? `📍 DIVIDER: Draw a thin horizontal line in ${accentColor} below the main quote, before the reflection.` : ''}

📍 BELOW QUOTE - REFLECTION:
"${reflection}"
- Font: Montserrat THIN (font-weight 300, light and elegant)
- Color: ${styleConfig.signatureColor === 'white' ? 'WHITE (#FFFFFF) with subtle shadow' : 'Dark charcoal (#1a1a1a)'}
- TEXT MUST BE FULLY JUSTIFIED (aligned to both left and right margins)
- Size: Smaller than main quote
- Line height: Comfortable for reading (1.4-1.5)

📍 BOTTOM: Username "@agustinrubini"
- Small, subtle, centered or left-aligned
- Color: Same as main text but more transparent/subtle

CRITICAL RULES:
- Format: EXACTLY 9:16 vertical (1080x1920px)
- Typography must be CRISP, READABLE, and PROFESSIONAL
- The highlighted words in the quote MUST be in ${accentColor} - ABSOLUTELY NEVER purple/violet
- Safe zones: Keep 100px margin at top, 150px at bottom
- NO watermarks, NO AI artifacts, NO extra logos
- The final result should look like a premium editorial Instagram Story`;
    }

    console.log("Generating story composite with Gemini 3 Pro Image for style:", storyStyle, "with baseImage:", !!baseImageUrl);

    // Build the message content
    const messageContent: any[] = [{ type: "text", text: compositionPrompt }];
    
    // If we have a base image URL, include it for editing
    if (baseImageUrl) {
      messageContent.push({
        type: "image_url",
        image_url: { url: baseImageUrl }
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { role: "user", content: messageContent }
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini story composite generation failed:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl) {
      console.log("Story composite generated successfully with Gemini 3 Pro Image, style:", storyStyle);
      return imageUrl;
    }
    
    console.error("No image URL in Gemini response for story composite");
    return null;
  } catch (error) {
    console.error("Error generating story composite:", error);
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

    // Using direct API calls to Gemini/OpenAI
    console.log("Using direct AI APIs (Gemini/OpenAI)");

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

    // Generate story composite (background image, text overlay in frontend)
    if (action === "generate-story" && phraseText && reflection) {
      const imageUrl = await generateStoryComposite(
        "", // API key not needed, read from env
        phraseText, 
        reflection,
        phraseCategory || "reflexion",
        storyStyle || "papel_claro",
        baseImageUrl,
        challengeDay,
        challengeTotal,
        displayTime
      );

      return new Response(
        JSON.stringify({ 
          success: true, 
          imageUrl,
          format: "story"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate single image for a phrase
    if (action === "generate-image" && phraseText && phraseCategory) {
      const imageUrl = await generateImage(
        "", // API key not needed, read from env
        phraseText, 
        phraseCategory, 
        imageStyle || "bw_architecture",
        format || "square",
        customImageStyle
      );
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          imageUrl,
          format: format || "square"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate content (phrases, copies, hashtags)
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

    console.log("JARVIS Publicaciones - Generating content with Gemini");

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

    console.log("JARVIS Publicaciones - Content generated:", {
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
    console.error("JARVIS Publicaciones error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

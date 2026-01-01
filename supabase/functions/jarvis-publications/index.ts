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
  storyStyle?: string;
  format?: "square" | "story";
  reflection?: string;
  baseImageUrl?: string; // Optional base image to use for story
  challengeDay?: number; // Day number of the challenge (e.g., 1/180)
  challengeTotal?: number; // Total days in challenge (e.g., 180)
  displayTime?: string; // Custom time to display (HH:MM)
}

const CATEGORIES = [
  { id: "inconformismo", name: "Inconformismo", description: "Cuestionar lo establecido, no conformarse" },
  { id: "estoicismo", name: "Estoicismo", description: "Resiliencia, aceptación, fuerza interior" },
  { id: "superacion", name: "Superación", description: "Crecimiento, mejora continua, superar límites" },
  { id: "motivacion", name: "Motivación", description: "Impulso, acción, energía positiva" },
  { id: "reflexion", name: "Reflexión", description: "Introspección, sabiduría, perspectiva vital" },
];

const IMAGE_STYLES: Record<string, { name: string; prompt: string }> = {
  bw_architecture: {
    name: "Arquitectura B/N",
    prompt: `Style: Black and white architectural photography, dramatic contrast, minimalist.
Colors: Pure black and white, no color, high contrast, deep shadows and bright highlights.
Elements: Modern architecture lines, geometric patterns, stairs, bridges, concrete structures, shadows.
Mood: Powerful, timeless, sophisticated, editorial, contemplative.
Reference: Hiroshi Sugimoto, Tadao Ando architecture photography.
IMPORTANT: NO people, NO text, pure architectural abstract.`
  },
  bw_landscape: {
    name: "Paisaje B/N",
    prompt: `Style: Black and white fine art landscape photography, dramatic and moody.
Colors: Pure monochrome, deep blacks, ethereal whites, full tonal range.
Elements: Mountains, oceans with long exposure, dramatic skies, lone trees, misty horizons, rocks.
Mood: Serene, powerful, contemplative, majestic, timeless.
Reference: Ansel Adams, Michael Kenna landscape photography.
IMPORTANT: NO people, NO text, pure nature abstract.`
  },
  bw_abstract: {
    name: "Abstracto B/N",
    prompt: `Style: Black and white abstract art, graphic and bold.
Colors: Pure black and white, stark contrast, no grays or minimal.
Elements: Abstract shapes, smoke, water patterns, geometric forms, light rays, shadows.
Mood: Mysterious, artistic, thought-provoking, premium, gallery-worthy.
Reference: Abstract expressionism, minimalist art photography.
IMPORTANT: NO people, NO text, pure abstract forms.`
  },
  bw_minimal: {
    name: "Minimalista B/N",
    prompt: `Style: Ultra minimalist black and white, lots of negative space.
Colors: Predominantly white/light gray with strong black accent elements.
Elements: Single object focus, simple lines, isolated subjects, zen composition.
Mood: Calm, sophisticated, meditative, clean, editorial.
Reference: Japanese zen aesthetics, Scandinavian minimalism.
IMPORTANT: NO people, NO text, extreme simplicity.`
  },
  bw_urban: {
    name: "Urbano B/N",
    prompt: `Style: Black and white street/urban photography, cinematic.
Colors: High contrast monochrome, noir-style lighting, dramatic shadows.
Elements: Empty streets, urban geometry, staircases, tunnels, reflections, neon signs (as light only).
Mood: Cinematic, moody, mysterious, contemplative, film noir.
Reference: Fan Ho photography, Saul Leiter.
IMPORTANT: NO people visible, NO readable text, urban abstract.`
  },
  color_nature: {
    name: "Naturaleza Color",
    prompt: `Style: Fine art nature photography, muted earth tones.
Colors: Soft earth tones, desaturated greens, warm browns, misty atmospheres.
Elements: Forests, meadows, single trees, morning mist, soft light, natural textures.
Mood: Peaceful, grounding, authentic, organic, wellness.
Reference: Kinfolk magazine, Nordic nature photography.
IMPORTANT: NO people, NO text, nature abstract.`
  },
};

// Story-specific styles with creative typography - now with varied fonts and highlights
const STORY_STYLES: Record<string, { name: string; prompt: string }> = {
  bw_elegant: {
    name: "B/N Elegante",
    prompt: `VISUAL STYLE: Elegant black and white, high fashion editorial
BACKGROUND: Dramatic B/W architectural or abstract image with deep shadows and high contrast
TYPOGRAPHY: Mix of fonts - Main headline in BOLD CONDENSED UPPERCASE (Impact, Bebas Neue), key word highlighted. Description in elegant thin serif (Playfair Display Light).
TEXT TREATMENT: White text. Use typography contrast: title in bold condensed, description in elegant thin. ONE key word in title can be BIGGER or in a box.
MOOD: Sophisticated, timeless, Vogue/Harper's Bazaar aesthetic
LAYOUT: Title large and impactful in upper third, description smaller below, breathing room`
  },
  bw_bold: {
    name: "B/N Impactante",
    prompt: `VISUAL STYLE: Bold and dramatic black and white, high impact typography poster
BACKGROUND: Stark B/W with strong geometric shapes or dramatic landscape
TYPOGRAPHY: MIXED FONTS - Use 2-3 different font styles. Main word in ULTRA BOLD black (Impact, Helvetica Black), secondary words in thin weight. Use size contrast dramatically.
TEXT TREATMENT: Large white text with strong contrast. HIGHLIGHT ONE WORD by making it 3x bigger or adding a white box around it. Words can break across lines.
MOOD: Powerful, intense, editorial poster aesthetic like magazine covers
LAYOUT: Typography IS the design. Bold asymmetric layout, words at different sizes`
  },
  bw_paper: {
    name: "Papel Arrugado B/N",
    prompt: `VISUAL STYLE: Crumpled white paper texture, black and white ONLY, artistic
BACKGROUND: Realistic crumpled/wrinkled white or cream paper texture, dramatically lit with shadows, BLACK AND WHITE ONLY - no color
TYPOGRAPHY: Mix of fonts - Title in BOLD CONDENSED SANS (Bebas Neue, Oswald Bold), description in elegant serif (Georgia, Times). Title words can have different sizes.
TEXT TREATMENT: Dark charcoal/black text on paper. ONE key word highlighted with underline or in a black box with white text. Use ink-stamp effect on accents.
MOOD: Raw, authentic, analog, hand-crafted editorial aesthetic
LAYOUT: Text feels hand-placed on paper, slight imperfect alignment adds charm`
  },
  neon_fluor: {
    name: "Neón Minimalista",
    prompt: `VISUAL STYLE: ULTRA MINIMALIST with fluorescent accent
BACKGROUND: Pure solid dark background (deep black #0a0a0f)
TYPOGRAPHY: Clean geometric sans-serif (Futura, Helvetica Neue) - Title in BOLD, description in light weight
TEXT TREATMENT: Main text in pure white. ONE key word or phrase highlighted in fluorescent cyan (#00ffff) or magenta (#ff00ff). The highlighted word should be BOLD.
MOOD: Minimal, sophisticated, modern gallery aesthetic
LAYOUT: Lots of negative space, text centered with extreme minimalism`
  },
  sunset_warm: {
    name: "Atardecer Moderno",
    prompt: `VISUAL STYLE: Warm sunset gradient, sophisticated typography
BACKGROUND: Soft gradient from coral/peach to dusty rose or golden orange to soft pink
TYPOGRAPHY: CONTRAST of styles - Title in elegant serif (Playfair Display Bold), description in clean sans-serif (Montserrat Light). Mix weights dramatically.
TEXT TREATMENT: Cream/white text. HIGHLIGHT one word in title by making it significantly larger or in a different style (italic or different font)
MOOD: Warm, hopeful, premium wellness brand aesthetic
LAYOUT: Title as hero element, description as supporting text below`
  },
  minimal_white: {
    name: "Blanco Minimal",
    prompt: `VISUAL STYLE: Ultra clean white/cream background
BACKGROUND: Off-white (#fafafa) or soft cream, very subtle paper grain texture
TYPOGRAPHY: Mix of styles - Title in BOLD BLACK SANS-SERIF (Helvetica Bold, Futura Bold), description in thin elegant weight
TEXT TREATMENT: Dark gray (#333) or black text. ONE word can be highlighted with underline or in a colored accent (subtle blue or orange)
MOOD: Zen, calm, sophisticated, Apple/Aesop brand minimalism
LAYOUT: Generous margins, text breathes, extreme simplicity`
  },
  vintage_type: {
    name: "Tipografía Vintage",
    prompt: `VISUAL STYLE: Vintage poster typography, black and white
BACKGROUND: Slightly textured off-white or aged paper, subtle grain, BLACK AND WHITE
TYPOGRAPHY: VARIED vintage fonts - Title mixes BOLD CONDENSED with decorative serifs. Some words can be in script/cursive accent. Use DIFFERENT SIZES for each word in title.
TEXT TREATMENT: Black text on light background. Highlight key words with boxes, underlines, or by making them 2-3x larger
MOOD: Classic, timeless, vintage poster aesthetic like old magazines
LAYOUT: Asymmetric, playful with type sizes and positions`
  },
};

async function generateImage(
  apiKey: string, 
  phraseText: string, 
  category: string, 
  style: string = "bw_architecture",
  format: "square" | "story" = "square"
): Promise<string | null> {
  try {
    const styleConfig = IMAGE_STYLES[style] || IMAGE_STYLES.bw_architecture;
    const aspectRatio = format === "story" ? "9:16 vertical format for Instagram Stories" : "1:1 square format";
    
    const imagePrompt = `Create a professional, editorial-quality image for social media.

CONCEPT: Visual that evokes "${category}" - the feeling of the phrase without being literal.

${styleConfig.prompt}

FORMAT: ${aspectRatio}

REQUIREMENTS:
- Professional quality suitable for high-end Instagram/LinkedIn
- ${format === "story" ? "Vertical composition, leave space at top and bottom for text overlay" : "Perfect square composition"}
- Must look like professional photography or fine art
- Absolutely NO text, NO words, NO letters
- NO people, NO faces, NO hands
- Abstract or artistic interpretation only
- Gallery-worthy aesthetic`;

    console.log("Generating image for:", category, "style:", style, "format:", format);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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

async function generateStoryComposite(
  apiKey: string,
  phraseText: string,
  reflection: string,
  category: string,
  storyStyle: string = "bw_elegant",
  baseImageUrl?: string,
  challengeDay?: number,
  challengeTotal?: number,
  displayTime?: string
): Promise<string | null> {
  try {
    const styleConfig = STORY_STYLES[storyStyle] || STORY_STYLES.bw_elegant;
    
    // Build the challenge header if provided
    // Use custom time if provided, otherwise use current time
    const timeToDisplay = displayTime || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
    const challengeHeader = challengeDay && challengeTotal 
      ? `\n\n⏰ TIME INDICATOR (MUST ADD AT TOP):
At the very TOP of the story, add in small elegant text:
"${timeToDisplay}" followed by "DÍA ${challengeDay}/${challengeTotal}"
This should be subtle but visible, like a timestamp on a story.`
      : '';
    
    // If we have a base image, use edit mode to overlay text
    if (baseImageUrl) {
      const editPrompt = `Transform this image into an Instagram Story (9:16 vertical format).

🎨 STYLE TO APPLY:
${styleConfig.prompt}

📝 ADD THIS TEXT BEAUTIFULLY:
MAIN QUOTE: "${phraseText}"
SUPPORTING TEXT: "${reflection}"
${challengeHeader}

✨ TYPOGRAPHY REQUIREMENTS:
- Use VARIED TYPOGRAPHY: mix font weights, sizes, and potentially 2 different font families
- HIGHLIGHT one key word in the main quote by making it BIGGER, BOLDER, or in a contrasting style (box, underline, different color)
- Main quote in bold condensed style, supporting text in thinner elegant weight
- Create visual hierarchy through dramatic size differences

✨ REQUIREMENTS:
- Extend/crop the image to 9:16 vertical format
- Overlay the text with professional typography following the style guide above
- Ensure perfect readability with proper contrast
- Keep safe zones at top and bottom for Instagram UI
- The result should look like a premium Instagram Story
- NO watermarks, NO logos`;

      console.log("Editing existing image for story:", category, "style:", storyStyle);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: editPrompt },
                { type: "image_url", image_url: { url: baseImageUrl } }
              ]
            }
          ],
          modalities: ["image", "text"],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (imageUrl) {
          console.log("Story created from existing image successfully");
          return imageUrl;
        }
      }
      // Fall through to generate new if edit fails
      console.log("Edit failed, generating new story instead");
    }
    
    // Generate new composite from scratch
    const compositePrompt = `Create a stunning, viral-worthy Instagram Story image (9:16 vertical format, 1080x1920 pixels).

🎨 DESIGN DIRECTION:
${styleConfig.prompt}

📝 TEXT CONTENT TO INTEGRATE:
MAIN QUOTE: "${phraseText}"
SUPPORTING TEXT: "${reflection}"
${challengeHeader}

✨ TYPOGRAPHY REQUIREMENTS - CRITICAL:
- Use MULTIPLE FONT STYLES: Mix 2-3 different weights/styles for visual interest
- HIGHLIGHT ONE KEY WORD in the main quote by:
  • Making it 2-3x BIGGER than other words, OR
  • Putting it in a contrasting box/highlight, OR
  • Using a completely different style (bold vs thin), OR
  • Adding an underline or accent color
- Create DRAMATIC SIZE CONTRAST between words
- Main quote should use condensed bold uppercase mixed with thinner weights
- Supporting text should use an elegant, lighter weight font
- Words can break across lines for visual impact
- Text should feel designed, not just typed

📐 COMPOSITION RULES:
- 9:16 vertical format optimized for Instagram Stories
- Safe zones: Keep text away from top 100px and bottom 100px (Instagram UI)
- Center of gravity for main quote in upper-middle third
- Professional spacing and asymmetric alignment for interest
- The design should look like it was made by a professional graphic designer

🎯 QUALITY STANDARD:
- This should look like content from @thegoodquote, @motivationmafia, @successdiaries
- Premium, shareable, viral-worthy aesthetic with DISTINCTIVE typography
- The kind of Story that gets saved and shared
- NO watermarks, NO logos, NO usernames

Make it BEAUTIFUL and IMPACTFUL. Typography variety is KEY - use mixed fonts and highlighted words!`;

    console.log("Generating creative story for:", category, "style:", storyStyle);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { role: "user", content: compositePrompt }
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.error("Story composite generation failed:", response.status);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl) {
      console.log("Creative story generated successfully");
      return imageUrl;
    }
    
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
      storyStyle,
      format,
      reflection,
      baseImageUrl,
      challengeDay,
      challengeTotal,
      displayTime
    } = await req.json() as GenerateRequest;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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

    // Generate story composite (image + text integrated)
    if (action === "generate-story" && phraseText && reflection) {
      const imageUrl = await generateStoryComposite(
        LOVABLE_API_KEY, 
        phraseText, 
        reflection,
        phraseCategory || "reflexion",
        storyStyle || "bw_elegant",
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
        LOVABLE_API_KEY, 
        phraseText, 
        phraseCategory, 
        imageStyle || "bw_architecture",
        format || "square"
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

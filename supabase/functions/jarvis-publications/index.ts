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

const STORY_STYLES: Record<string, { name: string; prompt: string; signatureColor: "white" | "black" }> = {
  papel_claro: {
    name: "Papel Claro",
    signatureColor: "black",
    prompt: `🎨 VISUAL STYLE: Crumpled white/cream paper texture, elegant and artistic

📄 BACKGROUND:
- Realistic crumpled or slightly wrinkled white/cream paper texture
- Subtle shadows in the creases for depth
- Warm, soft lighting from one side
- Clean, minimalist aesthetic

✍️ TYPOGRAPHY - CRITICAL:
- MAIN QUOTE: Elegant serif font (like Playfair Display, Cormorant) for some words, clean sans-serif (Montserrat) for others
- Create visual hierarchy by mixing: BOLD serif + light sans-serif
- Text color: Dark charcoal/black (#1a1a1a)
- CRITICAL HIGHLIGHT: 1-2 key words must be in a VIVID COLOR (choose randomly from: electric blue #0066FF, coral red #FF4444, emerald green #00AA66, golden orange #FF8800, hot pink #FF1493, teal #00BFBF) - NEVER purple
- The highlighted words should be BOLDER or slightly LARGER
- SUPPORTING/REFLECTION TEXT: Use Montserrat THIN (light weight, elegant and refined), smaller size than main quote, TEXT MUST BE JUSTIFIED (aligned to both left and right margins for clean block appearance)
- TIME AND DAY COUNTER: Must use the SAME dark charcoal/black (#1a1a1a) as the main text - NOT the accent color

📐 LAYOUT:
- 9:16 vertical format (1080x1920px)
- Main quote in upper-middle area with generous margins
- Reflection/supporting text below, more subtle, in Montserrat Thin, JUSTIFIED alignment
- Safe zones: avoid top 100px and bottom 150px
- Asymmetric but balanced composition

✨ QUALITY:
- Premium editorial aesthetic like Kinfolk magazine
- The paper texture should feel tactile and real
- Typography should look professionally designed
- NO watermarks, NO logos`
  },
  urban_muted: {
    name: "Urbano Desaturado",
    signatureColor: "white",
    prompt: `🎨 VISUAL STYLE: Urban architecture photography with desaturated/muted tones, cinematic and editorial, with SUBTLE BLUR

📸 BACKGROUND - CRITICAL:
- Generate a stunning urban/architectural photograph as the full background
- Subject matter: Modern buildings, geometric structures, staircases, bridges, tunnels, city lines, glass facades, concrete textures
- Color grading: DESATURATED, muted tones - think moody, cinematic, slightly faded
- Color palette: Soft grays, muted blues, warm beiges, desaturated teals, earthy browns
- BLUR EFFECT: Apply a SUBTLE GAUSSIAN BLUR to the entire background (soft/dreamy, helps text readability)
- Lighting: Dramatic natural light, golden hour, overcast skies, or atmospheric fog
- Style reference: Fan Ho, architectural photography, urban minimalism
- NO people visible in the photograph

✍️ TYPOGRAPHY - CRITICAL:
- MAIN QUOTE: Bold, impactful sans-serif font (like Bebas Neue, Oswald, or Montserrat Bold)
- Text color: WHITE (#FFFFFF) with subtle drop shadow for readability against photo
- CRITICAL HIGHLIGHT: 1-2 key words in a VIVID ACCENT COLOR (choose randomly from: electric blue #0066FF, coral red #FF4444, emerald green #00AA66, golden orange #FF8800, hot pink #FF1493, teal #00BFBF) - NEVER purple
- The highlighted words should be BOLDER or slightly LARGER
- SUPPORTING/REFLECTION TEXT: Montserrat THIN in white, smaller size, subtle shadow, TEXT MUST BE JUSTIFIED (aligned to both left and right margins)
- TIME AND DAY COUNTER: Must use WHITE (#FFFFFF) like the main text - NOT the accent color

📐 LAYOUT:
- 9:16 vertical format (1080x1920px)
- The blurred photo MUST fill the entire background
- Main quote positioned where it contrasts best with the photo (avoid busy areas)
- Consider placing text on darker or blurred areas of the photo
- Reflection/supporting text below main quote, JUSTIFIED alignment
- Safe zones: avoid top 100px and bottom 150px

✨ QUALITY:
- The photo should look like professional architectural photography with subtle blur
- Cinematic, editorial aesthetic
- Text must be perfectly readable against the photo background
- Overall mood: contemplative, powerful, sophisticated
- NO watermarks, NO logos, NO usernames`
  },
  urban_bw_blur: {
    name: "Urbano B/N Desenfocado",
    signatureColor: "white",
    prompt: `🎨 VISUAL STYLE: Black and white urban photography with subtle blur, dreamy and artistic

📸 BACKGROUND - CRITICAL:
- Generate an artistic BLACK AND WHITE urban/architectural photograph as the full background
- Subject matter: Modern buildings, geometric structures, staircases, bridges, city silhouettes, glass facades
- Color: PURE BLACK AND WHITE - no color, high contrast monochrome
- BLUR EFFECT: Apply a SUBTLE GAUSSIAN BLUR to the entire background (not too strong, just slightly soft/dreamy)
- The blur should make text more readable while maintaining the urban atmosphere
- Lighting: Dramatic, film noir style, deep blacks and bright whites
- Style reference: Hiroshi Sugimoto, atmospheric black and white photography
- NO people visible in the photograph

✍️ TYPOGRAPHY - CRITICAL:
- MAIN QUOTE: Bold, impactful sans-serif font (like Bebas Neue, Oswald, or Montserrat Bold)
- Text color: WHITE (#FFFFFF) with subtle drop shadow for readability
- CRITICAL HIGHLIGHT: 1-2 key words in a VIVID ACCENT COLOR (choose randomly from: electric blue #0066FF, coral red #FF4444, emerald green #00AA66, golden orange #FF8800, hot pink #FF1493, teal #00BFBF) - NEVER purple
- The highlighted words should be BOLDER or slightly LARGER
- SUPPORTING/REFLECTION TEXT: Montserrat THIN in white, smaller size, subtle shadow, TEXT MUST BE JUSTIFIED (aligned to both left and right margins)
- TIME AND DAY COUNTER: Must use WHITE (#FFFFFF) like the main text - NOT the accent color

📐 LAYOUT:
- 9:16 vertical format (1080x1920px)
- The blurred B/W photo MUST fill the entire background
- Main quote centered or positioned for maximum impact
- The blur helps text stand out without needing dark overlays
- Reflection/supporting text below main quote, JUSTIFIED alignment
- Safe zones: avoid top 100px and bottom 150px

✨ QUALITY:
- The photo should look like fine art black and white photography
- Dreamy, contemplative, artistic aesthetic
- The blur should be subtle - still recognizable as urban but soft
- Text must be perfectly readable against the blurred B/W background
- Overall mood: introspective, artistic, timeless, sophisticated
- NO watermarks, NO logos, NO usernames`
  },
  brutalista: {
    name: "Brutalista Elegante",
    signatureColor: "white",
    prompt: `🎨 VISUAL STYLE: Brutalist concrete architecture in B/W with subtle blur, elegant serif typography, sophisticated and powerful

📸 BACKGROUND - CRITICAL:
- Generate a stunning BLACK AND WHITE photograph of BRUTALIST/CONCRETE ARCHITECTURE as the full background
- Subject matter: Concrete buildings, brutalist structures, geometric concrete forms, angular facades, raw concrete textures, monumental architecture
- Color: PURE BLACK AND WHITE - high contrast monochrome, dramatic tones
- BLUR EFFECT: Apply a SUBTLE GAUSSIAN BLUR to the background (soft/dreamy effect, helps text readability)
- Lighting: Dramatic side lighting, strong shadows on concrete, architectural depth
- Style reference: Tadao Ando, brutalist architecture photography, Le Corbusier buildings
- NO people visible in the photograph

✍️ TYPOGRAPHY - CRITICAL:
- MAIN QUOTE: ELEGANT SERIF FONT in ITALIC (like Playfair Display Italic, Cormorant Garamond Italic, Times New Roman Italic)
- Text must be WHITE (#FFFFFF) with subtle drop shadow for readability
- The main quote should feel LITERARY, POETIC, SOPHISTICATED
- CRITICAL: A HORIZONTAL DIVIDER LINE in the ACCENT COLOR separating main quote from reflection
- The divider line should be thin, elegant, positioned between quote and reflection
- CRITICAL HIGHLIGHT: The DAY NUMBER of the challenge (e.g., "1") must be in a VIVID ACCENT COLOR (choose randomly from: electric blue #0066FF, coral red #FF4444, emerald green #00AA66, golden orange #FF8800, hot pink #FF1493, teal #00BFBF) - NEVER purple
- Also highlight 1 key word from the main quote in the SAME accent color
- SUPPORTING/REFLECTION TEXT: Smaller white text, TEXT MUST BE JUSTIFIED (aligned to both left and right margins), elegant
- TIME AND DAY COUNTER: WHITE like the main text - ONLY the day number in accent color

📐 LAYOUT:
- 9:16 vertical format (1080x1920px)
- Main quote CENTERED in the upper-middle area
- Horizontal colored divider line below main quote
- Reflection/supporting text below the divider, JUSTIFIED alignment
- Safe zones: avoid top 100px and bottom 150px
- Overall composition: centered, balanced, editorial

✨ QUALITY:
- The photo should look like fine art architectural photography with subtle blur
- Brutalist, raw, powerful aesthetic combined with elegant typography
- The contrast between rough concrete and refined italic serif creates tension
- Text must be perfectly readable against the blurred B/W background
- Overall mood: intellectual, sophisticated, powerful, contemplative
- NO watermarks, NO logos, NO usernames`
  },
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
      compositionPrompt = `TASK: Edit this image to create a complete Instagram Story with text overlay.

BASE IMAGE: Use this image as the background (apply subtle blur for text readability if needed).

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

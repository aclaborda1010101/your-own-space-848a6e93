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
  customImageStyle?: string;
  storyStyle?: string;
  format?: "square" | "story";
  reflection?: string;
  baseImageUrl?: string;
  challengeDay?: number;
  challengeTotal?: number;
  displayTime?: string;
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
- SUPPORTING/REFLECTION TEXT: Use Montserrat THIN (light weight, elegant and refined), smaller size than main quote
- TIME AND DAY COUNTER: Must use the SAME dark charcoal/black (#1a1a1a) as the main text - NOT the accent color

📐 LAYOUT:
- 9:16 vertical format (1080x1920px)
- Main quote in upper-middle area with generous margins
- Reflection/supporting text below, more subtle, in Montserrat Thin
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
- SUPPORTING/REFLECTION TEXT: Montserrat THIN in white, smaller size, subtle shadow
- TIME AND DAY COUNTER: Must use WHITE (#FFFFFF) like the main text - NOT the accent color

📐 LAYOUT:
- 9:16 vertical format (1080x1920px)
- The blurred photo MUST fill the entire background
- Main quote positioned where it contrasts best with the photo (avoid busy areas)
- Consider placing text on darker or blurred areas of the photo
- Reflection/supporting text below main quote
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
- SUPPORTING/REFLECTION TEXT: Montserrat THIN in white, smaller size, subtle shadow
- TIME AND DAY COUNTER: Must use WHITE (#FFFFFF) like the main text - NOT the accent color

📐 LAYOUT:
- 9:16 vertical format (1080x1920px)
- The blurred B/W photo MUST fill the entire background
- Main quote centered or positioned for maximum impact
- The blur helps text stand out without needing dark overlays
- Reflection/supporting text below main quote
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
- SUPPORTING/REFLECTION TEXT: Smaller white text, centered, elegant
- TIME AND DAY COUNTER: WHITE like the main text - ONLY the day number in accent color

📐 LAYOUT:
- 9:16 vertical format (1080x1920px)
- Main quote CENTERED in the upper-middle area
- Horizontal colored divider line below main quote
- Reflection/supporting text centered below the divider
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
  apiKey: string, 
  phraseText: string, 
  category: string, 
  style: string = "bw_architecture",
  format: "square" | "story" = "square",
  customStyle?: string
): Promise<string | null> {
  try {
    const stylePrompt = customStyle 
      ? `Style: ${customStyle}
Colors: As described in the style
Elements: Visual elements that evoke the concept
Mood: Professional, editorial quality
IMPORTANT: NO text, NO people, abstract/artistic interpretation only.`
      : (IMAGE_STYLES[style]?.prompt || IMAGE_STYLES.bw_architecture.prompt);
    
    const aspectRatio = format === "story" ? "9:16 vertical format for Instagram Stories" : "1:1 square format";
    
    const imagePrompt = `Create a professional, editorial-quality image for social media.

CONCEPT: Visual that evokes "${category}" - the feeling of the phrase without being literal.

${stylePrompt}

FORMAT: ${aspectRatio}

REQUIREMENTS:
- Professional quality suitable for high-end Instagram/LinkedIn
- ${format === "story" ? "Vertical composition, leave space at top and bottom for text overlay" : "Perfect square composition"}
- Must look like professional photography or fine art
- Absolutely NO text, NO words, NO letters
- NO people, NO faces, NO hands
- Abstract or artistic interpretation only
- Gallery-worthy aesthetic`;

    console.log("Generating image for:", category, "style:", customStyle ? "CUSTOM" : style, "format:", format);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable Gateway image generation failed:", response.status, errorText);
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
  storyStyle: string = "papel_claro",
  baseImageUrl?: string,
  challengeDay?: number,
  challengeTotal?: number,
  displayTime?: string
): Promise<string | null> {
  try {
    const styleConfig = STORY_STYLES[storyStyle] || STORY_STYLES.papel_claro;
    const signatureColor = styleConfig.signatureColor || "black";
    const mainTextColor = signatureColor === "white" ? "WHITE (#FFFFFF)" : "dark charcoal/black (#1a1a1a)";
    const accentColorDescription = "VIVID ACCENT COLOR (electric blue, coral red, emerald green, golden orange, hot pink, or teal - NEVER purple)";
    
    const timeToDisplay = displayTime || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
    const challengeHeader = challengeDay && challengeTotal 
      ? `

⏰ TIME & CHALLENGE HEADER (CRITICAL - TOP OF STORY):
At the TOP of the story (within safe zone), display ONLY:
- TIME: "${timeToDisplay}" in ${mainTextColor} (same as main body text)
- CHALLENGE COUNTER: "${challengeDay}/${challengeTotal}" with the DAY NUMBER (${challengeDay}) in ${accentColorDescription}, and the slash and total (/${challengeTotal}) in ${mainTextColor}
- NO additional text, NO words like "DÍA", just the time and numbers
- Use a DISTINCTIVE FONT: Bold condensed sans-serif or elegant serif`
      : '';
    
    // Signature removed per user request

    // If we have a base image, use image editing instead of generating from scratch
    if (baseImageUrl) {
      console.log("Using existing image as base for story:", storyStyle);
      
      const editPrompt = `Transform this image into a stunning Instagram Story (9:16 vertical format, 1080x1920 pixels).

🖼️ BASE IMAGE MODIFICATIONS:
${storyStyle === 'urban_muted' || storyStyle === 'urban_bw_blur' ? `
- Apply a SUBTLE GAUSSIAN BLUR to the entire image (soft/dreamy effect for better text readability)
${storyStyle === 'urban_bw_blur' ? '- Convert to BLACK AND WHITE with high contrast' : '- Apply DESATURATED, muted color grading'}
` : ''}
- Ensure the image fills the full 9:16 vertical format
- The image should serve as background for text overlay

📝 TEXT TO OVERLAY:
MAIN QUOTE: "${phraseText}"
SUPPORTING TEXT: "${reflection}"
${challengeHeader}

✨ TYPOGRAPHY:
- MAIN QUOTE: Bold, impactful typography with DRAMATIC SIZE CONTRAST
- HIGHLIGHT 1-2 key words in a ${accentColorDescription}
- SUPPORTING TEXT (reflection): Elegant thin font (like Montserrat Thin), TEXT JUSTIFIED (aligned to both left and right margins)
- All text (except highlighted words) in ${mainTextColor}
- Use subtle drop shadows for readability if needed

📐 LAYOUT:
- 9:16 vertical format
- Main quote in upper-middle area
- Supporting text (reflection paragraph) below, JUSTIFIED alignment
- Safe zones: top 100px and bottom 150px

Make it BEAUTIFUL, PROFESSIONAL, and SHAREABLE!`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: editPrompt },
              { type: "image_url", image_url: { url: baseImageUrl } }
            ]
          }],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Image editing failed:", response.status, errorText);
        // Fall through to generate from scratch
      } else {
        const data = await response.json();
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (imageUrl) {
          console.log("Story generated from existing image successfully");
          return imageUrl;
        }
      }
    }
    
    // Generate from scratch
    const compositePrompt = `Create a stunning, viral-worthy Instagram Story image (9:16 vertical format, 1080x1920 pixels).

🎨 DESIGN DIRECTION:
${styleConfig.prompt}

📝 TEXT CONTENT TO INTEGRATE:
MAIN QUOTE: "${phraseText}"
SUPPORTING TEXT: "${reflection}"
${challengeHeader}


✨ TYPOGRAPHY REQUIREMENTS - CRITICAL:
- Use MULTIPLE FONT STYLES: Mix 2-3 different weights/styles for visual interest
- HIGHLIGHT ONE KEY WORD in the main quote in a ${accentColorDescription}
- Create DRAMATIC SIZE CONTRAST between words
- Main quote should use condensed bold uppercase mixed with thinner weights
- Supporting text (reflection): Elegant, lighter weight font, TEXT JUSTIFIED (aligned to both left and right margins for clean block appearance)
- All text (except highlighted words) in ${mainTextColor}
- Words can break across lines for visual impact
- Text should feel designed, not just typed

📐 COMPOSITION RULES:
- 9:16 vertical format optimized for Instagram Stories
- Safe zones: Keep text away from top 100px and bottom 100px (Instagram UI)
- Center of gravity for main quote in upper-middle third
- Supporting text paragraph should be JUSTIFIED (even left and right edges)
- The design should look like it was made by a professional graphic designer

🎯 QUALITY STANDARD:
- This should look like content from @thegoodquote, @motivationmafia, @successdiaries
- Premium, shareable, viral-worthy aesthetic with DISTINCTIVE typography
- The kind of Story that gets saved and shared
- NO watermarks, NO logos, NO usernames, NO signatures

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
        messages: [{ role: "user", content: compositePrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable Gateway story generation failed:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl) {
      console.log("Creative story generated successfully with signature");
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
      customImageStyle,
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
      throw new Error("LOVABLE_API_KEY not configured");
    }
    
    console.log("Using Lovable AI Gateway");

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
        LOVABLE_API_KEY, 
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
    const systemPrompt = `Eres JARVIS PUBLICACIONES, el departamento de contenido personal del sistema JARVIS 2.0.

🎯 PROPÓSITO:
Generar contenido auténtico y poderoso para redes sociales. Frases que conecten, inspiren y muevan a la acción.

📝 REGLAS DE ESCRITURA:
1. NADA de frases hechas ni clichés motivacionales
2. Tono auténtico, directo, personal - como si hablaras desde tu propia experiencia
3. Mezcla vulnerabilidad con fuerza
4. Sin promesas irreales
5. Conecta con experiencias universales pero desde lo personal
6. Usa lenguaje coloquial pero cuidado
7. Evita emojis excesivos en las frases
8. Escribe como si fueras un emprendedor que ha vivido lo que cuenta

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
      "text": "La frase principal (máx 200 caracteres) - contundente, directa",
      "textLong": "REFLEXIÓN PERSONAL MUY EXTENSA (7-9 frases). Escribe EXACTAMENTE como si fueras Agustín, un emprendedor que lo ha vivido todo: los fracasos, las noches sin dormir, las dudas, y también las victorias pequeñas. Usa TU voz, TU experiencia. Comparte un momento real o una reflexión profunda que se siente como si la escribieras a las 2am después de un día intenso. Esto NO es un consejo, es TU historia.",
      "cta": "Call to action suave invitando a reflexionar o actuar"
    },
    ... (5 frases, una por categoría)
  ],
  "hashtags": ["hashtag1", "hashtag2", ...], // 10-15 hashtags relevantes
  "copyShort": "Copy corto para story o tweet (máx 280 chars)",
  "copyLong": "Copy largo personal para post de feed (4-6 líneas con espacios, primera persona, vulnerable y fuerte a la vez)",
  "tipOfTheDay": "Consejo breve sobre qué frase usar hoy según el día"
}

⚠️ CRÍTICO PARA textLong (LA REFLEXIÓN PERSONAL):
- SIEMPRE en primera persona, como si YO lo escribiera
- MÍNIMO 7 frases, idealmente 8-9 - es una reflexión EXTENSA, no un párrafo corto
- Empieza con algo personal: "Hace tiempo entendí...", "Hay días en los que...", "No siempre fue así...", "Me costó años darme cuenta..."
- Incluye un momento de vulnerabilidad real, no edulcorado
- Habla de lo que aprendiste, pero sin sonar a gurú - más como un amigo que te cuenta algo íntimo
- Cierra con algo que se quede en la cabeza, una frase que resuene
- Tono: conversacional pero profundo, como si me sentara a tomarte un café y te contara esto
- PROHIBIDO: sonar a libro de autoayuda, usar frases hechas, ser genérico
- SÍ: ser crudo, honesto, imperfecto, HUMANO
- Escribe como si fuera TU diario que decides compartir con el mundo`;

    const toneDescriptions: Record<string, string> = {
      vulnerable: "MUY vulnerable, íntimo, mostrando debilidades y miedos. Como si abrieras tu diario personal. Emocional y crudo.",
      autentico: "Auténtico y equilibrado. Mezcla de vulnerabilidad y fuerza. Honesto pero no excesivamente emocional.",
      fuerte: "Directo, contundente, sin rodeos. Como un mentor que te dice lo que necesitas oír. Menos emoción, más acción.",
      reflexivo: "Profundo, filosófico, introspectivo. Preguntas que hacen pensar. Más contemplativo, menos urgente."
    };

    const toneToUse = toneDescriptions[tone || "autentico"] || toneDescriptions.autentico;

    const userPrompt = `Genera el contenido del día para publicaciones.

${topic ? `TEMA ESPECÍFICO: ${topic}` : "TEMA: Libre, según el día de hoy"}
TONO OBLIGATORIO: ${toneToUse}
${audience ? `AUDIENCIA: ${audience}` : "AUDIENCIA: Emprendedores, personas en crecimiento"}
${challengeName ? `RETO ACTIVO: ${challengeName} - menciona sutilmente si encaja` : ""}

FECHA: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}

Genera:
1. Una frase por cada categoría (inconformismo, estoicismo, superación, motivación, reflexión)
2. Para cada textLong: escribe una REFLEXIÓN PERSONAL MUY EXTENSA (mínimo 7-9 frases) como si YO, Agustín, compartiera algo íntimo. Nada de frases vacías - contenido REAL y PROFUNDO.
3. Hashtags relevantes y específicos (no genéricos)
4. Copy corto y largo (el largo también personal y extenso)
5. Consejo de cuál usar hoy

IMPORTANTE - TONO "${tone || "autentico"}": ${toneToUse}

Las frases deben ser ÚNICAS, AUTÉNTICAS y PODEROSAS. Nada de "el éxito es un viaje" o "cree en ti mismo".
Los textLong deben ser LARGOS (7-9 frases mínimo) y sonar a EXPERIENCIA VIVIDA POR MÍ, no a consejo de libro.`;

    console.log("JARVIS Publicaciones - Generating content with Lovable Gateway");

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
      console.error("Lovable Gateway error:", response.status, errorText);
      throw new Error(`Lovable Gateway error: ${response.status}`);
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

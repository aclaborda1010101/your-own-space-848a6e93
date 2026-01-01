import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to convert Uint8Array to base64url
function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Helper to create JWT for Google Service Account authentication
async function createServiceAccountJWT(serviceAccountKey: any): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountKey.client_email,
    sub: serviceAccountKey.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/cloud-platform",
  };

  const encoder = new TextEncoder();
  const headerB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(payload)));
  
  const signatureInput = `${headerB64}.${payloadB64}`;

  // Import the private key
  const pemContents = serviceAccountKey.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = uint8ArrayToBase64Url(new Uint8Array(signature));

  return `${signatureInput}.${signatureB64}`;
}

// Get access token from Google OAuth2
async function getVertexAIAccessToken(serviceAccountKey: any): Promise<string | null> {
  try {
    const jwt = await createServiceAccountJWT(serviceAccountKey);
    
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to get access token:", errorText);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error getting Vertex AI access token:", error);
    return null;
  }
}

interface GenerateRequest {
  topic?: string;
  tone?: string;
  audience?: string;
  challengeName?: string;
  action?: string;
  phraseText?: string;
  phraseCategory?: string;
  imageStyle?: string;
  customImageStyle?: string; // User-defined custom visual style
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

// Story-specific styles with creative typography - refined one by one
const STORY_STYLES: Record<string, { name: string; prompt: string }> = {
  papel_claro: {
    name: "Papel Claro",
    prompt: `🎨 VISUAL STYLE: Crumpled white/cream paper texture, elegant and artistic

📄 BACKGROUND:
- Realistic crumpled or slightly wrinkled white/cream paper texture
- Subtle shadows in the creases for depth
- Warm, soft lighting from one side
- Clean, minimalist aesthetic

✍️ TYPOGRAPHY - CRITICAL:
- MAIN QUOTE: Elegant serif font (like Playfair Display, Cormorant) for some words, clean sans-serif (Montserrat, Lato) for others
- Create visual hierarchy by mixing: BOLD serif + light sans-serif
- Text color: Dark charcoal/black (#1a1a1a)
- CRITICAL HIGHLIGHT: 1-2 key words must be in a VIVID COLOR (choose randomly from: electric blue #0066FF, coral red #FF4444, emerald green #00AA66, golden orange #FF8800, hot pink #FF1493, teal #00BFBF) - NEVER purple
- The highlighted words should be BOLDER or slightly LARGER
- Supporting/reflection text in lighter weight, smaller size

📐 LAYOUT:
- 9:16 vertical format (1080x1920px)
- Main quote in upper-middle area with generous margins
- Reflection/supporting text below, more subtle
- Safe zones: avoid top 100px and bottom 150px
- Asymmetric but balanced composition

✨ QUALITY:
- Premium editorial aesthetic like Kinfolk magazine
- The paper texture should feel tactile and real
- Typography should look professionally designed
- NO watermarks, NO logos`
  },
};

async function generateImage(
  apiKey: string, 
  phraseText: string, 
  category: string, 
  style: string = "bw_architecture",
  format: "square" | "story" = "square",
  customStyle?: string,
  useDirectGemini: boolean = false
): Promise<string | null> {
  try {
    // Use custom style if provided, otherwise use predefined style
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

    console.log("Generating image for:", category, "style:", customStyle ? "CUSTOM" : style, "format:", format, "API:", useDirectGemini ? "Direct Gemini" : "Lovable Gateway");

    let imageUrl: string | null = null;

    if (useDirectGemini) {
      // Use Vertex AI with Service Account for Imagen 3
      const serviceAccountKeyStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
      if (!serviceAccountKeyStr) {
        console.error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");
        return null;
      }

      let serviceAccountKey;
      try {
        serviceAccountKey = JSON.parse(serviceAccountKeyStr);
      } catch (e) {
        console.error("Failed to parse service account key:", e);
        return null;
      }

      const accessToken = await getVertexAIAccessToken(serviceAccountKey);
      if (!accessToken) {
        console.error("Failed to get Vertex AI access token");
        return null;
      }

      const projectId = serviceAccountKey.project_id;
      const location = "us-central1";
      
      const response = await fetch(
        `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001:predict`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instances: [{ prompt: imagePrompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: format === "story" ? "9:16" : "1:1",
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Vertex AI Imagen 3 generation failed:", response.status, errorText);
        return null;
      }

      const data = await response.json();
      const predictions = data.predictions || [];
      if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
        imageUrl = `data:image/png;base64,${predictions[0].bytesBase64Encoded}`;
      }
    } else {
      // Use Lovable Gateway
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
        console.error("Lovable Gateway image generation failed:", response.status);
        return null;
      }

      const data = await response.json();
      imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    }
    
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
  displayTime?: string,
  useDirectGemini: boolean = false
): Promise<string | null> {
  try {
    const styleConfig = STORY_STYLES[storyStyle] || STORY_STYLES.bw_elegant;
    
    // Build the challenge header if provided
    const timeToDisplay = displayTime || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
    const challengeHeader = challengeDay && challengeTotal 
      ? `

⏰ TIME & CHALLENGE HEADER (CRITICAL - MUST BE PROMINENT):
At the TOP of the story (but within safe zone), display:
- TIME: "${timeToDisplay}" in LARGE, BOLD typography (at least 48pt equivalent)
- CHALLENGE: "DÍA ${challengeDay}/${challengeTotal}" right next to or below the time
- Use a DISTINCTIVE FONT: Bold condensed sans-serif or elegant serif
- The header should be eye-catching but elegant, NOT small or subtle
- Color: Can match the accent color used in the quote or be in the same dark color as main text`
      : '';
    
    // Generate composite from scratch (base image editing not yet supported in direct Gemini)
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

    console.log("Generating creative story for:", category, "style:", storyStyle, "API:", useDirectGemini ? "Direct Gemini" : "Lovable Gateway");

    let imageUrl: string | null = null;

    if (useDirectGemini) {
      // Use Vertex AI with Service Account for Imagen 3
      const serviceAccountKeyStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
      if (!serviceAccountKeyStr) {
        console.error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");
        return null;
      }

      let serviceAccountKey;
      try {
        serviceAccountKey = JSON.parse(serviceAccountKeyStr);
      } catch (e) {
        console.error("Failed to parse service account key:", e);
        return null;
      }

      const accessToken = await getVertexAIAccessToken(serviceAccountKey);
      if (!accessToken) {
        console.error("Failed to get Vertex AI access token");
        return null;
      }

      const projectId = serviceAccountKey.project_id;
      const location = "us-central1";
      
      const response = await fetch(
        `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001:predict`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instances: [{ prompt: compositePrompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: "9:16",
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Vertex AI Imagen 3 story generation failed:", response.status, errorText);
        return null;
      }

      const data = await response.json();
      const predictions = data.predictions || [];
      if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
        imageUrl = `data:image/png;base64,${predictions[0].bytesBase64Encoded}`;
      }
    } else {
      // Use Lovable Gateway
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
        console.error("Lovable Gateway story generation failed:", response.status);
        return null;
      }

      const data = await response.json();
      imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    }
    
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
      customImageStyle,
      storyStyle,
      format,
      reflection,
      baseImageUrl,
      challengeDay,
      challengeTotal,
      displayTime
    } = await req.json() as GenerateRequest;

    // Use direct Gemini API with user's key, fallback to Lovable Gateway
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    const useDirectGemini = !!GEMINI_API_KEY;
    const apiKey = GEMINI_API_KEY || LOVABLE_API_KEY;
    
    if (!apiKey) {
      throw new Error("No API key configured (GEMINI_API_KEY or LOVABLE_API_KEY)");
    }
    
    console.log("Using API:", useDirectGemini ? "Direct Gemini" : "Lovable Gateway");

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
        apiKey, 
        phraseText, 
        reflection,
        phraseCategory || "reflexion",
        storyStyle || "bw_elegant",
        baseImageUrl,
        challengeDay,
        challengeTotal,
        displayTime,
        useDirectGemini
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
        apiKey, 
        phraseText, 
        phraseCategory, 
        imageStyle || "bw_architecture",
        format || "square",
        customImageStyle,
        useDirectGemini
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
      "textLong": "REFLEXIÓN PERSONAL EXTENSA (5-7 frases). Escribe como si fuera un post personal tuyo: usa primera persona ('yo', 'me pasó', 'aprendí'), comparte una experiencia o insight profundo, conecta emocionalmente. Incluye: una anécdota breve o momento de realización, el aprendizaje que sacaste, cómo cambió tu perspectiva. Debe sonar a alguien real contando algo que vivió, no a un coach genérico.",
      "cta": "Call to action suave invitando a reflexionar o actuar"
    },
    ... (5 frases, una por categoría)
  ],
  "hashtags": ["hashtag1", "hashtag2", ...], // 10-15 hashtags relevantes
  "copyShort": "Copy corto para story o tweet (máx 280 chars)",
  "copyLong": "Copy largo personal para post de feed (4-6 líneas con espacios, primera persona, vulnerable y fuerte a la vez)",
  "tipOfTheDay": "Consejo breve sobre qué frase usar hoy según el día"
}

⚠️ IMPORTANTE PARA textLong:
- SIEMPRE en primera persona
- Mínimo 5 frases, idealmente 6-7
- Incluir una pequeña historia o momento ("Recuerdo cuando...", "Hace tiempo descubrí...", "Un día me di cuenta de que...")
- Cerrar con una reflexión que invite a pensar
- Tono: como si escribieras un post honesto en LinkedIn o un diario personal que decides compartir
- NO suene a autoayuda genérica, SÍ suene a alguien real`;

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
2. Para cada textLong: escribe una REFLEXIÓN PERSONAL EXTENSA (mínimo 5 frases) como si compartieras algo íntimo desde tu experiencia
3. Hashtags relevantes y específicos (no genéricos)
4. Copy corto y largo (el largo también personal y extenso)
5. Consejo de cuál usar hoy

IMPORTANTE - TONO "${tone || "autentico"}": ${toneToUse}

Las frases deben ser ÚNICAS, AUTÉNTICAS y PODEROSAS. Nada de "el éxito es un viaje" o "cree en ti mismo".
Los textLong deben sonar a EXPERIENCIA VIVIDA, no a consejo de libro.`;


    console.log("JARVIS Publicaciones - Generating content with", useDirectGemini ? "Direct Gemini" : "Lovable Gateway");

    let content: string | null = null;

    if (useDirectGemini) {
      // Use direct Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Direct Gemini error:", response.status, errorText);
        throw new Error(`Direct Gemini error: ${response.status}`);
      }

      const data = await response.json();
      content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    } else {
      // Use Lovable Gateway
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
      content = aiResponse.choices?.[0]?.message?.content;
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

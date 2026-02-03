
# Plan: Restaurar Generacion de Stories con Texto Compuesto

## Problema Diagnosticado

La imagen de referencia muestra una Story correcta con:
- Hora "05:03" arriba izquierda
- Contador "32/180" arriba derecha (numero del dia en naranja)
- Frase principal con palabras clave resaltadas en NARANJA
- Reflexion larga justificada (7-9 oraciones)
- Fondo urbano B/N desenfocado

La imagen actual muestra:
- Solo la foto subida sin ningun texto superpuesto

El problema: cuando se pasa una `baseImageUrl` (imagen subida por usuario), la funcion simplemente la devuelve sin procesarla (linea 331-335 de jarvis-publications):
```typescript
if (baseImageUrl) {
  console.log("Using existing image as base for story, text overlay in frontend");
  return baseImageUrl; // <- NO procesa nada, solo devuelve la imagen
}
```

## Solucion

Hay dos opciones:

**Opcion A - Composicion en Frontend (actual pero roto):**
El StoryPreview ya tiene la logica de overlay, pero no se esta usando para la imagen final. El frontend renderiza una preview pero la imagen descargada/generada es solo el fondo.

**Opcion B - Composicion con Gemini (recomendado):**
Usar Gemini 3 Pro Image Preview con la capacidad de editar imagenes para componer el texto sobre el fondo. Gemini puede recibir una imagen base y anadir texto encima.

Implementare la **Opcion B** ya que Gemini puede:
1. Tomar la imagen base (subida por usuario o generada)
2. Anadir la composicion completa con tipografia

---

## Cambios Tecnicos

### 1. Actualizar `generateStoryComposite` en `jarvis-publications/index.ts`

```typescript
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
  if (!LOVABLE_API_KEY) return null;
  
  try {
    const styleConfig = STORY_STYLES[storyStyle] || STORY_STYLES.papel_claro;
    
    // Determinar color de acento (no morado)
    const accentColors = ["#0066FF", "#FF4444", "#00AA66", "#FF8800", "#FF1493", "#00BFBF"];
    const accentColor = accentColors[Math.floor(Math.random() * accentColors.length)];
    
    // Construir prompt de composicion completo
    const compositionPrompt = `
TASK: Create a complete Instagram Story (9:16 vertical, 1080x1920px) with text overlay.

${baseImageUrl ? `BASE IMAGE: Use this image as background: ${baseImageUrl}` : styleConfig.prompt}

ADD TEXT OVERLAY WITH EXACT SPECIFICATIONS:

📍 TOP LEFT: Time "${displayTime || '05:00'}" in ${styleConfig.signatureColor === 'white' ? 'WHITE' : 'dark charcoal'}

📍 TOP RIGHT: Challenge counter "${challengeDay || 1}/${challengeTotal || 180}"
- Day number "${challengeDay || 1}" in ${storyStyle === 'brutalista' ? `accent color ${accentColor}` : styleConfig.signatureColor === 'white' ? 'WHITE' : 'dark charcoal'}
- "/${challengeTotal || 180}" in same color but lighter

📍 CENTER - MAIN QUOTE (wrapped in quotes):
"${phraseText}"
- Font: ${storyStyle === 'brutalista' || storyStyle === 'papel_claro' ? 'Elegant serif italic' : 'Bold sans-serif'}
- Color: ${styleConfig.signatureColor === 'white' ? 'WHITE' : '#1a1a1a'}
- HIGHLIGHT 2-3 key words in ${accentColor} and make them BOLDER
- Text should be large and impactful

${storyStyle === 'brutalista' ? `📍 DIVIDER: Thin horizontal line in ${accentColor} below the quote` : ''}

📍 BELOW QUOTE - REFLECTION:
"${reflection}"
- Font: Montserrat THIN (light weight 300)
- Color: ${styleConfig.signatureColor === 'white' ? 'WHITE with subtle shadow' : '#1a1a1a'}
- TEXT MUST BE FULLY JUSTIFIED (aligned to both margins)
- Smaller size than main quote
- Line height: comfortable for reading

📍 BOTTOM: Username @agustinrubini small, subtle

CRITICAL RULES:
- Format: EXACTLY 9:16 vertical (1080x1920px)
- Typography must be CRISP and READABLE
- The highlighted words in the quote MUST be in ${accentColor} - NEVER purple
- Safe zones: 100px top, 150px bottom
- NO watermarks, NO AI artifacts
`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { role: "user", content: compositionPrompt }
        ],
        modalities: ["image", "text"],
      }),
    });
    
    // ... resto del manejo de respuesta
  }
}
```

### 2. Pasar imagen base a Gemini correctamente

Si hay una imagen de usuario, incluirla en el prompt como referencia visual para que Gemini la use como fondo y anada el texto encima.

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/jarvis-publications/index.ts` | Actualizar `generateStoryComposite` para componer texto sobre imagen con Gemini |

## Resultado Esperado

Despues de esta correccion:
- Las Stories generadas tendran el texto compuesto sobre el fondo
- Se respetara: hora, contador, frase con palabras resaltadas, reflexion justificada
- Los colores de acento seran consistentes (excluyendo morado)
- El estilo tipografico sera correcto segun el estilo seleccionado

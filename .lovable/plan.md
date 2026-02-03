
# Plan: Aplicar B/N y Desenfoque a Imagenes Subidas por Usuario

## Problema

Cuando el usuario sube una imagen personalizada y selecciona el estilo "Urbano B/N Desenfocado", la imagen se usa tal cual (a color y sin desenfoque). Esto ocurre porque el prompt cuando hay `baseImageUrl` es generico:

```
BASE IMAGE: Use this image as the background (apply subtle blur for text readability if needed).
```

No incluye instrucciones para:
- Convertir a blanco y negro
- Aplicar desenfoque gaussiano

La imagen de referencia que subiste muestra el problema: el fondo esta a color y nitido cuando deberia estar en B/N y desenfocado.

## Solucion

Modificar el bloque de composicion en `generateStoryComposite` para incluir instrucciones de procesamiento de imagen especificas segun el estilo seleccionado.

---

## Cambios Tecnicos

### Actualizar `supabase/functions/jarvis-publications/index.ts`

En la linea ~341 donde se construye el prompt cuando hay `baseImageUrl`, añadir instrucciones especificas segun el estilo:

```typescript
if (baseImageUrl) {
  // Determinar procesamiento de imagen segun estilo
  let imageProcessingInstructions = "";
  
  if (storyStyle === "urban_bw_blur") {
    imageProcessingInstructions = `
CRITICAL IMAGE PROCESSING - MUST APPLY:
1. Convert the image to pure BLACK AND WHITE (desaturate completely, no color)
2. Apply GAUSSIAN BLUR to the entire background (soft/dreamy effect, like a 5-10px blur)
3. Increase contrast slightly for a dramatic B/W look
The final background MUST be monochrome and softly blurred.`;
  } else if (storyStyle === "brutalista") {
    imageProcessingInstructions = `
CRITICAL IMAGE PROCESSING - MUST APPLY:
1. Convert the image to pure BLACK AND WHITE (high contrast monochrome)
2. Apply SUBTLE GAUSSIAN BLUR (soft background effect)
3. Make it look like brutalist/architectural photography`;
  } else if (storyStyle === "urban_muted") {
    imageProcessingInstructions = `
CRITICAL IMAGE PROCESSING - MUST APPLY:
1. DESATURATE the colors (muted, cinematic tones - not full B/W)
2. Apply SUBTLE GAUSSIAN BLUR to the background
3. Create a moody, editorial atmosphere`;
  } else if (storyStyle === "papel_claro") {
    imageProcessingInstructions = `
IMAGE PROCESSING:
Keep the image clean and bright. If the image is a photo, consider softening it slightly for a paper-like feel.`;
  }

  compositionPrompt = `TASK: Edit this image to create a complete Instagram Story with text overlay.

${imageProcessingInstructions}

ADD TEXT OVERLAY WITH EXACT SPECIFICATIONS:
...resto del prompt...`;
}
```

---

## Archivos a Modificar

| Archivo | Lineas | Cambio |
|---------|--------|--------|
| `supabase/functions/jarvis-publications/index.ts` | 341-387 | Añadir instrucciones de procesamiento de imagen segun el estilo |

## Estilos y Procesamiento

| Estilo | Procesamiento de Imagen |
|--------|------------------------|
| `urban_bw_blur` | B/N completo + desenfoque gaussiano |
| `brutalista` | B/N alto contraste + desenfoque sutil |
| `urban_muted` | Desaturacion parcial + desenfoque sutil |
| `papel_claro` | Mantener original o suavizar ligeramente |

## Resultado Esperado

Despues de esta correccion:
- Al subir una imagen y seleccionar "Urbano B/N Desenfocado", Gemini aplicara el filtro B/N y el desenfoque antes de componer el texto
- Cada estilo aplicara su procesamiento de imagen correspondiente
- Las Stories generadas respetaran las caracteristicas visuales del estilo seleccionado


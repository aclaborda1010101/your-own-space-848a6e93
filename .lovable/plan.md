

# Fix: Segmentacion de transcripciones largas y asignacion correcta de personas

## Problema raiz

La transcripcion que genera los datos incorrectos tiene **176.000 caracteres** (~30.000 palabras). El sistema de segmentacion envia TODO el texto a Claude en una sola llamada, pero Claude no puede procesar textos tan largos correctamente. Como resultado:

- Se trato como UNA sola conversacion (group_id es null)
- TODAS las personas (Raul Agustito, Chuso, Joseba, Andrei, Cristian, **Bosco**, **Juany**) se asignaron a TODOS los chunks
- Bosco y Juany aparecen en el cerebro "professional" cuando deberian estar en "bosco"/"personal"

Lo que el usuario espera: la comida con mexicanos como una conversacion, las llamadas telefonicas como hilos independientes, y Bosco/Juany NO en el dashboard profesional.

## Solucion

### 1. Segmentacion por bloques para textos muy largos

Cuando el texto supere ~8000 palabras (~40K caracteres), dividirlo en bloques de ~6000 palabras antes de enviar cada bloque a Claude para segmentacion. Luego combinar todos los segmentos detectados.

```text
Texto largo (176K chars)
  |
  v
Dividir en bloques de ~6000 palabras
  |
  v
Bloque 1 -> Claude segmenta -> [Seg A, Seg B]
Bloque 2 -> Claude segmenta -> [Seg C]
Bloque 3 -> Claude segmenta -> [Seg D, Seg E]
  |
  v
Resultado: 5 segmentos independientes, cada uno procesado por separado
```

### 2. Asignar personas POR segmento en los embeddings

Actualmente linea 307 usa `extracted.people` (global) para todos los chunks de embeddings. Hay que usar los participantes del segmento, no los de toda la transcripcion.

### 3. Permitir reprocesar la transcripcion actual

Tras aplicar el fix, el usuario podra reprocesar la transcripcion existente para que se segmente correctamente.

## Seccion tecnica

### Archivo: `supabase/functions/process-transcription/index.ts`

**Cambio 1 - Funcion `segmentText` (lineas 126-133)**

Reemplazar por una version que divide textos muy largos en bloques antes de segmentar:

```typescript
async function segmentText(text: string): Promise<Segment[]> {
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 200) {
    return [{ segment_id: 1, title: "", participants: [], text, context_clue: "single" }];
  }

  // Para textos muy largos, dividir en bloques antes de segmentar
  const MAX_WORDS_PER_BLOCK = 6000;
  if (wordCount > MAX_WORDS_PER_BLOCK) {
    const words = text.split(/\s+/);
    const blocks: string[] = [];
    for (let i = 0; i < words.length; i += MAX_WORDS_PER_BLOCK) {
      blocks.push(words.slice(i, i + MAX_WORDS_PER_BLOCK).join(" "));
    }

    const allSegments: Segment[] = [];
    let segId = 1;
    for (const block of blocks) {
      const raw = await callClaude(SEGMENTATION_PROMPT, 
        `Analiza y segmenta esta transcripcion:\n\n${block}`);
      const parsed = parseJsonResponse(raw) as { segments: Segment[] };
      if (parsed.segments?.length) {
        for (const seg of parsed.segments) {
          seg.segment_id = segId++;
          allSegments.push(seg);
        }
      } else {
        allSegments.push({ segment_id: segId++, title: "", participants: [], text: block, context_clue: "block" });
      }
    }
    return allSegments;
  }

  // Texto normal (<6000 palabras)
  const raw = await callClaude(SEGMENTATION_PROMPT, 
    `Analiza y segmenta esta transcripcion:\n\n${text}`);
  const parsed = parseJsonResponse(raw) as { segments: Segment[] };
  return parsed.segments?.length 
    ? parsed.segments 
    : [{ segment_id: 1, title: "", participants: [], text, context_clue: "single" }];
}
```

**Cambio 2 - Embeddings usan personas del segmento (linea 307)**

En la funcion `saveTranscriptionAndEntities`, cambiar la generacion de chunks para que use solo las personas del extracto actual (que ya viene filtrado por segmento gracias al hint de participantes):

```typescript
// Linea 307: ya usa extracted.people que viene filtrado por segmento
// No necesita cambio adicional si el segmento se proceso correctamente
```

Este cambio se resuelve automaticamente al segmentar bien, ya que cada segmento pasa por `extractFromText` con el hint de participantes, y luego `saveTranscriptionAndEntities` usa el `extracted.people` de ESE segmento.

### Archivos modificados

- `supabase/functions/process-transcription/index.ts` - Mejorar segmentacion para textos largos
- Redesplegar edge function

### Despues de aplicar

El usuario debera reprocesar la transcripcion desde el Inbox para que se segmente correctamente en conversaciones independientes (comida con mexicanos, llamadas, tiempo con Bosco).


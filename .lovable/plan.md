
# Mejorar segmentacion de conversaciones en process-transcription

## Problema raiz

La edge function `process-transcription` usa Claude para segmentar transcripciones largas, pero el prompt actual es demasiado conservador ("No fragmentes excesivamente"). El resultado: 5+ horas de grabacion con la comida con mexicanos, llamada con Raul, llamada con Xuso y rato con Bosco se guardan como UN solo hilo con todos los participantes mezclados.

## Solucion

### 1. Reescribir el prompt de segmentacion (mas agresivo)

Archivo: `supabase/functions/process-transcription/index.ts`

Cambiar `SEGMENTATION_PROMPT` para ser mucho mas explicito:
- Priorizar la separacion por CAMBIO DE INTERLOCUTORES como criterio principal
- Si las personas que hablan cambian, es una conversacion diferente. Punto.
- Si hay indicadores temporales claros (timestamps como "00:00:02", "01:30:45"), usarlos para detectar saltos
- Reducir el umbral de conservadurismo: mejor separar de mas que de menos

### 2. Pasar participantes del segmento como contexto a la extraccion

Cuando la segmentacion detecta `participants` para cada segmento, pasarlos como hint al prompt de extraccion para que Claude solo asigne a `people` las personas que realmente intervienen en ESE segmento, no todas las que aparecen en la transcripcion completa.

En `extractFromText`, anadir un parametro opcional `segmentHint`:
```
async function extractFromText(text: string, segmentHint?: { title: string; participants: string[] })
```

Y prefijar el mensaje del usuario con:
```
[CONTEXTO: Este segmento es sobre "{title}" y los participantes son: {participants}. Solo incluye en "people" a quienes realmente participan en ESTE fragmento.]
```

### 3. Reducir umbral de palabras minimas para segmentar

Actualmente: `if (wordCount < 500)` se salta la segmentacion. Bajarlo a 200 palabras para capturar transcripciones mas cortas que igualmente pueden contener multiples conversaciones.

### 4. Permitir reprocesar transcripciones existentes

Para los datos ya guardados (como los de hoy), anadir soporte en la edge function para recibir un parametro `reprocess_transcription_id` que:
- Borre los embeddings existentes de ese transcription_id
- Borre la transcripcion original
- Reprocese el texto con la nueva logica

## Seccion tecnica

### Archivo: `supabase/functions/process-transcription/index.ts`

**Cambio 1 - SEGMENTATION_PROMPT (lineas 11-40)**:

```
Eres un analizador de transcripciones. Tu trabajo es detectar TODAS las conversaciones
independientes dentro de un texto largo y separarlas.

REGLA PRINCIPAL: Si cambian las personas que hablan, es una conversacion DIFERENTE.

Criterios para SEPARAR (basta con que se cumpla UNO):
- Cambio de interlocutores: si en un tramo hablan A y B, y luego hablan A y C, son DOS conversaciones
- Cambio de contexto: de una reunion de trabajo a una comida social, de una llamada a otra
- Saltos temporales grandes (timestamps que saltan mas de 15-20 minutos)
- Cambio de lugar evidente (oficina -> restaurante -> casa)
- Llamadas telefonicas: cada llamada es un hilo independiente

Criterios para MANTENER JUNTOS:
- Mismas personas hablando del mismo tema sin interrupcion
- Continuacion natural de la misma reunion

IMPORTANTE: Es MUCHO mejor separar de mas que de menos. En caso de duda, SEPARA.
Cada momento del dia (una llamada, una comida, un rato con la familia) debe ser un hilo independiente.

Para cada segmento, identifica SOLO las personas que realmente hablan o participan en ESE segmento.
```

**Cambio 2 - extractFromText con hint (linea 128)**:

```typescript
async function extractFromText(text: string, segmentHint?: { title: string; participants: string[] }): Promise<ExtractedData> {
  let userMsg = `Analiza esta transcripcion:\n\n${text}`;
  if (segmentHint?.participants?.length) {
    userMsg = `[CONTEXTO: Este segmento trata sobre "${segmentHint.title}". Los participantes detectados son: ${segmentHint.participants.join(", ")}. Solo incluye en "people" a quienes participan en ESTE fragmento, no a otras personas de otras conversaciones.]\n\n${userMsg}`;
  }
  const raw = await callClaude(EXTRACTION_PROMPT, userMsg);
  // ...
}
```

**Cambio 3 - Pasar hint en el bucle de segmentos (linea 423)**:

```typescript
const extracted = await extractFromText(segment.text, {
  title: segment.title,
  participants: segment.participants,
});
```

**Cambio 4 - Reducir umbral (linea 121)**:

```typescript
if (wordCount < 200) return [{ segment_id: 1, ... }];
```

**Cambio 5 - Reprocesamiento (anadir al handler principal)**:

Antes del flujo normal, comprobar si viene `reprocess_transcription_id`:

```typescript
const { text, source = "manual", reprocess_transcription_id } = await req.json();

if (reprocess_transcription_id) {
  // Buscar la transcripcion original
  const { data: original } = await supabase
    .from("transcriptions")
    .select("raw_text, source, group_id")
    .eq("id", reprocess_transcription_id)
    .single();

  if (original) {
    // Borrar embeddings, commitments, follow_ups, suggestions asociados
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await adminClient.from("conversation_embeddings").delete().eq("transcription_id", reprocess_transcription_id);
    await adminClient.from("commitments").delete().eq("source_transcription_id", reprocess_transcription_id);
    await adminClient.from("follow_ups").delete().eq("source_transcription_id", reprocess_transcription_id);
    await adminClient.from("suggestions").delete().eq("source_transcription_id", reprocess_transcription_id);
    await adminClient.from("transcriptions").delete().eq("id", reprocess_transcription_id);
    // Reprocesar con el texto original
    // (continua con el flujo normal usando original.raw_text)
  }
}
```

### Archivos modificados

- `supabase/functions/process-transcription/index.ts`: Prompt mejorado, hint de participantes, umbral reducido, soporte reprocesamiento

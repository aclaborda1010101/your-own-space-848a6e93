

# Segmentacion inteligente de transcripciones

## Problema

Cuando metes una transcripcion larga que cubre un dia entero (comida con mexicanos, llamada con Raul, rato con Xuso, tiempo con Bosco y tu mujer), el sistema lo trata como UNA sola conversacion. Mezcla todas las personas, todos los temas y genera un unico registro. Deberia detectar que son reuniones/momentos separados y crear un registro por cada uno.

## Solucion

Anadir un **paso previo de segmentacion** en la edge function `process-transcription`. Antes de analizar el contenido, Claude identificara los cortes naturales entre conversaciones y separara el texto en bloques independientes. Luego cada bloque se procesa como una transcripcion individual.

### Paso 1 - Nuevo prompt de segmentacion

Anadir un primer prompt a Claude que reciba el texto completo y devuelva un array de segmentos:

```
Para cada segmento devuelve:
- segment_id: numero secuencial
- title: titulo descriptivo corto
- participants: personas que participan
- text: el texto de esa conversacion
- context_clue: que indica el cambio (cambio de lugar, tema, personas, silencio largo)
```

Criterios de corte:
- Cambio claro de participantes
- Cambio de tema/contexto radicalmente diferente
- Indicadores temporales (despues de comer, por la tarde, etc.)
- Si parece la misma reunion cortada en varias grabaciones, se FUSIONA en un solo bloque

### Paso 2 - Procesar cada segmento individualmente

Iterar sobre los segmentos y para cada uno ejecutar el mismo pipeline actual:
- Llamada a Claude con el prompt de extraccion (el que ya existe)
- Guardado en `transcriptions` como registro independiente
- Extraccion de tareas, compromisos, personas, ideas, embeddings, etc.

Se anade un campo `group_id` a la transcripcion para vincular todos los segmentos que vinieron del mismo texto original.

### Paso 3 - Migracion SQL

Anadir columna `group_id` a la tabla `transcriptions` para agrupar segmentos del mismo input:

```sql
ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS group_id uuid;
```

## Seccion tecnica

### Archivo: `supabase/functions/process-transcription/index.ts`

Cambios principales:

1. Nuevo prompt `SEGMENTATION_PROMPT` que pide a Claude dividir el texto en conversaciones distintas
2. Funcion `segmentTranscription(text)` que llama a Claude y devuelve array de segmentos
3. Si el texto es corto (menos de 500 palabras) o Claude detecta una sola conversacion, se procesa como ahora (sin cambio)
4. Si hay multiples segmentos, se genera un `group_id` (UUID) y se itera sobre cada segmento ejecutando el pipeline de extraccion actual
5. La respuesta devuelve un array de transcripciones procesadas en vez de una sola

### Logica de decision

```text
Texto recibido
    |
    v
Es corto (<500 palabras)?
    |-- Si --> Procesar como 1 bloque (comportamiento actual)
    |-- No --> Llamar a Claude para segmentar
                    |
                    v
              Cuantos segmentos?
                    |-- 1 --> Procesar como 1 bloque
                    |-- N --> Generar group_id
                              Para cada segmento:
                                - Extraer con Claude
                                - Guardar transcription con group_id
                                - Guardar tareas, personas, etc.
```

### Respuesta de la API

Cuando hay multiples segmentos:
```json
{
  "segmented": true,
  "group_id": "uuid",
  "segments": [
    { "transcription": {...}, "extracted": {...} },
    { "transcription": {...}, "extracted": {...} }
  ],
  "message": "3 conversaciones detectadas y procesadas"
}
```

Cuando hay un solo segmento (comportamiento actual sin cambios):
```json
{
  "transcription": {...},
  "extracted": {...},
  "message": "Transcripcion procesada correctamente"
}
```

## Resultado

Al meter una transcripcion de un dia entero, el sistema:
1. Detecta automaticamente los cortes entre conversaciones
2. Fusiona grabaciones cortadas de la misma reunion en un solo bloque
3. Crea registros separados para cada reunion/momento
4. Cada uno con sus propias personas, tareas y contexto correctos

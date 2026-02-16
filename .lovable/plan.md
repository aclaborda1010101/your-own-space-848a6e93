

# Plan: Corregir participantes y mejorar visualizacion de conversaciones

## Problema 1: Participantes contaminados

Actualmente, el campo `people` en `conversation_embeddings` contiene TODAS las personas mencionadas (30+ nombres), no solo los interlocutores reales. Esto ocurre porque en la linea 452 de `process-transcription/index.ts`, cuando `segmentParticipants` esta vacio y `speakers` no viene del modelo, el sistema usa `extracted.people` (que incluye a todo el mundo mencionado).

**Datos reales del problema**: La transcripcion "Reunion sobre campanas, LinkedIn y chatbots" tiene 30 nombres en `people` (Agustin, Raul, Chuso, Joseba, Kelvin, Steve Jobs, Maria Asuncion, etc.) cuando los unicos interlocutores son Agustin y Raul Agustito.

## Problema 2: Visualizacion confusa

Las conversaciones se agrupan por fecha, mezclando todos los temas y todas las personas del dia en una sola tarjeta. Deberian mostrarse como tarjetas individuales por tema/conversacion.

---

## Solucion

### Cambio 1: `process-transcription/index.ts` - Solo speakers en embeddings

**Linea 452** - Cambiar la logica de seleccion de personas para embeddings:

```text
// Antes:
const embeddingPeople = segmentParticipants || extracted.speakers || extracted.people?.map(p => p.name) || [];

// Despues:
const embeddingPeople = segmentParticipants?.length
  ? segmentParticipants
  : (extracted.speakers?.length ? extracted.speakers : []);
```

Si no hay speakers ni participantes del segmento, dejar el array vacio. Nunca meter a todas las personas mencionadas.

Ademas, reforzar el EXTRACTION_PROMPT (linea 66) para que el modelo devuelva speakers de forma mas fiable:

```text
6. **speakers**: SOLO las personas que HABLAN activamente en la conversacion.
   IMPORTANTE: Este campo es CRITICO. Debes devolver SIEMPRE al menos 1 speaker.
   NO incluyas personas mencionadas de pasada ni nombres de noticias de fondo.
   Si solo detectas un interlocutor ademas del usuario, pon solo ese nombre.
```

### Cambio 2: `BrainDashboard.tsx` - Agrupar por transcription_id

**Lineas 69-80** - Cambiar la agrupacion de fecha a transcription_id:

```text
// Antes: agrupa por date
const key = row.date;

// Despues: agrupa por transcription_id
const key = row.transcription_id || row.id;
```

Esto hace que cada tema/conversacion sea una tarjeta independiente, con su titulo y sus participantes especificos.

### Cambio 3: `ConversationCard.tsx` - Rediseno visual

Redisenar completamente para mostrar conversaciones de forma clara:

- **Titulo principal**: El titulo del tema (ej: "Reunion sobre campanas y chatbots"), no la fecha
- **Fecha**: Como subtitulo secundario
- **Participantes**: Solo los speakers reales, mostrados como avatares/badges prominentes
- **Resumen**: 2-3 lineas del contenido
- Eliminar la agrupacion por sub-segmentos (los chunks de una misma transcripcion no son "temas tratados", son fragmentos del mismo texto)

Layout de cada tarjeta:

```text
+--------------------------------------------------+
| Reunion sobre campanas, LinkedIn y chatbots       |
| 16 feb 2026                                       |
| [Agustin] [Raul Agustito]                        |
| Se discuten estrategias de marketing, campanas... |
+--------------------------------------------------+
| Analisis de administracion y justicia             |
| 16 feb 2026                                       |
| (sin interlocutores directos - contenido de TV)   |
| La transcripcion cubre temas de inmigracion...    |
+--------------------------------------------------+
```

### Cambio 4: Fix datos existentes (recomendacion)

Los datos actuales en la base de datos ya tienen el campo `people` contaminado. Para que se vea bien inmediatamente, habria que limpiar los datos existentes o reprocesar las transcripciones. Como solucion rapida, el nuevo ConversationCard podria filtrar visualmente y mostrar solo los primeros 3-4 nombres si hay demasiados, o usar el campo `metadata` para obtener el titulo correcto.

---

## Seccion tecnica

### Archivos a modificar

1. **`supabase/functions/process-transcription/index.ts`**
   - Linea 66: Reforzar instruccion de speakers en EXTRACTION_PROMPT
   - Linea 452: Cambiar fallback de people a array vacio

2. **`src/pages/BrainDashboard.tsx`**
   - Lineas 69-80: Agrupar por `transcription_id` en vez de por `date`

3. **`src/components/brain/ConversationCard.tsx`**
   - Rediseno completo: titulo del tema como header, fecha como subtitulo, speakers como badges, resumen limpio
   - Eliminar logica de sub-segmentos (no aplica cuando agrupas por transcription_id)
   - Mantener funcionalidad de editar/eliminar personas y borrar conversacion

### Orden de ejecucion

1. Modificar el prompt y la logica de embeddings en process-transcription
2. Cambiar la agrupacion en BrainDashboard
3. Redisenar ConversationCard
4. Deploy de la edge function


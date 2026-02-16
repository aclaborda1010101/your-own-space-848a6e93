
# Fix: Solo interlocutores reales como participantes, no todas las personas mencionadas

## Problema diagnosticado

Hay dos problemas superpuestos:

1. **115 embeddings con las mismas personas**: El sistema crea un embedding por cada chunk de 1500 caracteres del texto. TODOS los chunks reciben la lista completa de `extracted.people` (TODAS las personas que Gemini detecta en todo el texto), sin importar si esa persona aparece en ese chunk concreto.

2. **"people" incluye a todo el mundo**: La extraccion de Gemini devuelve en `people` a CUALQUIER persona mencionada (incluyendo "Speaker 15", nombres que salen en una noticia de fondo, etc.), no solo a los interlocutores reales de la conversacion.

## Solucion en 3 partes

### Parte 1: Distinguir "interlocutores" de "personas mencionadas" en el prompt

Modificar `EXTRACTION_PROMPT` para que tenga DOS campos separados:
- `speakers`: Solo las personas que HABLAN en la conversacion (los interlocutores reales)
- `people`: Todas las personas mencionadas (clientes, contactos referenciados, etc.)

Solo los `speakers` se guardaran como `people` en los embeddings.

### Parte 2: Usar participantes del segmento en los embeddings

Cuando hay segmentacion, cada segmento ya tiene `participants` (los interlocutores de ESE segmento). Usar esos participantes en vez de `extracted.people` al crear los embeddings.

En la funcion `saveTranscriptionAndEntities`, pasar los `segmentParticipants` como parametro opcional y usarlos como `people` en los embeddings en vez de `extracted.people.map(p => p.name)`.

### Parte 3: Agrupar embeddings por fecha en BrainDashboard

Cambiar la agrupacion en BrainDashboard de `transcription_id` a `date`, para que un dia como el 15 de febrero muestre UNA sola tarjeta con los temas dentro, en vez de 115 tarjetas individuales.

## Seccion tecnica

### `supabase/functions/process-transcription/index.ts`

**EXTRACTION_PROMPT (lineas 53-72)**:
- Cambiar campo 6 (`people`) para que distinga entre interlocutores y mencionados
- Nuevo campo: `speakers` = personas que HABLAN activamente en la conversacion
- `people` = todas las personas mencionadas (mantener para contactos)

**Interface ExtractedData (lineas 74-85)**:
- Anadir `speakers?: Array<string>` 

**saveTranscriptionAndEntities (lineas 288-511)**:
- Nuevo parametro opcional: `segmentParticipants?: string[]`
- Linea 448: usar `segmentParticipants || extracted.speakers || extracted.people?.map(p => p.name) || []` para los embeddings
- Lineas 455, 462: misma logica para chunks adicionales

**Procesamiento de segmentos (lineas 602-611)**:
- Pasar `segment.participants` a `saveTranscriptionAndEntities` como `segmentParticipants`

### `src/pages/BrainDashboard.tsx`

**Query de conversaciones (lineas 57-81)**:
- Cambiar agrupacion de `transcription_id` a `date` para evitar 115 tarjetas por dia
- Limitar a los embeddings mas representativos por fecha (no los 115 chunks)

### Resultado esperado

- "Dia 15 de febrero" mostrara UNA tarjeta
- Al desplegar, cada tema tendra solo sus interlocutores reales (ej: "Comida con mexicanos" solo tendra Andrei, Cristian, Joseba)
- No aparecera "Speaker 15" ni gente mencionada de pasada

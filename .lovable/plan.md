
# Plan: Limpiar interlocutores contaminados en datos existentes

## Problema

El codigo ya esta corregido para futuras transcripciones (usa `segmentParticipants` o `extracted.speakers`, nunca `extracted.people`). Sin embargo, los datos existentes en `conversation_embeddings` siguen teniendo 20-30 nombres en el campo `people` porque fueron procesados con la logica antigua.

Datos afectados:
- **"Reunion sobre campanas, LinkedIn y chatbots"** (transcription_id: `de691b57...`): 24 nombres, deberian ser solo **Agustin Cifuentes** y **Raul Agustito**
- **"Comida con amigos: anecdotas, comida y biohacking"** (transcription_id: `95cf9ce5...`): 12 nombres, hay que identificar los reales
- **"Manana familiar: juegos, cocina y actividades con Bosco"** (transcription_id: `286cc394...`): varios nombres, hay que identificar los reales

## Solucion en 2 pasos

### Paso 1: Limpiar datos existentes via SQL

Ejecutar updates directos para corregir el campo `people` en las transcripciones contaminadas:

```text
-- Reunion sobre campanas: solo Agustin y Raul hablan
UPDATE conversation_embeddings
SET people = ARRAY['Agustín Cifuentes', 'Raúl Agustito']
WHERE transcription_id = 'de691b57-8a2a-4ddd-a001-7f05466b4383';

-- Comida con amigos: identificar speakers reales de la transcripcion
-- (necesitamos verificar quienes hablan realmente)

-- Manana familiar: identificar speakers reales
-- (necesitamos verificar quienes hablan realmente)
```

Para las otras 2 transcripciones, revisare el contenido para identificar los speakers reales antes de actualizar.

### Paso 2: Anadir boton "Reprocesar" en la UI (opcional pero recomendado)

Ya existe soporte de reprocesamiento en la edge function (`reprocess_transcription_id`). Se podria anadir un boton en `ConversationCard.tsx` que llame a esta funcion para que el sistema re-extraiga con la logica corregida. Esto seria util para corregir transcripciones antiguas sin tener que hacerlo manualmente.

---

## Seccion tecnica

### Cambio 1: Migracion SQL para limpiar datos

Ejecutar un UPDATE directo sobre `conversation_embeddings` para cada `transcription_id` afectado, reemplazando el array `people` con solo los interlocutores reales.

Primero consultare el contenido de las transcripciones de "Comida" y "Manana familiar" para identificar quienes hablan realmente, y luego ejecutare los updates.

### Cambio 2 (opcional): Boton reprocesar en ConversationCard

En `src/components/brain/ConversationCard.tsx`, anadir un boton "Reprocesar" en la seccion expandida que:
1. Llame a la edge function `process-transcription` con `{ reprocess_transcription_id: transcription_id }`
2. Muestre un spinner mientras procesa
3. Invalide las queries al completar

Esto permitiria al usuario reprocesar cualquier transcripcion antigua con la logica corregida de speakers.

### Orden de ejecucion

1. Consultar contenido de las transcripciones para identificar speakers reales
2. Ejecutar UPDATE SQL para limpiar los 3 transcription_ids
3. (Opcional) Anadir boton reprocesar en ConversationCard

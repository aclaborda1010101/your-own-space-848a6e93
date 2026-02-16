

# Plan: Botones de asignacion en Transcripciones y mejora de espaciado

## Resumen

Dos mejoras principales:
1. Anadir botones de accion en cada transcripcion del historico (Inbox) para asignar a Profesional/Personal/Familiar o descartar
2. Mejorar el espaciado general en las tarjetas de conversacion y el listado de transcripciones para que no quede "apelotonado"

---

## Cambio 1: Botones de asignacion en el historico de transcripciones (`src/pages/Inbox.tsx`)

Cada fila del historico de transcripciones (lineas 548-573) pasa de ser una fila compacta a tener botones de accion claros:

- **Asignar a brain**: 3 botones iconicos (Briefcase/User/Heart) para mover la transcripcion a Profesional, Personal o Familiar. Al pulsar, se actualiza el campo `brain` en la tabla `transcriptions` y tambien en todos los `conversation_embeddings` asociados
- **Descartar**: Boton rojo (Trash) para eliminar la transcripcion y sus embeddings asociados
- Si la transcripcion ya tiene brain asignado, se muestra como badge coloreado (como ahora) pero los botones permiten reasignar

Layout propuesto por fila:

```text
[icono-brain] Titulo de la transcripcion            [Pro] [Per] [Fam] [X]  Reprocesar  manual  12:05
              Resumen truncado...
```

Los botones seran pequenos iconos con tooltips. Al asignar, se actualiza via SQL update tanto `transcriptions.brain` como `conversation_embeddings.brain` donde `transcription_id` coincida.

## Cambio 2: Mejora de espaciado (`src/components/brain/ConversationCard.tsx`)

- Aumentar padding interno de cada tarjeta (de `p-4` a `p-5`)
- Mas separacion entre titulo, fecha y speakers
- Mas margen entre tarjetas en el contenedor padre (en `BrainDashboard.tsx`, cambiar `divide-y` por `space-y-2` con bordes sutiles)
- Resumen con mas line-height para mejor legibilidad

## Cambio 3: Espaciado en historico de transcripciones (`src/pages/Inbox.tsx`)

- Aumentar padding vertical de cada fila (de `py-1.5` a `py-3`)
- Mas separacion entre el titulo y el resumen
- Los botones de accion con mas espacio entre ellos

---

## Seccion tecnica

### Archivos a modificar

1. **`src/pages/Inbox.tsx`** (lineas 548-573)
   - Redisenar cada fila del historico para incluir botones de asignacion de brain (Profesional, Personal, Familiar) y boton de descartar
   - Anadir funcion `handleAssignBrain(transcriptionId, newBrain)` que haga UPDATE en `transcriptions` y `conversation_embeddings`
   - Anadir funcion `handleDiscardTranscription(transcriptionId)` que haga DELETE en `transcriptions` y `conversation_embeddings`
   - Mejorar padding y espaciado de cada fila

2. **`src/components/brain/ConversationCard.tsx`**
   - Aumentar padding de `p-4` a `p-5`
   - Anadir `mt-2` entre titulo y fecha, `mt-3` entre speakers y resumen
   - Mejorar espaciado en la seccion expandida

3. **`src/pages/BrainDashboard.tsx`** (linea 330)
   - Cambiar `divide-y divide-border/30` por `space-y-2` para mas separacion entre tarjetas
   - Aumentar altura del ScrollArea de `h-[400px]` a `h-[500px]` para mostrar mas contenido

### Logica de asignacion de brain

```text
async function handleAssignBrain(transcriptionId: string, newBrain: string) {
  // 1. Update transcription brain
  await supabase.from("transcriptions").update({ brain: newBrain }).eq("id", transcriptionId);
  // 2. Update all related embeddings
  await supabase.from("conversation_embeddings").update({ brain: newBrain }).eq("transcription_id", transcriptionId);
  // 3. Invalidate queries
  queryClient.invalidateQueries({ queryKey: ["all-transcriptions"] });
  queryClient.invalidateQueries({ queryKey: ["brain-conversations"] });
}
```

### Logica de descartar

```text
async function handleDiscardTranscription(transcriptionId: string) {
  // 1. Delete embeddings
  await supabase.from("conversation_embeddings").delete().eq("transcription_id", transcriptionId);
  // 2. Delete suggestions
  await supabase.from("suggestions").delete().eq("source_transcription_id", transcriptionId);
  // 3. Delete transcription
  await supabase.from("transcriptions").delete().eq("id", transcriptionId);
  // 4. Invalidate
  queryClient.invalidateQueries({ queryKey: ["all-transcriptions"] });
}
```

### Orden de ejecucion

1. Modificar Inbox.tsx con botones de asignacion y descarte
2. Mejorar espaciado en ConversationCard.tsx
3. Mejorar espaciado en BrainDashboard.tsx


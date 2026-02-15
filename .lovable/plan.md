
# Redisenar gestion de contactos y conversaciones

## Problemas detectados

1. **No se puede editar el nombre del contacto**: El formulario de edicion en `ContactDetailDialog` solo permite cambiar empresa, rol, relacion, cerebro y email. Falta el campo `name`.
2. **Desvincular contacto de hilo no funciona correctamente**: El boton de desvincular en `ContactDetailDialog` solo actualiza UNA fila de `conversation_embeddings`, pero cada hilo tiene multiples chunks con el mismo `transcription_id`. Hay que eliminar el nombre de TODAS las filas del hilo.
3. **ConversationCard - eliminar contacto poco intuitivo**: El icono del lapiz para editar participantes es minusculo (3px), el modo edicion no es claro, y los botones de accion son demasiado pequenos para interactuar comodamente.
4. **UI poco profesional**: Todo demasiado comprimido, iconos invisibles, flujos confusos.

## Solucion

### 1. Edicion de nombre en ContactDetailDialog

Anadir campo `name` al formulario de edicion. Cuando se cambie el nombre, actualizar tambien todas las filas de `conversation_embeddings` que contengan el nombre antiguo (reemplazar en el array `people`).

### 2. Fix desvincular hilo completo

Cuando se desvincula un contacto de un hilo, buscar TODAS las filas de `conversation_embeddings` con el mismo `transcription_id` y eliminar el nombre de todas ellas, no solo de una fila individual.

### 3. Redisenar ConversationCard

- Eliminar el modo "edicion de participantes" con lapiz invisible
- Cada participante se muestra como badge con una X visible directamente (sin necesidad de activar modo edicion)
- Boton "Anadir participante" siempre accesible dentro del panel expandido
- Mejor espaciado y tamanos de fuente
- Animacion suave al expandir/contraer

### 4. Mejorar ContactDetailDialog

- Nombre editable directamente en la cabecera (click para editar inline)
- Boton de eliminar contacto completo
- Desvincular hilos con confirmacion visual clara

## Seccion tecnica

### Archivo: `src/components/contacts/ContactDetailDialog.tsx`

**Cambio 1 - Anadir name al formulario**:
- Anadir `name` al estado `form` e `initForm`
- Nuevo campo Input para el nombre en el formulario de edicion
- En `handleSave`, si el nombre cambio, actualizar tambien `conversation_embeddings`:

```typescript
// Si el nombre cambio, actualizar en conversation_embeddings
if (form.name !== contact.name) {
  const { data: rows } = await supabase
    .from("conversation_embeddings")
    .select("id, people")
    .contains("people", [contact.name]);
  
  for (const row of rows || []) {
    const newPeople = (row.people || []).map((p: string) => 
      p === contact.name ? form.name : p
    );
    await supabase
      .from("conversation_embeddings")
      .update({ people: newPeople })
      .eq("id", row.id);
  }
}
```

**Cambio 2 - Fix desvincular por transcription_id**:

```typescript
const unlinkThread = useMutation({
  mutationFn: async (thread: { id: string; transcription_id: string | null }) => {
    // Buscar TODAS las filas con el mismo transcription_id
    let query = supabase
      .from("conversation_embeddings")
      .select("id, people");
    
    if (thread.transcription_id) {
      query = query.eq("transcription_id", thread.transcription_id);
    } else {
      query = query.eq("id", thread.id);
    }
    
    const { data: rows } = await query;
    
    for (const row of rows || []) {
      const newPeople = (row.people || []).filter(p => p !== contact.name);
      await supabase
        .from("conversation_embeddings")
        .update({ people: newPeople })
        .eq("id", row.id);
    }
    
    // Decrementar interaction_count
    await supabase
      .from("people_contacts")
      .update({ interaction_count: Math.max(0, (contact.interaction_count || 1) - 1) })
      .eq("id", contact.id);
  },
});
```

**Cambio 3 - Boton eliminar contacto**:

Anadir boton "Eliminar contacto" que borra de `people_contacts` y opcionalmente limpia su nombre de `conversation_embeddings`.

**Cambio 4 - Deduplicar hilos por transcription_id**:

En la query de threads del contacto, deduplicar por `transcription_id` igual que en BrainDashboard.

### Archivo: `src/components/brain/ConversationCard.tsx`

Rediseno completo:
- Quitar el sistema de "editingPeople" con lapiz invisible
- Badges de participantes con X directa siempre visible al expandir
- Input para anadir persona siempre visible en modo expandido
- Tamanos de fuente y padding mas generosos
- Fix `removePerson`: actualizar TODAS las filas del grupo, no solo las que contienen el nombre (ya esta bien implementado)
- Anadir boton para eliminar la conversacion completa

### Archivos modificados

- `src/components/brain/ConversationCard.tsx` - Rediseno completo
- `src/components/contacts/ContactDetailDialog.tsx` - Edicion de nombre, fix desvincular, eliminar contacto


# Desvincular hilos de un contacto

## Que se quiere

Cuando abres el detalle de un contacto y ves la seccion "Hilos detectados", poder pulsar en un hilo y desvincularlo de ese contacto. Esto significa que el nombre del contacto se elimina del array `people` de esa fila en `conversation_embeddings`.

## Como funciona

Los hilos se vinculan a un contacto porque su nombre aparece en la columna `people` (array de texto) de `conversation_embeddings`. Para desvincular:

1. Se elimina el nombre del contacto del array `people` de esa fila
2. Se actualiza tambien `interaction_count` del contacto en `people_contacts` (decrementar en 1)
3. El hilo desaparece de la lista del contacto

## Cambios

### Archivo: `src/components/contacts/ContactDetailDialog.tsx`

1. Importar `useMutation` y `useQueryClient` (ya tiene useQueryClient)
2. Anadir una mutacion `unlinkThread` que:
   - Lea el array `people` actual de esa fila de `conversation_embeddings`
   - Lo actualice eliminando el nombre del contacto
   - Decremente `interaction_count` en `people_contacts`
   - Invalide la query de threads para refrescar la lista
3. Anadir un boton de desvincular (icono X o Unlink) en cada hilo de la lista
4. Mostrar confirmacion antes de desvincular (un pequeno alert o toast de confirmacion)

### Detalle tecnico de la mutacion

```text
// 1. Obtener people actual del embedding
const { data: row } = await supabase
  .from("conversation_embeddings")
  .select("people")
  .eq("id", threadId)
  .single();

// 2. Filtrar el nombre del contacto
const newPeople = row.people.filter(p => p !== contactName);

// 3. Actualizar
await supabase
  .from("conversation_embeddings")
  .update({ people: newPeople })
  .eq("id", threadId);

// 4. Decrementar interaction_count del contacto
await supabase
  .from("people_contacts")
  .update({ interaction_count: Math.max(0, (contact.interaction_count || 1) - 1) })
  .eq("id", contactId);
```

### UI del boton

Cada hilo en la lista tendra un pequeno boton con icono `Unlink2` o `X` en la esquina superior derecha. Al pulsarlo se ejecuta la desvinculacion directamente con un toast de confirmacion.

### Sin cambios de esquema

No se necesitan migraciones. Solo se actualizan valores existentes en `conversation_embeddings.people` y `people_contacts.interaction_count`.

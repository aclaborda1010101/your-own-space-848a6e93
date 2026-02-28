

## Diagnóstico: Angel Baena sin mensajes para analizar

### Problema raíz

Angel Baena tiene `wa_message_count: 1589` en `people_contacts` (se contaron durante la importación), pero **0 filas en `contact_messages`**. La tabla `contact_messages` solo tiene mensajes de un contacto (Carls Primo, 17,484 msgs). Los mensajes de Angel Baena y de los demás contactos nunca se persistieron en esa tabla.

El análisis de IA (`contact-analysis`) lee de `contact_messages` → encuentra 0 → genera "Sin interacción".

Además hay **2 registros duplicados** de Angel Baena (IDs `5329f555` con 0 msgs y `9447c07a` con 1589 msgs).

### Causa probable

El flujo de importación de WhatsApp (`useOnboarding.tsx`) hace `update({ wa_message_count })` pero la inserción masiva de mensajes en `contact_messages` probablemente falló silenciosamente o se limitó a un solo contacto. Las migraciones `20260220100244` y `20260220123941` hicieron `DELETE FROM contact_messages` (purga completa) y resetearon `wa_message_count = 0`, pero luego se reimportó parcialmente solo un contacto.

### Plan de solución

**1. Fusionar duplicados de Angel Baena**
- Migración SQL: mover datos del registro sin historia al que tiene historia, eliminar duplicado

**2. Re-importar mensajes a `contact_messages`**

Esto no es un fix de código, sino un problema de datos. Las opciones son:

**Opción A** — Añadir botón "Re-sincronizar mensajes" en el detalle de contacto que vuelva a leer los mensajes del chat de WhatsApp original y los inserte en `contact_messages`. Requiere que los chats exportados sigan disponibles.

**Opción B** — Hacer que `contact-analysis` funcione con **fuentes alternativas** cuando `contact_messages` está vacío: buscar en `plaud_threads` transcripciones donde aparezca el nombre, y en emails. Esto haría el análisis más resiliente.

**Opción C** — Ambas: re-sync + fallback a otras fuentes.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Fusionar duplicados de Angel Baena |
| `supabase/functions/contact-analysis/index.ts` | Fallback: si 0 msgs en `contact_messages`, buscar en transcripciones de Plaud threads |
| `src/components/contacts/ContactTabs.tsx` | Botón "Re-importar mensajes" (opcional) |

### Nota

El problema afecta a **todos los contactos excepto Carls Primo**, no solo a Angel Baena. Cualquier contacto con `wa_message_count > 0` pero sin filas en `contact_messages` tendrá el mismo resultado vacío.


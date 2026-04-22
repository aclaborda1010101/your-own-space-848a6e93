

## Añadir contacto manual a la Red Estratégica (nombre + teléfono)

### Qué cambia para ti

En `/red-estrategica`, al pulsar el botón **"Añadir"**, el diálogo actual seguirá mostrando la búsqueda de contactos existentes, pero arriba del todo aparecerá una nueva sección **"➕ Crear nuevo contacto"** plegable con dos campos:

- **Nombre** (obligatorio)
- **Teléfono** (obligatorio, con normalización a formato internacional)

Al pulsar "Crear y añadir", el contacto se inserta en `people_contacts` con `in_strategic_network: true` y aparece inmediatamente en tu red. Si ya existe un contacto con ese teléfono, en lugar de duplicar lo activa en la red estratégica.

### Cómo funciona por dentro

**Archivo único modificado: `src/components/contact/AddToNetworkDialog.tsx`**

1. Añadir estado para el formulario de creación (`newName`, `newPhone`, `creating`, `formOpen`).
2. Añadir validación con `zod` (regla del proyecto):
   - `name`: trim, no vacío, máx 100 chars.
   - `phone`: trim, regex `^\+?[0-9\s\-()]{7,20}$`, normalizado a solo dígitos con prefijo `+`.
3. Función `createAndAdd()`:
   - Normaliza el teléfono (quita espacios/guiones, garantiza `+`).
   - Comprueba si ya existe un `people_contacts` del usuario donde `phone_numbers` contiene ese número (con `.contains('phone_numbers', [normalized])`).
   - Si **existe** → `update { in_strategic_network: true }` sobre ese registro y mensaje "X ya estaba en tus contactos, lo añadimos a la red".
   - Si **no existe** → `insert` nuevo con `{ user_id, name, phone_numbers: [normalized], in_strategic_network: true, category: 'manual' }`.
   - Limpia campos, llama a `onAdded()` para que `RedEstrategica` recargue.
4. UI: bloque colapsable arriba del buscador con los dos `Input` y un botón `Crear y añadir`. Estado de loading con `Loader2`. Errores con `toast.error`.

### Qué NO toco

- El schema de la tabla (`people_contacts` ya tiene `name`, `phone_numbers`, `in_strategic_network`, `user_id` — todo lo necesario).
- Las RLS existentes (la inserción usa `user_id = auth.uid()`, ya cubierto por la política actual de la tabla).
- El resto del flujo de búsqueda existente del diálogo.
- `RedEstrategica.tsx` — ya pasa `onAdded={() => void load()}`, se reutiliza sin cambios.

### Edge cases manejados

- Teléfono duplicado del mismo usuario → activa en red en vez de duplicar.
- Nombre vacío o solo espacios → bloqueado por zod, toast de error.
- Teléfono mal formado → toast de error con mensaje claro.
- Sin sesión → botón deshabilitado (igual que ya hace el dialog).

### Resultado

Un solo punto de entrada para añadir contactos a la red: existentes (búsqueda) o nuevos (formulario nombre+teléfono). Sin pasar por importación de WhatsApp ni de Mac Contacts.


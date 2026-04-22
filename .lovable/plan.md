

## Problema real

Cuando creas un contacto manual con un teléfono, la fila en `people_contacts` se crea aislada: **nada vincula los mensajes de WhatsApp existentes a ese nuevo `contact_id`**.

Lo confirmé con queries reales:
- `contact-analysis` filtra mensajes por `contact_id` exacto (líneas 316 y 926).
- Hay **34.977 mensajes huérfanos** en `contact_messages` (`contact_id IS NULL`).
- `Hiva` no tiene `wa_id` → ni los webhooks futuros (`evolution-webhook`, `whatsapp-webhook`) lo encuentran al matchear → seguirá creando otro "pendiente" o atribuyendo al equivocado.
- Sus mensajes históricos están sin `contact_id` → `contact-analysis` recibe `messages = []` → no genera perfil → ves "pendiente, sin nada".

## Solución (3 piezas atómicas)

### 1. Edge function nueva: `link-contact-history`

Recibe `{ contact_id, phone }`. Con `service_role`:

1. **Normaliza** el teléfono: dígitos puros + variantes con/sin prefijo + últimos 9 dígitos (mismo algoritmo que `evolution-webhook`).
2. **Setea `wa_id`** en `people_contacts` (versión canónica solo dígitos) si está vacío. Asegura que `phone_numbers` contenga las variantes.
3. **Re-ata mensajes huérfanos**:
   ```
   UPDATE contact_messages
   SET contact_id = $newId
   WHERE user_id = $uid
     AND contact_id IS NULL
     AND (chat_name = $waId
          OR chat_name LIKE '%' || $last9
          OR sender LIKE '%' || $last9
          OR external_id LIKE $waId || '%')
   ```
4. **Dispara `contact-analysis`** con `include_historical: true` (fire-and-forget).

Devuelve `{ linked_messages: N, profile_refresh: 'queued' }`.

### 2. Modificar `AddToNetworkDialog.tsx`

- Cambiar el `insert` para devolver el `id` (`.select('id').single()`).
- Tras crear, invocar `link-contact-history` con `contact_id` y teléfono normalizado.
- Toast con resultado:
  - `0` → "Contacto creado. Sin historial WhatsApp con ese número."
  - `N>0` → "Contacto creado. Vinculados N mensajes. Generando perfil…"

### 3. Botón "Buscar historial WhatsApp" en `ContactDetail`

Llama a la misma función. Sirve para:
- Arreglar `Hiva` y cualquier otro contacto manual ya creado.
- Re-intentar si añades el teléfono más tarde.

## Por qué este enfoque

- **No reproceso el dump de WhatsApp completo** (caro). Solo re-ato lo ya indexado en `contact_messages`.
- **No toco webhooks**: ya hacen matching correcto por `wa_id` y teléfono. Cuando `Hiva` tenga `wa_id` poblado, los mensajes futuros caerán automáticamente.
- **No toco `contact-analysis`**: ya funciona si `contact_id` está bien atado.
- UPDATE idempotente filtrado por `user_id` → no contamina datos de otros usuarios. Solo opera sobre `contact_id IS NULL` → nunca roba mensajes ya atribuidos.

## Riesgos

- **Falsos positivos por `LIKE %last9`**: dos teléfonos distintos podrían coincidir en últimos 9 dígitos en países distintos. Aceptable porque solo afecta a huérfanos sin dueño.
- **Volumen**: un teléfono con 10k mensajes = un solo UPDATE indexado. Sin problema.

## Para Hiva en concreto

Tras desplegar, abres su ficha → "Buscar historial WhatsApp" → ves el contador de mensajes vinculados → en minutos `contact-analysis` regenera el perfil completo con su historial.

## Archivos

- **Crear**: `supabase/functions/link-contact-history/index.ts`
- **Editar**: `src/components/contact/AddToNetworkDialog.tsx`
- **Editar**: `src/pages/ContactDetail.tsx` (botón de re-vinculación)


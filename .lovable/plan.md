

## Plan: arreglar carga de WhatsApp (3 problemas reales)

### Diagnóstico confirmado en BD

| Problema | Evidencia | Causa |
|---|---|---|
| Mensajes duplicados x2 | 52 filas en 24h, solo 26 únicas | webhook sin idempotencia, Evolution reintenta |
| Contactos cruzados | `wa_id 34663409882` aparece como Agustín y Dominic Vieira | matching mal, crea contactos nuevos en lugar de reusar |
| "Mensajes del número viejo" | 612k filas `source='whatsapp_backup'` (2011→mar 2026) mezcladas con 597k live | el backup importado del número anterior se muestra junto al nuevo |

### Cambios

**1. Idempotencia en `evolution-webhook` (corrige duplicación)**
- Añadir columna `external_id` (text) a `contact_messages` con índice único parcial por `(user_id, external_id)` cuando no es null.
- Guardar `key.id` de Evolution como `external_id` y usar `upsert` con `onConflict: 'user_id,external_id'`. Si ya existe, devolver 200 sin reinsertar.

**2. Resolución correcta de contactos (corrige cruces)**
- En mensajes salientes (`fromMe=true`), el `remoteJid` es el destinatario, no tú. El código ya lo hace bien, pero el bug es que cuando `pushName` viene vacío usa el `waId` como nombre y crea contacto nuevo.
- Añadir paso previo: normalizar `waId` quitando sufijos (`:NN`) y buscar también por las últimas 9 cifras del teléfono (números españoles con/sin prefijo).
- Si no hay match exacto Y no hay `pushName` real, NO crear contacto: marcar el mensaje con `contact_id = null` y dejar para reconciliación posterior.

**3. Separar backup viejo del número nuevo (corrige "ves los del viejo")**
Dos opciones, prefiero la **A** porque preserva histórico:

- **A (recomendada)**: añadir filtro por `source` en la UI. En `WhatsAppTab` y dashboards mostrar por defecto solo `source='whatsapp'` (live del número actual) con un toggle "Incluir histórico importado". Así no pierdes los 612k mensajes pero no contaminan la vista del día a día.
- **B**: borrar `contact_messages` con `source='whatsapp_backup'` anteriores a una fecha que tú confirmes. Destructivo.

**4. Migración de limpieza (one-shot)**
- Detectar duplicados existentes en `contact_messages` por `(user_id, contact_id, content, message_date, direction)` y eliminar las filas extra conservando la más antigua.
- Estimado: ~600k filas duplicadas a borrar.

**5. Reconciliar contactos duplicados**
- Para cada `wa_id` con múltiples filas en `people_contacts` del mismo `user_id`: fusionar en la fila más antigua, reasignar `contact_messages.contact_id` y borrar las duplicadas.

### Decisión que necesito de ti

Solo una: **¿opción A o B para el backup viejo?**
- **A**: lo escondo de la UI por defecto, lo conservas (recomiendo esto).
- **B**: lo borro de BD para no volver a verlo nunca.

Si no respondes, voy con **A**.

### Qué queda igual
- Conexión Evolution / instancia / owner (ya es tu nuevo número, verificado).
- Routing del webhook y triggers de IA (`contact-analysis`, drafts).


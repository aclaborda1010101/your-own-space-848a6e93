

# Integración WhatsApp Business API con Red Estratégica

## Estado actual

Ya tienes **toda la infraestructura backend construida**:

1. **`whatsapp-webhook`** — Recibe mensajes de Meta WhatsApp Business API (verificación GET + procesamiento POST). Usa `platform_users` para resolver usuario y llama a `jarvis-gateway`.
2. **`evolution-webhook`** — Recibe mensajes de Evolution API, persiste en `contact_messages`, crea/vincula contactos en `people_contacts`, dispara `contact-analysis` y `generate-response-draft`.
3. **`send-whatsapp`** — Envía mensajes vía Meta Graph API usando `WHATSAPP_API_TOKEN` y `WHATSAPP_PHONE_ID`.
4. **Secrets configurados** — `WHATSAPP_API_TOKEN` y `WHATSAPP_PHONE_ID` ya existen.

Lo que **falta** son dos cosas:

### A. Configurar el webhook en Meta (manual, no código)
### B. UI para enviar mensajes desde la Red Estratégica y ver conversación en tiempo real

---

## Paso 1: Configuración en Meta (instrucciones para ti)

1. Ve a [developers.facebook.com](https://developers.facebook.com) → Tu App → WhatsApp → Configuration
2. En **Webhook URL** pon: `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/whatsapp-webhook`
3. En **Verify Token** pon: `jarvis-verify-token`
4. Suscríbete al campo `messages`

Esto activará el flujo en tiempo real. Pero el `whatsapp-webhook` actual está diseñado para el chatbot Jarvis (resuelve vía `platform_users` y reenvía a `jarvis-gateway`), **no para el CRM de contactos**.

## Paso 2: Unificar el webhook para alimentar la Red Estratégica

El `whatsapp-webhook` actual solo funciona para usuarios vinculados vía `platform_users`. Para la Red Estratégica necesitamos que **también** persista mensajes en `contact_messages` y actualice `people_contacts` — exactamente como hace `evolution-webhook`.

**Cambio en `whatsapp-webhook/index.ts`:**
- Después de extraer `phoneNumber`, `text`, `contactName` del payload de Meta
- Usar `EVOLUTION_DEFAULT_USER_ID` (o un nuevo secret `WHATSAPP_CRM_USER_ID`) como `userId` del CRM
- Buscar/crear contacto en `people_contacts` por `wa_id` (misma lógica que `evolution-webhook`)
- Insertar mensaje en `contact_messages`
- Actualizar `last_contact` en `people_contacts`
- Disparar `contact-analysis` y `generate-response-draft` para favoritos
- Mantener el flujo Jarvis existente en paralelo (si el usuario está vinculado vía `platform_users`)

## Paso 3: UI de chat + envío en la pestaña WhatsApp

**Cambio en `src/components/contacts/ContactTabs.tsx` (WhatsAppTab):**

- Añadir lista de mensajes recientes (últimos 50) con scroll, mostrando burbujas incoming/outgoing
- Añadir input de texto + botón enviar que llama a `send-whatsapp` edge function con el `wa_id` del contacto
- Persistir el mensaje enviado en `contact_messages` (dirección `outgoing`)
- Suscripción Realtime a `contact_messages` filtrado por `contact_id` + `source=whatsapp` para ver nuevos mensajes al instante

**Cambio en `send-whatsapp/index.ts`:**
- Añadir soporte para recibir `contact_id` en vez de solo `phone`
- Resolver el teléfono desde `people_contacts.wa_id` o `phone_numbers`
- Persistir el mensaje enviado en `contact_messages` automáticamente

## Paso 4: Registrar `whatsapp-webhook` en config.toml

Añadir `verify_jwt = false` para que Meta pueda llamar al webhook sin JWT.

---

## Archivos tocados

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/whatsapp-webhook/index.ts` | Añadir persistencia CRM (contact_messages + people_contacts) |
| `supabase/functions/send-whatsapp/index.ts` | Soporte `contact_id`, persistencia automática del mensaje enviado |
| `src/components/contacts/ContactTabs.tsx` | Chat UI con mensajes + input de envío + Realtime |
| `supabase/config.toml` | Añadir `[functions.whatsapp-webhook] verify_jwt = false` |


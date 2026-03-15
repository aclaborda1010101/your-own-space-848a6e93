

# Diagnóstico: WhatsApp Business no recibe mensajes en tiempo real

## Hallazgos clave

### 1. Meta SÍ tiene `messages` suscrito (confirmado en screenshot)
La imagen muestra que el campo `messages` está marcado como "Suscrito" en el panel de Meta. Esto descarta el problema de suscripción.

### 2. El webhook NO está recibiendo POSTs con mensajes
Los logs de `whatsapp-webhook` solo muestran:
- `"Webhook verified"` (de auto-tests GET)
- Boots y shutdowns

No hay ni un solo log de `"[WhatsApp] Message from..."`, que aparecería en la línea 281 del webhook si llegara un mensaje real. Esto confirma que **Meta no está enviando los mensajes al endpoint**.

### 3. No hay cuentas vinculadas
La tabla `platform_users` está vacía (no hay registros con `platform = 'whatsapp'`). Esto no bloquea la recepción de mensajes (el CRM los persiste igualmente con `EVOLUTION_DEFAULT_USER_ID`).

### 4. El secreto `EVOLUTION_DEFAULT_USER_ID` puede no estar configurado
No aparece en la lista de secretos del proyecto. Sin él, `persistToCRM()` hace skip silencioso (línea 108-110), y si un usuario no vinculado envía un mensaje, tampoco se guarda en la BD.

### 5. Los datos existentes son importados, no en tiempo real
Todos los `contact_messages` con source `whatsapp` tienen `created_at` del 15 de marzo pero `message_date` de 2024 -- son importaciones de backup, no mensajes live.

## Causa raíz probable

Meta no está entregando los POSTs al webhook. Hay tres posibles razones:

1. **Callback URL incorrecto en Meta** -- El URL configurado en Meta (WhatsApp > Configuration > Webhook) no coincide con `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/whatsapp-webhook`
2. **App en modo desarrollo** -- Si la app de Meta está en modo "Development", solo entrega mensajes de números de prueba registrados en la sección "Test Numbers"
3. **Falta el secreto `EVOLUTION_DEFAULT_USER_ID`** -- Sin él, aunque lleguen mensajes, el CRM los ignora silenciosamente

## Plan de acción

### Paso 1: Verificar configuración de Meta (manual, el usuario)
El usuario debe comprobar en Meta Developers > WhatsApp > Configuration:
- **Callback URL** = `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/whatsapp-webhook`
- **Verify token** = `jarvis-verify-token`

### Paso 2: Añadir el secreto `EVOLUTION_DEFAULT_USER_ID`
Configurar el secreto con el UUID del usuario principal para que los mensajes entrantes se persistan en `contact_messages`.

### Paso 3: Añadir logging de diagnóstico al webhook
Modificar `whatsapp-webhook/index.ts` para logear TODOS los POSTs que recibe, incluso los que no tienen mensajes de texto. Esto permitirá ver si Meta envía algo (status updates, read receipts) pero el webhook los descarta silenciosamente porque solo procesa `type === "text"`.

Cambios concretos:
- Añadir `console.log("[WhatsApp] POST received, body:", JSON.stringify(body).substring(0, 500))` justo después de parsear el body
- Mover el log antes del filtro `if (!msgObj || msgObj.type !== "text")`
- Añadir log cuando se descarta un mensaje no-text: `console.log("[WhatsApp] Skipping non-text message:", msgObj?.type)`

### Paso 4: Panel de diagnóstico en la UI
Añadir a la sección "Live" de DataImport un botón "Test Webhook" que llame al webhook con un payload simulado de WhatsApp y confirme que el pipeline completo funciona (parseo → persistencia → realtime). Esto permitirá verificar desde la interfaz sin depender de Meta.

### Paso 5: Mejorar feedback visual
Cuando la Realtime subscription detecte un INSERT nuevo en `contact_messages` con `source=whatsapp`, mostrar un toast o notificación visual inmediata en el panel Live para confirmar que el mensaje llegó.

---

**Archivos a modificar:**
- `supabase/functions/whatsapp-webhook/index.ts` -- logging de diagnóstico
- `src/pages/DataImport.tsx` -- botón de test y feedback visual

**Secretos a configurar:**
- `EVOLUTION_DEFAULT_USER_ID` -- UUID del usuario principal




## Plan: Integracion Multi-Plataforma JARVIS (Telegram + WhatsApp)

### Objetivo
Que JARVIS funcione de forma identica en la app web, Telegram y WhatsApp, compartiendo memoria, contexto y tono (SOUL). El cerebro sigue siendo tu LLM (via `jarvis-coach`, `potus-core`, etc.), no un agente externo.

### Arquitectura

```text
                    +-------------------+
                    |   Tu LLM (Brain)  |
                    |  jarvis-coach     |
                    |  potus-core       |
                    |  ai-client.ts     |
                    +--------+----------+
                             |
                    +--------+----------+
                    | jarvis-gateway    |
                    | (nueva edge fn)   |
                    +---+-----+-----+---+
                        |     |     |
              +---------+  +--+--+  +----------+
              |            |     |             |
         +----+----+  +---+---+ +----+----+  
         |  App Web |  |Telegram| |WhatsApp |  
         | (actual) |  |  Bot   | |  Bot    |  
         +---------+  +--------+ +---------+  
                             |
                    +--------+----------+
                    |  Memoria Compartida |
                    |  jarvis_memory      |
                    |  specialist_memory  |
                    |  potus_chat         |
                    +--------------------+
```

### Paso 1: Edge function `jarvis-gateway`

Nueva edge function que actua como punto de entrada unificado para todas las plataformas. Recibe mensajes de cualquier origen y los enruta al especialista correcto.

**Archivo:** `supabase/functions/jarvis-gateway/index.ts`

**Responsabilidades:**
- Recibir mensajes con `platform` (web, telegram, whatsapp) y `user_id`
- Cargar contexto del usuario (memoria, WHOOP, tareas, etc.)
- Detectar especialista (reutiliza logica de `potus-core`)
- Llamar al LLM correspondiente (coach, nutrition, english, etc.)
- Guardar mensaje y respuesta en `potus_chat` con columna `platform`
- Devolver respuesta texto (que luego cada bot formatea para su plataforma)

### Paso 2: Edge function `telegram-webhook`

**Archivo:** `supabase/functions/telegram-webhook/index.ts`

**Responsabilidades:**
- Recibir updates de Telegram Bot API
- Extraer texto del mensaje (o transcribir audio si es mensaje de voz)
- Identificar al usuario (mapeo telegram_user_id -> supabase user_id via tabla)
- Llamar a `jarvis-gateway` internamente
- Enviar respuesta via Telegram Bot API
- Soportar comandos basicos: `/start`, `/tareas`, `/agenda`, `/estado`

**Secreto requerido:** `TELEGRAM_BOT_TOKEN` (se obtiene de @BotFather)

### Paso 3: Edge function `whatsapp-webhook`

**Archivo:** `supabase/functions/whatsapp-webhook/index.ts`

**Responsabilidades:**
- Recibir webhooks de WhatsApp Business API (via Meta o Twilio)
- Extraer texto del mensaje
- Identificar usuario (mapeo phone_number -> supabase user_id)
- Llamar a `jarvis-gateway` internamente
- Enviar respuesta via WhatsApp API
- Manejar verificacion de webhook (challenge de Meta)

**Secreto requerido:** `WHATSAPP_API_TOKEN` y `WHATSAPP_PHONE_ID` (o `TWILIO_AUTH_TOKEN` si usas Twilio)

### Paso 4: Migracion de base de datos

**Cambios en tablas existentes:**

1. **`potus_chat`** - Agregar columna `platform`:
   - `platform TEXT DEFAULT 'web'` (valores: web, telegram, whatsapp)
   - Esto permite ver desde que plataforma se envio cada mensaje

2. **Nueva tabla `platform_users`** - Mapeo de identidades:
   - `id UUID PRIMARY KEY`
   - `user_id UUID REFERENCES auth.users(id)` -- usuario Supabase
   - `platform TEXT NOT NULL` -- telegram, whatsapp
   - `platform_user_id TEXT NOT NULL` -- telegram chat_id o phone number
   - `display_name TEXT`
   - `created_at TIMESTAMPTZ`
   - `UNIQUE(platform, platform_user_id)`

3. **`user_integrations`** - Agregar columnas:
   - `telegram_chat_id TEXT`
   - `whatsapp_phone TEXT`
   - `potus_webhook_url TEXT` (ya se usa en potus-webhook pero falta en schema)

### Paso 5: Sincronizacion de contexto

La memoria ya es compartida por diseno:
- `jarvis_memory` - memoria a largo plazo con `get_jarvis_context()`
- `specialist_memory` - memorias por especialista
- `shared_memory` - memoria inter-nodos
- `potus_chat` - historial de conversaciones

El `jarvis-gateway` cargara SIEMPRE el mismo contexto independientemente de la plataforma, usando las mismas queries que ya usan `jarvis-coach` y `potus-core`. Esto garantiza consistencia de tono y personalidad.

### Paso 6: Vinculacion de cuentas

Para que Telegram/WhatsApp sepa quien eres, necesitas un flujo de vinculacion:

1. En la app web (Settings), seccion "Integraciones":
   - Boton "Vincular Telegram" -> genera codigo unico temporal
   - Boton "Vincular WhatsApp" -> muestra QR o numero para enviar codigo
2. En Telegram: envias `/vincular CODIGO` al bot
3. La edge function valida el codigo y crea el registro en `platform_users`

**Archivo a modificar:** `src/pages/Settings.tsx` - Nueva tarjeta de integraciones

### Paso 7: Consistencia del SOUL

El system prompt de JARVIS se carga desde los RAGs compartidos (`coach-personal-rag.md`, etc.) y el perfil del usuario (`user_profile`). Como `jarvis-gateway` usa las mismas funciones (`buildAgentPrompt`, `getUserContext`), el tono es identico en todas las plataformas.

No se necesita configuracion adicional: el SOUL ya esta en la base de datos y los RAGs.

### Resumen de archivos

| Archivo | Accion |
|---------|--------|
| `supabase/functions/jarvis-gateway/index.ts` | NUEVO - Gateway unificado |
| `supabase/functions/telegram-webhook/index.ts` | NUEVO - Bot Telegram |
| `supabase/functions/whatsapp-webhook/index.ts` | NUEVO - Bot WhatsApp |
| `src/pages/Settings.tsx` | MODIFICAR - UI vinculacion |
| DB migration | NUEVO - tabla platform_users, columna platform en potus_chat |

### Secretos necesarios

| Secreto | Para que |
|---------|----------|
| `TELEGRAM_BOT_TOKEN` | Comunicacion con Telegram Bot API |
| `WHATSAPP_API_TOKEN` | Comunicacion con WhatsApp Business API |
| `WHATSAPP_PHONE_ID` | ID del numero de WhatsApp Business |

### Orden de implementacion recomendado

1. Migracion DB (platform_users + columna platform)
2. `jarvis-gateway` (gateway unificado)
3. `telegram-webhook` (mas facil de configurar, gratis)
4. UI de vinculacion en Settings
5. `whatsapp-webhook` (requiere cuenta Business de Meta, mas complejo)

### Pregunta clave

Para Telegram solo necesitas crear un bot con @BotFather y darme el token. Para WhatsApp tienes dos opciones:
- **WhatsApp Business API via Meta** (gratis para volumen bajo, requiere verificacion de negocio)
- **Twilio** (mas facil de configurar, tiene coste por mensaje)

Puedo empezar con Telegram primero ya que es mas sencillo y gratuito.


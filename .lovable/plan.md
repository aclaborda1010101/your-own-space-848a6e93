

# Bloque 2: Edge Function `jarvis-daily-scan` - Analisis Cruzado

## Objetivo

Crear una Edge Function que recopile datos de todas las fuentes (tareas, calendario iCloud, emails, conversaciones WhatsApp/Telegram, transcripciones Plaud) y use IA para detectar gaps: tareas implicitas no registradas, reuniones mencionadas sin entrada en calendario, urgencias pasadas por alto y seguimientos olvidados.

Los resultados se guardan como `suggestions` para que el usuario los apruebe/rechace desde la app.

---

## Arquitectura

La funcion sigue este flujo:

1. Autenticar usuario (via Bearer token)
2. Recopilar datos de 5 fuentes en paralelo:
   - Tareas pendientes (tabla `tasks`)
   - Calendario iCloud (llamada interna a `icloud-calendar`)
   - Emails recientes (tabla `jarvis_emails_cache`, ultimas 48h)
   - Conversaciones recientes (tabla `jarvis_conversations`, ultimas 48h)
   - Transcripciones recientes (tabla `transcriptions`, ultimas 48h)
3. Construir prompt con todo el contexto
4. Enviar a Gemini Flash (rapido y barato) pidiendo JSON estructurado
5. Guardar cada sugerencia en la tabla `suggestions` con tipos nuevos
6. Devolver resumen al frontend

---

## Cambios necesarios

### 1. Nueva Edge Function: `supabase/functions/jarvis-daily-scan/index.ts`

- Usa `ai-client.ts` compartido (Gemini Flash por defecto)
- Recopila datos con queries paralelas a Supabase
- Para calendario, hace fetch interno a la Edge Function `icloud-calendar` existente
- Prompt de sistema en espanol pidiendo JSON con estructura:

```text
{
  "suggestions": [
    {
      "type": "missing_task" | "missing_event" | "urgency_alert" | "forgotten_followup",
      "title": "string",
      "description": "string", 
      "source_channel": "email" | "whatsapp" | "plaud" | "calendar",
      "priority": "high" | "medium" | "low",
      "raw_reference": "texto original que motiva la sugerencia"
    }
  ],
  "summary": "resumen ejecutivo de 2-3 lineas"
}
```

- Cada sugerencia se inserta en la tabla `suggestions` con:
  - `suggestion_type` = el type del JSON
  - `content` = JSON con title, description, source_channel, priority, raw_reference
  - `status` = 'pending'

### 2. Configuracion en `supabase/config.toml`

Agregar:
```text
[functions.jarvis-daily-scan]
verify_jwt = false
```

### 3. Frontend: Card de sugerencias en Dashboard

No se incluye en este bloque (sera parte del Bloque 6). Las sugerencias quedan en la tabla `suggestions` listas para consumir.

---

## Detalles tecnicos

### Recopilacion de datos (queries paralelas)

```text
// Todas en paralelo con Promise.all
1. tasks: SELECT * FROM tasks WHERE user_id = X AND completed = false
2. emails: SELECT * FROM jarvis_emails_cache WHERE user_id = X AND synced_at > now() - interval '48 hours' LIMIT 50
3. conversations: SELECT * FROM jarvis_conversations WHERE user_id = X AND created_at > now() - interval '48 hours' ORDER BY created_at DESC LIMIT 100
4. transcriptions: SELECT * FROM transcriptions WHERE user_id = X AND created_at > now() - interval '48 hours'
5. calendar: fetch interno a icloud-calendar con el token del usuario
```

### Prompt de IA

El prompt incluira:
- Lista de tareas pendientes con sus fechas
- Resumen de emails recientes (remitente + asunto + preview)
- Mensajes de WhatsApp/Telegram recientes
- Transcripciones de Plaud con resumen
- Eventos del calendario proximos 7 dias
- Instruccion clara: "Detecta lo que falta, lo urgente no registrado, los seguimientos olvidados"

### Modelo y coste

- Modelo: `gemini-flash` (gemini-2.0-flash) - rapido, barato, suficiente para analisis
- Temperature: 0.3 (queremos precision, no creatividad)
- Max tokens: 4096

### Prevencion de duplicados

Antes de insertar cada sugerencia, se verifica que no exista una con el mismo `suggestion_type` y titulo similar (usando ILIKE) en las ultimas 24h para evitar sugerencias repetidas en ejecuciones consecutivas.

---

## Secuencia de implementacion

1. Crear `supabase/functions/jarvis-daily-scan/index.ts`
2. Agregar configuracion en `config.toml`
3. Deploy automatico de la Edge Function
4. Test manual con curl para verificar


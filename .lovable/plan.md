

# Fase 1: Migracion de base de datos — Nuevas columnas en jarvis_emails_cache

## Columnas actuales
La tabla `jarvis_emails_cache` tiene: `id`, `account`, `from_addr`, `subject`, `is_read`, `synced_at`, `user_id`, `preview`, `created_at`, `message_id`.

## Columnas a agregar

Se anadiran ~22 columnas nuevas en una sola migracion:

```text
-- Contenido
to_addr             text
cc_addr             text
bcc_addr            text          -- solo se rellena en emails enviados
body_text           text          -- truncado a 50,000 chars
body_html           text
reply_to_id         text          -- header In-Reply-To
thread_id           text          -- Gmail threadId o generado
direction           text          -- 'sent'/'received'
received_at         timestamptz   -- fecha real del email

-- Adjuntos
has_attachments     boolean       DEFAULT false
attachments_meta    jsonb         -- [{name, type, size}], incluye .ics detectados

-- Firma
signature_raw       text
signature_parsed    jsonb         -- {cargo, empresa, telefono, direccion, linkedin, web}

-- Clasificacion (pre-IA)
email_type          text          -- 'personal'/'newsletter'/'notification'/'auto_reply'/'calendar_invite'
importance          text          -- 'high'/'normal'/'low'
is_forwarded        boolean       DEFAULT false
original_sender     text          -- en FW: quien escribio el original
is_auto_reply       boolean       DEFAULT false
email_language      text          -- 'es'/'en'/'fr'...

-- Analisis IA
ai_processed        boolean       DEFAULT false
ai_extracted        jsonb         -- resultado completo del analisis
```

## Indices
- `idx_emails_ai_unprocessed` en `(user_id, ai_processed)` WHERE `ai_processed = false` -- para el cron de email-intelligence
- `idx_emails_thread` en `(thread_id)` -- para agrupar hilos
- `idx_emails_type` en `(email_type)` -- para filtrar newsletters/notificaciones

## Ajustes del usuario incorporados

1. **Reprocesamiento con pre-clasificacion**: cuando se reprocesen los 138 emails existentes (fase 2, paso 4), se aplicara PRIMERO la logica de pre-clasificacion (List-Unsubscribe, noreply@, etc.) ANTES de descargar el body. Asi no se desperdicia ancho de banda descargando cuerpos de newsletters.

2. **Adjuntos .ics como citas directas**: se anade `email_type = 'calendar_invite'` como valor posible. Los .ics se parsearan automaticamente (fecha, hora, lugar, asistentes) sin pasar por IA, ya que el formato iCalendar es estandar y mas fiable que interpretacion de texto libre. Esto se refleja en `attachments_meta` que incluira un flag `is_ics: true` con los datos parseados.

## Detalle tecnico

La migracion solo agrega columnas con defaults o nullable -- no rompe nada existente. Los 138 emails actuales seguiran funcionando con las columnas nuevas en NULL hasta que se reprocesen en la fase 2.


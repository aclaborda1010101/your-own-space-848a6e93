
# Plan: Sistema Operativo JARVIS - Tareas Inteligentes + Analisis de Canales

Este plan convierte JARVIS de una app pasiva a un sistema proactivo que cruza informacion de tareas, calendario, emails, WhatsApp y Plaud para detectar lo que te falta.

---

## Bloque 1: Tareas con fecha de entrega y auto-priorizacion

### Cambios en base de datos
- Agregar columna `due_date` (date, nullable) a la tabla `tasks`
- Agregar prioridad `P3` como valor valido
- Agregar columna `source` (text, default 'manual') para saber de donde vino la tarea (manual, email, whatsapp, plaud)

### Cambios en frontend
- **`useTasks.tsx`**: Actualizar interfaz `Task` para incluir `dueDate` y prioridad `P3`. Agregar logica de auto-priorizacion basada en `due_date`:
  - P0: vence hoy o ya vencida
  - P1: vence en 1-3 dias
  - P2: vence en 4-7 dias
  - P3: vence en mas de 7 dias o sin fecha
- **`Tasks.tsx`**: Agregar selector de fecha al formulario de creacion. Mostrar fecha de entrega en cada tarea. Ordenar por urgencia.
- **`PrioritiesCard.tsx`**: Soportar P3 con nuevo color.

---

## Bloque 2: Edge Function de analisis cruzado (`jarvis-daily-scan`)

Nueva Edge Function que se ejecutara periodicamente (via cron o manualmente) y hara:

1. **Leer tareas pendientes** del usuario
2. **Leer eventos del calendario** (proximos 7 dias via iCloud CalDAV)
3. **Leer emails recientes** de `jarvis_emails_cache` (ultimas 24-48h)
4. **Leer mensajes WhatsApp recientes** de `jarvis_conversations` (si existe) o del historial del gateway
5. **Leer transcripciones Plaud recientes** de `transcriptions`

Con toda esa informacion, usar Claude para:
- Detectar tareas implicitas en emails/WhatsApp no reflejadas en la lista de tareas
- Detectar reuniones mencionadas en conversaciones no presentes en el calendario
- Detectar urgencias no priorizadas
- Generar un reporte de "gaps" (cosas que te faltan)

El resultado se guarda en la tabla `suggestions` existente para que el usuario apruebe/rechace desde la app.

### Modelo de datos
- Reutiliza la tabla `suggestions` ya existente (campos: `user_id`, `suggestion_type`, `content`, `status`)
- Nuevos tipos de sugerencia: `missing_task`, `missing_event`, `urgency_alert`, `forgotten_followup`

---

## Bloque 3: Integracion Email activa

### Estado actual
- La Edge Function `email-sync` ya sincroniza Gmail y Outlook a `jarvis_emails_cache`
- La Edge Function `plaud-email-check` ya busca emails de Plaud y los envia a `process-transcription`
- Falta: **analisis activo de emails normales** (no solo Plaud)

### Cambios
- Agregar en `email-sync` (o nueva funcion `email-analyzer`) logica para que tras sincronizar, envie los emails nuevos a un analizador IA que extraiga:
  - Tareas implicitas ("necesito que me envies X")
  - Reuniones propuestas ("podemos quedar el jueves?")
  - Urgencias ("es urgente", "deadline manana")
- Los resultados se guardan como `suggestions` para aprobacion del usuario

---

## Bloque 4: Integracion WhatsApp activa

### Estado actual
- `whatsapp-webhook` recibe mensajes y los envia a `jarvis-gateway` para respuesta
- Los mensajes del usuario se procesan pero no se analizan sistematicamente

### Cambios
- Modificar `whatsapp-webhook` para que ademas de responder, guarde los mensajes recibidos en una tabla `whatsapp_messages_log` (o reutilice `jarvis_conversations`)
- La funcion `jarvis-daily-scan` leer ese historial y detectara tareas/reuniones implicitas

---

## Bloque 5: Plaud optimizado via Outlook

### Estado actual
- `plaud-email-check` ya busca emails de Plaud en `jarvis_emails_cache` y los procesa con `process-transcription`
- `process-transcription` ya clasifica en 3 cerebros, extrae tareas, ideas, personas, compromisos

### Cambios necesarios
- Asegurar que la busqueda en `plaud-email-check` incluya el patron de emails de Plaud desde Outlook (verificar filtros `from_address`/`subject`)
- Agregar cron job para ejecutar `email-sync` + `plaud-email-check` automaticamente cada 30 min
- Asegurar que las tareas extraidas de Plaud se inserten directamente en la tabla `tasks` (actualmente solo van a `suggestions`)

---

## Secuencia de implementacion

1. Migracion DB: agregar `due_date` y `source` a `tasks`
2. Actualizar frontend de tareas (formulario + priorizacion automatica)
3. Crear Edge Function `jarvis-daily-scan` (analisis cruzado)
4. Modificar `whatsapp-webhook` para guardar historial
5. Crear/configurar cron jobs para ejecucion automatica
6. Integrar resultados del scan en el Dashboard (card de alertas)

---

## Detalles tecnicos

### Migracion SQL
```text
ALTER TABLE tasks ADD COLUMN due_date date;
ALTER TABLE tasks ADD COLUMN source text DEFAULT 'manual';
```

### Auto-priorizacion (logica en frontend)
```text
function autoPriority(dueDate: Date | null): string {
  if (!dueDate) return 'P3';
  const daysUntil = diffInDays(dueDate, today);
  if (daysUntil <= 0) return 'P0';
  if (daysUntil <= 3) return 'P1';
  if (daysUntil <= 7) return 'P2';
  return 'P3';
}
```

### Edge Function `jarvis-daily-scan`
- Modelo: Claude Haiku (rapido y barato para analisis)
- Input: tareas + calendario + emails + whatsapp + transcripciones recientes
- Output: array de sugerencias tipadas
- Timeout: standard (no requiere generacion larga)

### Cron jobs necesarios (via pg_cron)
- `email-sync`: cada 30 minutos
- `plaud-email-check`: cada 30 minutos (tras email-sync)
- `jarvis-daily-scan`: 3 veces al dia (8:00, 13:00, 19:00)

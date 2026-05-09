# Alerta de gasto automático diario de IA

## Objetivo
Avisarte cuando el consumo **automático** de IA (sin chats manuales con JARVIS/POTUS ni Project Wizard) supere un umbral diario que tú definas.

## Qué se considera "automático"
Operaciones que se disparan sin que tú escribas un prompt:
- `transcribe-audio` (notas de voz WhatsApp)
- `vision-image` (imágenes WhatsApp)
- `shopping-list-auto`
- `jarvis-history-ingest`
- Cualquier otra operación futura que no sea `ai-client:chat` ni operaciones del Project Wizard (`budget_estimation`, `extract_briefing`, `ai_audit_internal`, `generate_scope_internal`, etc.)

Lista de operaciones manuales a **excluir** se mantiene en una constante en el edge function (fácil de editar).

## Componentes

### 1. Edge function `ai-cost-daily-alert` (nuevo)
- Lee `project_costs` de las últimas 24h filtrando por `operation NOT IN (lista_manual)`
- Suma `cost_usd`
- Si supera `threshold_usd` → inserta notificación + envía push (usa `send-push-notification` ya existente)
- Idempotente: no envía dos alertas el mismo día para el mismo umbral

### 2. Schedule (pg_cron)
- Migración SQL que programa el edge function 1 vez al día a las 09:00 UTC
- Usa `pg_net` para invocar la función (mismo patrón que otros cron del proyecto)

### 3. Configuración del umbral
Dos opciones, elige una en la pregunta de abajo:
- **A)** Constante en código (ej. `THRESHOLD_USD = 0.10`) — simple, requiere editar para cambiar
- **B)** Tabla `ai_cost_alert_config` con UI en `/ai-costs` para ajustar umbral desde la app

## Archivos a crear/editar
- `supabase/functions/ai-cost-daily-alert/index.ts` (nuevo)
- `supabase/migrations/<timestamp>_ai_cost_alert_cron.sql` (cron + tabla opción B)
- `src/components/ai-costs/AICostAlertConfig.tsx` (solo si opción B)
- `src/pages/AICosts.tsx` (montar el card, solo opción B)

## Preguntas
1. **Umbral diario** que dispara la alerta (consumo automático): ¿$0.05, $0.10, $0.25, otro?
2. **Configuración**: ¿constante en código (A) o ajustable desde UI (B)?
3. **Canal**: ¿push notification + registro en notificaciones in-app, o solo notificación in-app?

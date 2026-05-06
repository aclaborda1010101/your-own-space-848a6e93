
# Diagnóstico: ¿qué hace Jarvis solo y por qué se come $50?

## Lo que encontré

`project_costs` solo registra ~$0.24 en 7 días (esa tabla solo trackea el wizard). Los $50 vienen de **5 cron jobs en `pg_cron`** que llaman edge functions que a su vez llaman a Lovable AI Gateway sin pasar por el tracker.

| # | Cron job | Frecuencia | Llamadas/día | Llama a IA | Coste estimado |
|---|---|---|---|---|---|
| 1 | `jarvis-history-backfill-cron` → `jarvis-history-ingest` | **cada 5 min** | 288 | **SÍ (LLM por mensaje)** | **MUY ALTO** ⚠️ |
| 2 | `dispatch-scheduled-notifications` | **cada 1 min** | 1440 | indirecto (puede disparar IA) | MEDIO |
| 3 | `email-sync-auto` | cada 28 min | 51 | dispara `plaud-fetch` (Whisper + clasif.) | ALTO |
| 4 | `contact-profiles-refresh-all` → `contact-analysis` | diario 02:00 | 1×N contactos | **SÍ (LLM por contacto)** | **ALTO** ⚠️ |
| 5 | `reimport-whatsapp-recent` → `process-whatsapp-media` | diario 03:00 | 1×N media | **SÍ (Whisper + Gemini Vision)** | ALTO |

**Sospechosos principales de los $50:**
- `jarvis-history-backfill-cron` cada 5 min ingiere y embebe historial → si tienes mucho histórico WhatsApp/email, esto solo puede valer decenas de $.
- `contact-profiles-refresh-all` perfila TODOS los contactos cada noche con LLM (uno a uno).
- `process-whatsapp-media` reprocesa multimedia de últimos 3 días cada noche (Whisper + Vision).

## Plan propuesto (migración SQL, reversible)

### Paso 1 — Apagar lo que más probablemente está sangrando
```sql
-- backfill de historial: pasar de cada 5 min a 1× al día (o pausar)
SELECT cron.unschedule('jarvis-history-backfill-cron');
SELECT cron.schedule('jarvis-history-backfill-cron', '0 4 * * *', $$ ... $$);

-- refresh de TODOS los contactos cada noche → semanal
SELECT cron.unschedule('contact-profiles-refresh-all-daily');
SELECT cron.schedule('contact-profiles-refresh-all-weekly', '0 2 * * 0', $$ ... $$);

-- reimport multimedia WhatsApp diario → semanal
SELECT cron.unschedule('reimport-whatsapp-multimedia-daily');
SELECT cron.schedule('reimport-whatsapp-multimedia-weekly', '0 3 * * 0', $$ ... $$);
```

### Paso 2 — Reducir frecuencia de los baratos
- `dispatch-scheduled-notifications`: cada 1 min → cada 5 min (suficiente para notificaciones).
- `email-sync-auto`: cada 28 min → cada 2 horas.

### Paso 3 — Instrumentar coste real
Añadir `recordCost()` (de `_shared/cost-tracker.ts`) a las 3 funciones que NO lo trackean:
- `jarvis-history-ingest`
- `contact-analysis`
- `process-whatsapp-media`

Así en `/ai-costs` verás exactamente quién gasta qué.

### Paso 4 — Verificación
- `SELECT * FROM cron.job` para confirmar cambios.
- Revisar `/ai-costs` dentro de 24-48h con datos reales.

## Lo que NO toco
- Wizard, Jarvis chat manual, POTUS → solo se ejecutan cuando los usas.
- RLS y seguridad → sin cambios.

## Decisión que necesito de ti

¿Quieres que aplique el plan **agresivo** (apagar/semanalizar los 3 caros + reducir los 2 baratos + instrumentar tracking), o prefieres una versión más conservadora (solo bajar frecuencias, sin pasar a semanal)?

Si dices "adelante" aplico el plan agresivo tal cual.

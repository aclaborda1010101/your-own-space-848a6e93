# Auditoría y control del consumo de Lovable AI

## Diagnóstico

El error de runtime confirma `402 Créditos AI agotados` desde el AI Gateway. Análisis de datos:

**Cron jobs activos** (ninguno hace bucles infinitos de IA):
- `dispatch-scheduled-notifications` cada minuto → no llama IA ✅
- `email-sync-auto` cada 2h → no llama IA ✅
- `jarvis-history-backfill-cron` diario → llama IA pero registra coste, ~$0.0001/run
- 2 jobs semanales menores

**Top operaciones por coste (últimos 30 días, lo que SÍ se registra en `project_costs`):**

| Operación | Modelo | Llamadas | USD |
|---|---|---:|---:|
| `budget_estimation` (project-wizard) | claude-sonnet | 17 | **$1.78** |
| `ai_audit_internal` | gemini-pro | 3 | $0.87 |
| `generate_scope_internal` | gemini-3.1-pro | 3 | $0.66 |
| `ai-client:chat` (jarvis) | gemini-3.1-pro | 100 | $0.11 |
| Resto | varios | ~150 | $0.23 |
| **Total registrado** | | | **~$3.65** |

El balance gratuito mensual del AI Gateway es ~$1, así que **$3.65 ya supera el free tier** y explica el 402. Pero hay mucho gasto que **NO se registra**: 26 funciones llaman al gateway y al menos 4 importantes no usan `cost-tracker`.

## Causas del consumo

1. **`budget_estimation` con Claude Sonnet** es el mayor culpable individual: 17 llamadas → $1.78. Cada estimación cuesta ~$0.10. El project-wizard la lanza en F5/F6.
2. **`ai_audit_internal` y `generate_scope_internal` con Gemini Pro** son llamadas únicas pero pesadas (~$0.30 cada una).
3. **Funciones sin tracking** que pueden estar sumando coste invisible: `ai-news`, `daily-briefing`, `daily-context-brief`, `pattern-detector-*`, `auto-research`, `finance-auto-goals`, `jarvis-agent`, `jarvis-unified`, `nutrition-recipe`, `openclaw-chat`, `search-rag`, `whoop-health-summary`, `plaud-classify`, etc.
4. **`process-whatsapp-media`** se dispara por cada audio/imagen entrante por webhook → coste proporcional al volumen WhatsApp.

## Plan de acción

### Paso 1 — Instrumentación universal (visibilidad real)
Añadir `trackAICost`/`recordCost` en TODAS las funciones que llaman al gateway sin registro. Crear un helper `callLovableAI()` en `_shared/ai-gateway.ts` que envuelve la llamada + el tracking + manejo de 402/429, y migrar las 22 funciones identificadas a usarlo. Así nada nuevo escapa a la contabilidad.

### Paso 2 — Reducir el coste de los pesos pesados
- **`budget_estimation`**: cambiar Claude Sonnet → Gemini 3.1 Pro (10x más barato) o Gemini 3 Flash si la calidad aguanta. Cachear el resultado por `project_id` para no recalcular en cada apertura del wizard.
- **`ai_audit_internal` / `generate_scope_internal`**: pasar de `gemini-3.1-pro-preview` a `gemini-3-flash-preview` para borradores; reservar Pro solo para la versión final que el usuario confirma.

### Paso 3 — Guardas para evitar bucles
- Añadir un rate-limit simple por `user_id + operation` en `_shared/cost-tracker.ts` (p.ej. máx N llamadas/hora por operación cara). Si se supera, devolver 429 antes de llamar al gateway.
- En `process-whatsapp-media`: deduplicar por `message_id` para no reprocesar el mismo media si el webhook se repite.

### Paso 4 — Panel de control
Mejorar `/ai-costs` con:
- Top 10 operaciones del mes con coste y nº de llamadas.
- Coste por usuario.
- Alerta visual cuando una operación supere un umbral.
- Botón "pausar" por operación (escribe en una tabla `ai_kill_switch`; el helper `callLovableAI` consulta y bloquea).

### Paso 5 — Configurar límite de gasto en el workspace de Lovable
(Acción manual, fuera de código) — En **Settings → Cloud & AI balance**, añadir saldo o un cap mensual para que un bug nunca pueda fundir cientos de USD.

## Detalle técnico

- Nuevo archivo `supabase/functions/_shared/ai-gateway.ts`:
  ```ts
  export async function callLovableAI({ model, messages, operation, userId, projectId }) {
    // 1. comprobar kill_switch
    // 2. comprobar rate-limit (count en project_costs últimas X min)
    // 3. fetch al gateway con manejo 402/429
    // 4. recordCost al final (siempre, también en error)
  }
  ```
- Nueva tabla `ai_kill_switch (operation text pk, paused boolean, max_per_hour int)`.
- Nueva vista SQL `ai_cost_top_operations` para alimentar `/ai-costs`.
- Migración a `callLovableAI` en las 22 funciones sin tracker; en las 4 que ya usan `recordCost` directo, se conserva pero se añade el chequeo de kill_switch.

## Fuera de alcance

- No tocamos los crons existentes (no son la causa).
- No cambiamos modelos en chats interactivos (`jarvis-agent`, `jarvis-unified`) — solo en pipelines batch caros.
- No se tocan prompts de calidad del wizard.

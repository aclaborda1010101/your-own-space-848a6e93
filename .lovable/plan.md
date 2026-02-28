

## Diagnóstico: Tracking de costes IA incompleto

### Problema 1: Solo se trackean costes del Project Wizard

La tabla `project_costs` **solo recibe datos de `project-wizard-step`**. Ninguna otra Edge Function registra costes. El $1.60 mostrado es solo una fracción del gasto real.

**Edge Functions que llaman a APIs de IA sin registrar coste:**

| Edge Function | Modelo usado | Trackea coste? |
|---|---|---|
| `project-wizard-step` | Claude Sonnet 4, Gemini Flash/Pro | ✅ Sí |
| `jarvis-core` | Gemini Flash | ❌ No |
| `jarvis-realtime` | Claude Sonnet 4 | ❌ No |
| `smart-notifications` | Gemini Flash | ❌ No |
| `speech-to-text` | Whisper | ❌ No |
| `rag-architect` | Gemini Flash/Pro + Claude | ❌ No |
| `generate-english-chunks` | Gemini | ❌ No |
| `shopping-list-generator` | Gemini | ❌ No |
| `categorize-transactions` | Gemini | ❌ No |
| `finance-auto-goals` | Gemini | ❌ No |
| `generate-document` | — (no IA, solo DOCX) | N/A |

### Problema 2: Un rate incorrecto

En `project-wizard-step`, Gemini 2.5 Pro tiene output rate `$10.00/M` cuando debería ser `$5.00/M`. Duplica el coste de ese modelo.

### Plan de solución

**Fase 1 — Crear helper compartido de cost tracking**

Crear `supabase/functions/_shared/cost-tracker.ts` con:
- Función `recordCost(supabase, params)` reutilizable
- Rates centralizados y actualizados
- Helper para calcular coste desde tokens

**Fase 2 — Instrumentar las Edge Functions principales**

Añadir `recordCost()` en cada función que llama a IA, empezando por las de mayor volumen:
1. `jarvis-core` — cada respuesta del plan diario
2. `jarvis-realtime` — cada mensaje de chat (Claude Sonnet 4, el más caro)
3. `smart-notifications` — cada generación
4. `speech-to-text` — cada transcripción (Whisper, coste por minuto)
5. `rag-architect` — cada job de fetch/embed/enrich
6. `generate-english-chunks`, `shopping-list-generator`, `categorize-transactions`, `finance-auto-goals`

**Fase 3 — Corregir rate de Gemini Pro**

En `project-wizard-step/index.ts` línea 726: cambiar output de `10.00` a `5.00`.

**Fase 4 — Actualizar el dashboard**

En `AICostTrackerCard`: quitar el filtro `user_id` del wizard y mostrar todas las llamadas, agrupadas por función además de por modelo.

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `supabase/functions/_shared/cost-tracker.ts` | Crear — helper compartido |
| `supabase/functions/project-wizard-step/index.ts` | Fix rate Gemini Pro |
| `supabase/functions/jarvis-core/index.ts` | Añadir tracking |
| `supabase/functions/jarvis-realtime/index.ts` | Añadir tracking |
| `supabase/functions/smart-notifications/index.ts` | Añadir tracking |
| `supabase/functions/speech-to-text/index.ts` | Añadir tracking |
| `supabase/functions/rag-architect/index.ts` | Añadir tracking |
| `supabase/functions/generate-english-chunks/index.ts` | Añadir tracking |
| `supabase/functions/shopping-list-generator/index.ts` | Añadir tracking |
| `supabase/functions/categorize-transactions/index.ts` | Añadir tracking |
| `supabase/functions/finance-auto-goals/index.ts` | Añadir tracking |
| `src/components/settings/AICostTrackerCard.tsx` | Mejorar dashboard |

### Resultado esperado

El coste real de la app será significativamente mayor que $1.60 — probablemente $5-15+ considerando todas las llamadas a `jarvis-realtime` (Claude Sonnet 4 a $15/M output) y `rag-architect`.


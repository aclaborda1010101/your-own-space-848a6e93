

## Plan: Evolución de Señales — Fase 2 (Trial Automático + Panel Admin)

### 1. SQL Migration

Update `improvement_proposals.status` CHECK to add `trial_active` and `graduated`:

```sql
ALTER TABLE improvement_proposals DROP CONSTRAINT IF EXISTS improvement_proposals_status_check;
ALTER TABLE improvement_proposals ADD CONSTRAINT improvement_proposals_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'trial_active', 'graduated', 'rolled_back'));
ALTER TABLE improvement_proposals ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE improvement_proposals ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
ALTER TABLE improvement_proposals ADD COLUMN IF NOT EXISTS version_before INTEGER;
ALTER TABLE improvement_proposals ADD COLUMN IF NOT EXISTS version_after INTEGER;
```

Also add `proposal_id` to `model_change_log`:
```sql
ALTER TABLE model_change_log ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES improvement_proposals(id);
```

### 2. Update `learning-observer/index.ts`

Rewrite with all 9 actions:

**Existing (kept):** `diagnose_failing_signal`, `check_failing_signals`

**Updated:** `evaluate_feedback` → V2 with per-signal breakdown from `signals` array param (not match-based since `matches` table doesn't exist in JARVIS — this is for generated apps). Keeps backward compat: accepts either `signal_name`+`was_correct` (Fase 1) or `signals`+`was_correct` (Fase 2 batch).

**New actions:**
- `approve_proposal(project_id, proposal_id)` → marks approved + calls `startSignalTrial`
- `reject_proposal(project_id, proposal_id, reason?)` → marks rejected + logs event
- `start_signal_trial(project_id, proposal_id)` → inserts trial signal in `signal_registry` + `signal_performance`, updates proposal to `trial_active`
- `evaluate_trial_signals(project_id)` → scans trial signals with 10+ evals, graduates (>+5%) or rejects (<-10%)
- `rollback_change(project_id, change_id)` → reverts a graduation
- `calculate_layer_value(project_id)` → computes incremental accuracy per layer

Helper functions: `graduateSignal`, `rejectSignal`, `getNextVersion`

After each `evaluate_feedback` call, automatically invoke `evaluateTrialSignals`.

### 3. Update PRD prompts (`projectPipelinePrompts.ts`)

In `buildPrdPart2Prompt` (lines 688-708), expand the pattern detector services block to include the admin learning panel specification:

```
PANEL ADMIN DE APRENDIZAJE (/admin/learning):
Ruta: /admin/learning — Acceso: rol admin

Tab 1: Rendimiento Global — accuracy global, gráfico semanal, totales
Tab 2: Señales por Capa — agrupadas por layer_id, con status icons
Tab 3: Propuestas de Mejora — pending proposals con Aprobar/Rechazar
Tab 4: Historial de Cambios — timeline de model_change_log
Tab 5: Configuración — modo aprendizaje, umbrales, acciones manuales

Datos: signal_performance, learning_events, improvement_proposals, model_change_log
Acciones: approve_proposal, reject_proposal, rollback_change, check_failing_signals via learning-observer proxy
```

In `buildPrdPart4Prompt` QA checklist (line ~1005), add:
```
- [ ] Panel /admin/learning muestra datos reales de signal_performance
- [ ] Aprobar propuesta inicia trial automáticamente
- [ ] Señales trial se muestran con badge diferenciado
```

In validation prompt (line ~1046), add check for `/admin/learning` panel when pattern_detector is true.

### Files

| File | Action |
|---|---|
| SQL migration | Add statuses + columns to `improvement_proposals`, `proposal_id` to `model_change_log` |
| `supabase/functions/learning-observer/index.ts` | Full rewrite: 9 actions + helper functions |
| `src/config/projectPipelinePrompts.ts` | Admin panel spec in Part 2, QA in Part 4, validation check |


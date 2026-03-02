

## Plan: Ajustes finales de pulido

6 cambios puntuales, bajo riesgo, alto impacto.

---

### 1. SQL Migration -- Defaults defensivos

```sql
ALTER TABLE bl_diagnostics 
  ALTER COLUMN score_drivers SET DEFAULT '{}'::jsonb,
  ALTER COLUMN financial_scenarios SET DEFAULT '{}'::jsonb;

ALTER TABLE bl_recommendations
  ALTER COLUMN dependencies SET DEFAULT '[]'::jsonb;

ALTER TABLE bl_roadmaps
  ALTER COLUMN dependencies_map SET DEFAULT '[]'::jsonb;
```

---

### 2. Edge Function -- 3 micro-guardrails en prompts

**A) `analyze_responses` system prompt (line ~464):** Add before GLOBAL_GUARDRAIL:
- `"No inferir datos que el cliente no haya proporcionado explícitamente."`
- In confidence_level rules, add: `"Si faltan datos críticos → NUNCA puede ser 'alta' aunque el porcentaje sea alto."`
- Add char limits: `"Cada string en score_drivers: máximo 120 caracteres. priority_recommendation: máximo 120 caracteres."`

**B) `generate_recommendations` system prompt (line ~618):** Add:
- `"Las dependencies deben reutilizar exactamente los mismos IDs normalizados en todo el output. No inventar variantes."`

---

### 3. UI DiagnosticTab -- Reorder sections

Current order: Banner → Priority → Confidence → Network → Scores → Scenarios → Findings → Gaps

New order: Banner → Priority → Scores → Confidence → Network → Scenarios → Findings → Gaps

Move the Confidence card block (lines 128-146) to after the Scores grid (after line 193).

---

### Summary

1. SQL migration: add defaults to 4 JSONB columns
2. Edge function: add 3 guardrails to 2 prompts + char limits
3. DiagnosticTab: reorder sections (Priority → Scores → Confidence)
4. Redeploy edge function


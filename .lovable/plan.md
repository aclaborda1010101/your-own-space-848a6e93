

## Plan: Ajustes finos finales de alto impacto en Auditoría IA

8 cambios puntuales que refinan lo ya diseñado. Se combinan las mejoras del plan anterior (pendiente) con estos ajustes finales.

---

### 1. SQL Migration -- Nuevas columnas

Siguiendo la recomendacion de JSONB para datos complejos y columnas simples para filtros:

```sql
-- bl_diagnostics
ALTER TABLE bl_diagnostics ADD COLUMN IF NOT EXISTS score_drivers jsonb;
ALTER TABLE bl_diagnostics ADD COLUMN IF NOT EXISTS confidence_level text;
ALTER TABLE bl_diagnostics ADD COLUMN IF NOT EXISTS confidence_explanation text;
ALTER TABLE bl_diagnostics ADD COLUMN IF NOT EXISTS priority_recommendation text;
ALTER TABLE bl_diagnostics ADD COLUMN IF NOT EXISTS financial_scenarios jsonb;

-- bl_recommendations
ALTER TABLE bl_recommendations ADD COLUMN IF NOT EXISTS dependencies jsonb;
ALTER TABLE bl_recommendations ADD COLUMN IF NOT EXISTS unlocks text;
ALTER TABLE bl_recommendations ADD COLUMN IF NOT EXISTS skip_risk text;
ALTER TABLE bl_recommendations ADD COLUMN IF NOT EXISTS effort_level text;
ALTER TABLE bl_recommendations ADD COLUMN IF NOT EXISTS time_to_value text;

-- bl_roadmaps
ALTER TABLE bl_roadmaps ADD COLUMN IF NOT EXISTS priority_recommendation text;
ALTER TABLE bl_roadmaps ADD COLUMN IF NOT EXISTS dependencies_map jsonb;
```

---

### 2. Edge Function -- `supabase/functions/ai-business-leverage/index.ts`

**A) Prompt `generate_questionnaire` (lines 334-365)**
Add to system prompt:
- "Cada bloque debe contener al menos 3 preguntas. No omitir ningun bloque."
- "Evitar preguntas redundantes entre bloques."
- "Si la informacion del cliente es insuficiente, reducir el nivel de certeza."
- "Usar lenguaje profesional y prudente. Evitar promesas garantizadas."
- Add `block` field to JSON format
- Add thematic blocks: Perfil, Sistemas, Datos/IA, Procesos, Captacion, Mentalidad, Observaciones (campo abierto final obligatorio)
- Minimizar `open` (max 2-3), priorizar `multi_choice` y `single_choice` con rangos
- Sustituir preguntas subjetivas por objetivas

**B) Prompt `analyze_responses` (lines 404-456)**
Add to JSON output format:
- `score_drivers`: object with 4 keys, each array of max 3 strings
- `confidence_level`: "alta"|"media"|"baja" with explicit rules:
  - Alta: >=90% respondidas AND datos criticos completos (herramientas actuales, horas admin, estructura datos, volumen casos)
  - Media: 60-89%
  - Baja: <60% o faltan datos clave
- `confidence_explanation`: string
- `priority_recommendation`: string ("Si solo haces una cosa -> haz esto")
- `financial_scenarios`: `{conservador, probable, optimo}` structured format
- Global guardrail: "Si la informacion es insuficiente, reducir certeza y reflejarlo en confidence_level."
- "Usar lenguaje profesional y prudente."
- Limit: drivers max 3 items each

Save new fields in upsert (lines 462-478).

**C) Prompt `generate_recommendations` (lines 507-579)**
Add to JSON format per recommendation:
- `dependencies`: array of max 3-4 normalized short IDs (e.g. "datos_centralizados", "crm_activo")
- `unlocks`: string <=120 chars
- `skip_risk`: string <=120 chars
- `effort_level`: "low"|"medium"|"high"
- `time_to_value`: "corto"|"medio"|"largo"
- Instruction: "Usar nombres cortos y normalizados para dependencies."
- Guardrail: "Si la informacion del cliente es insuficiente, reducir certeza."
- "Usar lenguaje profesional y prudente."

Save new fields in insert mapping (lines 591-613).

**D) Prompt `generate_roadmap` (lines 642-695)**
- Add: "El roadmap debe ser secuencial y acumulativo, no paralelo."
- Add `priority_recommendation` and `dependencies_map: [{from, to, reason}]` to JSON format
- `from`/`to` must use normalized short IDs matching recommendation dependencies
- "Usar lenguaje profesional y prudente."
- Limit: dependencies_map max 6 entries

Save new fields in insert (lines 705-717).

---

### 3. Hook -- `src/hooks/useBusinessLeverage.tsx`

Update interfaces:
- `QuestionItem`: add `block?: string`
- `Diagnostic`: add `score_drivers?`, `confidence_level?`, `confidence_explanation?`, `priority_recommendation?`, `financial_scenarios?`
- `Recommendation`: add `dependencies?`, `unlocks?`, `skip_risk?`, `effort_level?`, `time_to_value?`
- `Roadmap`: add `priority_recommendation?`, `dependencies_map?`

---

### 4. UI -- `src/components/projects/QuestionnaireTab.tsx`

- Group questions by `block` field if present: render block header with separator before each group
- No functional changes to answer rendering

---

### 5. UI -- `src/components/projects/DiagnosticTab.tsx`

- Add banner: "Basado en X respuestas del cuestionario" (count non-empty keys in responses, passed as new prop `answeredCount`)
- Below each score, show `score_drivers` as small muted bullets
- Add confidence card with badge (alta=green, media=yellow, baja=red) + explanation
- Add highlighted card with `priority_recommendation` at top
- Show `financial_scenarios` in economic section if present

Need to pass `answeredCount` from `BusinessLeverageTabs` -> `DiagnosticTab` (new prop).

---

### 6. UI -- `src/components/projects/RecommendationsTab.tsx`

- Per card: show `effort_level` and `time_to_value` as badges
- Show `dependencies` as small chips
- Show `unlocks` as text below description
- Show `skip_risk` as warning text (subtle)
- Visual order in metrics row: Impact -> Effort -> Time to value

---

### 7. UI -- `src/components/projects/RoadmapTab.tsx`

- Add highlighted card with `priority_recommendation` at top ("Si solo haces una cosa en 90 dias...")
- Add dependencies section showing `dependencies_map` as arrows between phases

---

### 8. `src/components/projects/BusinessLeverageTabs.tsx`

- Pass `answeredCount` (from `responses`) to `DiagnosticTab`

---

### Summary of tasks

1. SQL migration: add columns to 3 tables
2. Update all 4 prompts in edge function + save logic
3. Update TypeScript interfaces in hook
4. Update 4 UI components + BusinessLeverageTabs prop passing
5. Redeploy edge function


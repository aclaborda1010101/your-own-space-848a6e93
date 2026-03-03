

## Plan: Bloque 3 — Integración RAG + Patrones en App Cliente

Bloques 1 y 2 ya implementados. Este plan añade la capa de decisión automática de servicios (RAG/Patrones) y su integración en el PRD generado.

---

### Pieza 1: `services_decision` en Fase 6

**`src/config/projectPipelinePrompts.ts`**
- En `AI_LEVERAGE_SYSTEM_PROMPT` (línea 378): añadir bloque de reglas de detección automática para RAG y Pattern Detector al final del system prompt
- En `buildAiLeveragePrompt` (línea 400): añadir campo `services_decision` al JSON de salida con estructura: `rag` (necesario, confianza, justificación, dominio, fuentes, consultas), `pattern_detector` (necesario, confianza, sector, geografía, objetivo, variables), `deployment_mode`, `data_sensitivity`

**`supabase/functions/project-wizard-step/index.ts`**
- En el prompt inline de `run_ai_leverage` (línea 900-921): sincronizar el mismo bloque `services_decision` en el userPrompt

### Pieza 2: `public_query` para Pattern Detector

**`supabase/functions/pattern-detector-pipeline/index.ts`**
- Añadir `handlePublicQuery(body)` copiando el patrón de `rag-architect` (validar API key, rate limit, devolver layers + scores + verdict)
- Añadir `handleManageApiKeys(userId, body)` (list, create con prefijo `pk_live_`, revoke)
- Registrar ambas acciones en el router HTTP

### Pieza 3: Proxy Edge Functions (documentación en Blueprint)

Las funciones `rag-proxy` y `patterns-proxy` NO se despliegan en AGUSTITO — van en el Blueprint del PRD como código que Lovable genera en el Supabase del cliente. No se crean archivos reales, solo se describen en los prompts.

### Pieza 4: PRD condicional según `services_decision`

**`src/config/projectPipelinePrompts.ts`**
- `buildPrdPart2Prompt`: añadir parámetro `servicesDecision?`, inyectar bloque condicional de servicios externos (módulo Asistente de Conocimiento si RAG, módulo Dashboard de Análisis si Patrones, integraciones proxy)
- `buildPrdPart4Prompt`: añadir parámetro `servicesDecision?`, inyectar sección de Secrets (AGUSTITO_RAG_*, AGUSTITO_PATTERNS_*) y Edge Functions proxy condicionales
- `buildPrdValidationPrompt`: añadir check de consistencia servicios (si RAG=true, verificar módulo + integración)

**`supabase/functions/project-wizard-step/index.ts`**
- En `generate_prd`: leer `services_decision` del output del step 6 (`project_wizard_steps` donde `step_number=6`), pasarlo a los builders Part2 y Part4

### Pieza 5: Override manual en Frontend

**`src/components/projects/wizard/ProjectWizardGenericStep.tsx`**
- Añadir panel condicional cuando `stepNumber === 6` y el output tiene `services_decision`: mostrar toggles para RAG y Pattern Detector con confianza, justificación, y botones de activar/desactivar
- Guardar override en `output_data.services_decision.*.override`

### Pieza 6: Nueva tabla SQL

```sql
CREATE TABLE public.pattern_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES pattern_detection_runs(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  name TEXT DEFAULT 'default',
  is_active BOOLEAN DEFAULT true,
  monthly_usage INTEGER DEFAULT 0,
  monthly_limit INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
ALTER TABLE public.pattern_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Run owner manages keys"
  ON public.pattern_api_keys
  USING (run_id IN (SELECT id FROM pattern_detection_runs WHERE user_id = auth.uid()));
```

---

### Archivos modificados

| Archivo | Cambios |
|---|---|
| `src/config/projectPipelinePrompts.ts` | services_decision en F6, servicios condicionales en F7 Part2/Part4/Validation |
| `supabase/functions/project-wizard-step/index.ts` | Leer services_decision del step 6, pasarlo a PRD builders |
| `supabase/functions/pattern-detector-pipeline/index.ts` | public_query + manage_api_keys |
| `src/components/projects/wizard/ProjectWizardGenericStep.tsx` | Panel override servicios en step 6 |
| Nueva migración SQL | `pattern_api_keys` |

### Sin cambios
- `rag-architect` (public_query ya existe)
- Fases 2-5, 8-9: sin cambios funcionales
- Helpers: `callGeminiPro`, `callClaudeSonnet`, etc.


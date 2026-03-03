

## Plan: Paralelizar Parts 1-3 del PRD con Contexto Compartido ✅ DONE

### Changes applied
1. **`supabase/functions/project-wizard-step/index.ts`** — Bloque `generate_prd`:
   - Construye `sharedContext` con empresa, módulos y roles extraídos del briefing/alcance
   - Parts 1, 2 y 3 ejecutan en `Promise.all()` (~73s vs ~190s secuencial)
   - Parts 2-3 ya NO reciben `result1.text`/`result2.text`, usan `sharedContext`
   - Part 4, validation y linter siguen secuenciales

### What did NOT change
- Prompts de Part 4 y Validation (Call 5): sin cambios
- `callPrdModel`, `callGeminiPro`, `callClaudeSonnet`: sin cambios
- Linter determinista: sin cambios (opera sobre output, no prompts)
- UI: sin cambios

---

## Plan: Migrate PRD generation to Lovable-Ready (V11) ✅ DONE

### Changes applied
1. **`src/config/projectPipelinePrompts.ts`** — Replaced with V11 (1081 lines). Step 7 model changed to `gemini-pro`. 5 new prompt builders for PRD generation.
2. **`supabase/functions/project-wizard-step/index.ts`** — `generate_prd` block replaced: 4 Gemini Pro calls + 1 Claude validation. Blueprint extracted as separate field. Specs D1/D2 included.

### What did NOT change
- Phases 2-6, 8-9: same prompts, same models
- Helper functions: `callGeminiFlash`, `callGeminiPro`, `callClaudeSonnet`, `recordCost` — reused as-is
- UI components — PRD renders as Markdown, no changes needed

---

## Plan: Gemini 3.1 Pro + Linter determinista + Normalización nombres ✅ DONE

### Changes applied

1. **Modelo Gemini 3.1 Pro** (`gemini-3.1-pro`)
   - `ai-client.ts`: aliases `gemini-pro` y `gemini-pro-3` → `gemini-3.1-pro`
   - `project-wizard-step/index.ts`: URL en `callGeminiPro` → `gemini-3.1-pro`, `mainModelUsed` → `"gemini-3.1-pro"`
   - `projectPipelinePrompts.ts`: comentarios actualizados

2. **Linter determinista post-merge** (~100 líneas)
   - Verifica 15 secciones (`# 1.` a `# 15.`), `# LOVABLE BUILD BLUEPRINT`, blueprint >100 chars, `## D1` y `## D2`
   - Reintento selectivo: Part 4 si falta Blueprint/D1/D2, Part 3 si faltan secciones 11-15
   - Máximo 1 reintento; si falla, continúa con `linter_warnings` en metadata

3. **Normalización de nombres propios**
   - System prompt inyecta `companyName` canónico desde stepData/briefing
   - Obliga a usar grafía exacta, corrige variaciones silenciosamente

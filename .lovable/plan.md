

# Plan: Global "Parallel Projects" Detection and Filtering

## Problem
Transcriptions mention parallel initiatives (other projects, verticals, future ideas) as context. The pipeline sometimes treats them as in-scope requirements, causing F4 to flag them as false-positive CRITICAL omissions.

## Approach
Three post-processing layers -- no prompt changes, no DB changes. All logic is deterministic text analysis applied after AI outputs.

---

## A) F2 Post-Process: Detect Parallel Projects in Briefing

**File: `supabase/functions/project-wizard-step/index.ts`** (after line ~378, after briefing JSON is parsed)

Add function `detectParallelProjects(inputText, briefing)` that:
1. Scans `inputText` for contextual markers: "en otro proyecto", "para otro cliente", "lo de X que vimos", "también estamos con", "otra vertical", "más adelante", "en paralelo", "aparte de esto", "por separado"
2. Extracts the surrounding sentence/phrase as `name` + `evidence`
3. Cross-checks: if a detected name appears as a module name, phase title, or deliverable in `briefing.alcance_preliminar.incluido`, it is NOT parallel -- skip it
4. Classifies `reason` based on marker: "otro proyecto/cliente" = `other_vertical`, "más adelante" = `future_idea`, etc.
5. Attaches `briefing.parallel_projects = [{ name, evidence, reason }]` to the briefing JSON before saving

This runs after the AI extraction, purely on the raw input text. No prompt change.

## B) F3/F5 Post-Process: Auto-Insert Exclusions Block

**File: `supabase/functions/project-wizard-step/index.ts`**

Add function `injectParallelProjectExclusions(document, parallelProjects)` that:
1. Takes the generated markdown document and the `parallel_projects` array from the briefing
2. Finds section "5.4 Exclusiones" (or "Exclusiones Explícitas") via regex
3. If found: appends a block after existing exclusions
4. If not found: creates the section before "5.5 Supuestos" or at end of section 5
5. Block format:
```text
### Proyectos paralelos mencionados (fuera de alcance)
Los siguientes proyectos/iniciativas fueron mencionados durante la reunión como contexto pero NO forman parte del alcance del presente proyecto:
- **[name]**: Mencionado como contexto ([reason]). No forma parte del alcance del presente proyecto.
```

Called in two places:
- **Line ~627** (after `generate_scope` result): `result.text = injectParallelProjectExclusions(result.text, briefing.parallel_projects)`
- **Line ~1514** (in `generate_final_doc` action): same injection on the final doc output, reading `parallel_projects` from `sd.briefingJson`

## C) F4 Post-Process: Convert Matching Findings to NO_APLICA

**File: `supabase/functions/project-wizard-step/index.ts`**

Add function `filterParallelProjectFindings(auditJson, parallelProjects, exclusionsText)` that:
1. Extracts exclusion names from the "Proyectos paralelos mencionados" section of the document under review
2. Also uses `parallelProjects` array from briefing
3. For each `hallazgo` in `auditJson.hallazgos`: if `descripción` or `sección_afectada` mentions a parallel project name (fuzzy match, case-insensitive):
   - Move to `hallazgos_no_aplica` array
   - Mark as `[[NO_APLICA:proyecto_paralelo_mencionado]]`
   - Subtract from score counters
4. Recalculate `puntuación_global` and `resumen_hallazgos` counts

Called after audit JSON is parsed (in the `run_audit` action block, after line ~1487), before saving to DB.

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/project-wizard-step/index.ts` | Add 3 helper functions + call them in extract/scope/audit/final_doc actions |

## No Changes To
- Prompts (system prompts stay identical)
- Database schema
- UI components
- `generate-document/index.ts`

## Definition of Done

| Test | Expected |
|------|----------|
| 1) Meeting mentions 2 parallel initiatives | F2 `parallel_projects` array has 2 entries |
| 2) Scope doc (F3) and final doc (F5) | Include "Proyectos paralelos mencionados (fuera de alcance)" in Exclusions |
| 3) F4 audit | No OMISSION findings for parallel projects; moved to `hallazgos_no_aplica` |
| 4) Initiative later added to scope modules | Not detected as parallel (cross-check against `alcance_preliminar.incluido`) |


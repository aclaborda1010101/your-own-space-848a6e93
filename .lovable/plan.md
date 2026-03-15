## Plan: Pipeline Contracts — Contratos Centralizados + Validadores + Sanitización ✅ DONE

### Changes applied

1. **`supabase/functions/project-wizard-step/contracts.ts`** — Nuevo: `PHASE_CONTRACTS` mapa centralizado con `forbiddenKeys`, `forbiddenTerms`, `requiredFields`, `requiredSections`, `inputStepsAllowed` por fase (2,3,4,5,11). Funciones `buildContractPromptBlock()` y `gateInputs()`.

2. **`supabase/functions/project-wizard-step/validators.ts`** — Nuevo: `validateAgainstContract()`, `validateTechnicalDensity()` (PRD), `validateMvpScope()` (MVP), `detectPhaseContamination()` (n-gram overlap), `runAllValidators()`.

3. **`supabase/functions/project-wizard-step/sanitizer.ts`** — Nuevo: `sanitizeClientOutput()` deep-strip de claves internas, `sanitizeClientText()` strip de [[INTERNAL_ONLY]], changelog, debug tags, cost traces.

4. **`supabase/functions/project-wizard-step/index.ts`** — Integración:
   - Imports de contracts, validators, sanitizer
   - F2 (extract): contrato inyectado en prompt + validación post-parse
   - F3 (scope): contrato inyectado + validación con contamination check vs F2
   - F4 (AI audit): contrato inyectado con prohibición explícita de roadmap/fases/presupuesto
   - F5 (PRD): validación técnica (densidad, secciones obligatorias, contamination vs F2/F3/F4)
   - F6/11 (MVP): contrato inyectado + validación scope + contamination
   - Generic handler: validación post-generación para todos los steps

5. **`supabase/functions/generate-document/index.ts`** — Step 0 en pipeline: strip de claves internas en client mode antes de renderizar.

### What did NOT change
- DB schema — todo en `output_data` JSONB como antes
- UI components — retrocompatible (nuevos campos son aditivos: `_contract_validation`)
- Fases 8-10 (patterns, RAGs): sin contratos todavía
- Bloqueo automático: v1 solo marca flags, no bloquea generación

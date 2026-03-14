

# Refactorización del Pipeline: Contratos Centralizados + Gating + Sanitización + Validadores

## Diagnóstico confirmado

El edge function (`project-wizard-step/index.ts`, 2551 líneas) tiene:
- Prompts con contratos implícitos dispersos (cada prompt define sus propias reglas)
- La Auditoría IA (F4) pide `fase_implementación`, `coste_api_estimado`, `services_decision` — contenido que se solapa con presupuesto y MVP
- El PRD (F5) abre con "Resumen Ejecutivo" narrativo antes de llegar a entidades/SQL
- El MVP (F6/step 11) recibe `aiLevStr` y `prdStr` completos sin filtrar
- No hay validación post-generación de contenido prohibido
- No hay sanitización centralizada para export cliente
- Todo vive en un solo archivo monolítico

## Cambios propuestos — 4 bloques

### BLOQUE 1: Archivo de contratos centralizado

**Nuevo archivo: `supabase/functions/project-wizard-step/contracts.ts`**

Mapa único `PHASE_CONTRACTS` con esta estructura por fase:

```typescript
export const PHASE_CONTRACTS = {
  2: {  // Extracción
    allowedTopLevelKeys: ["resumen_ejecutivo", "cliente", "necesidad_principal", "objetivos", "problemas_detectados", "decisiones_confirmadas", "decisiones_pendientes", "alcance_preliminar", "stakeholders", "datos_cuantitativos", "restricciones", "datos_faltantes", "alertas", "integraciones_identificadas", ...],
    forbiddenKeys: ["development_phases", "monetization_models", "cost_eur", "hours", "hourly_rate", "sql_schema", "edge_functions", "prd", "mvp_spec"],
    forbiddenTerms: ["CREATE TABLE", "Edge Function", "monetización", "precio de venta"],
    requiredFields: ["resumen_ejecutivo", "necesidad_principal", "objetivos"],
    requiredItemMeta: ["origin", "confidence"],  // cada item debe tener estos
    inputStepsAllowed: [1],  // solo puede leer step 1
    outputSchemaVersion: "v2.0",
  },
  3: {  // Alcance
    forbiddenKeys: ["sql_schema", "create_table", "edge_functions", "monetization_models", "hourly_rate"],
    forbiddenTerms: ["CREATE TABLE", "RLS", "Edge Function", "token cost"],
    inputStepsAllowed: [2],
    outputSchemaVersion: "v2.0",
  },
  4: {  // Auditoría IA
    allowedTopLevelKeys: ["resumen", "oportunidades", "quick_wins", "requiere_datos_previos", "stack_ia_recomendado", "coste_ia_total_mensual_estimado", "nota_implementación", "services_decision"],
    forbiddenKeys: ["development", "phases", "monetization_models", "pricing_notes", "total_development_eur", "hourly_rate_eur", "setup_price_eur", "monthly_price_eur"],
    forbiddenTerms: ["Fase 0", "Fase 1", "Fase 2", "Plan de Implementación", "cronograma"],
    inputStepsAllowed: [2, 3],
    outputSchemaVersion: "v2.0",
  },
  5: {  // PRD Técnico
    forbiddenTerms: ["precio de venta", "monetización", "setup_price", "monthly_price", "margen del consultor"],
    requiredSections: ["entidades", "workflows", "SQL", "API", "seguridad", "RLS", "Edge Function"],
    technicalDensityCheck: true,
    maxNarrativeOpeningPct: 15,
    inputStepsAllowed: [2, 3, 4],
    outputSchemaVersion: "v2.0",
  },
  11: { // MVP (step_number 11 en DB)
    forbiddenKeys: ["development_phases", "monetization_models", "cost_eur", "hourly_rate", "pricing"],
    forbiddenTerms: ["presupuesto detallado", "margen", "monetización"],
    requiredSections: ["demo_script", "funcionalidades_excluidas", "criterios_aceptación"],
    mvpScopeLimit: { maxModules: 5, maxExternalDeps: 3 },
    inputStepsAllowed: [2, 3, 4, 5],
    outputSchemaVersion: "v2.0",
  },
};
```

### BLOQUE 2: Validadores post-generación

**Nuevo archivo: `supabase/functions/project-wizard-step/validators.ts`**

Funciones que se ejecutan DESPUÉS de parsear el output del LLM, ANTES de guardarlo:

1. **`validateAgainstContract(stepNumber, outputData)`** — Comprueba `forbiddenKeys` y `forbiddenTerms` en el output. Si detecta violación: marca `contract_violation: true` con detalles, pero no bloquea (v1). Log warning.

2. **`validateTechnicalDensity(prdText)`** — Para F5: busca presencia de secciones técnicas obligatorias (`requiredSections`). Si el primer 15% del texto tiene alta concentración de términos comerciales (`transformación`, `escalabilidad`, `visión`, `revolución`), marca `technical_density_too_low: true`.

3. **`validateMvpScope(mvpData)`** — Para F6: cuenta módulos y dependencias externas. Si excede límites del contrato, marca `mvp_scope_risk: "high"`.

4. **`detectPhaseContamination(stepNumber, outputText, previousOutputs)`** — Trocea por párrafos, normaliza, compara n-grams contra outputs anteriores. Si overlap estructural > 30%: marca `phase_contamination_detected: true, duplicated_from: [steps]`.

### BLOQUE 3: Gating de inputs + sanitización de export

**En `contracts.ts`:**

5. **`gateInputs(stepNumber, availableSteps)`** — Filtra los datos que se pasan al prompt según `inputStepsAllowed`. La F4 no recibe `prdStr`. La F6 no recibe datos de pricing. Cada output incluye metadata: `{ generated_from_steps: [2,3], approved_inputs_only: true, contract_version: "v2.0" }`.

**Nuevo archivo: `supabase/functions/project-wizard-step/sanitizer.ts`:**

6. **`sanitizeClientOutput(output)`** — Strip duro antes de cualquier export:
   - Elimina `internal_view`, changelog, `_was_filtered`, `_filtered_content`
   - Elimina `contract_violation`, `phase_contamination_detected`
   - Elimina `token costs`, `debug notes`, `propagation notes`
   - Elimina bloques `[[INTERNAL_ONLY]]`
   - Strip de `cost_usd`, `tokens_input`, `tokens_output`

### BLOQUE 4: Integración en index.ts + refactor mínimo

**En `index.ts`:**

7. Importar contratos, validadores y sanitizer desde los nuevos archivos.

8. Para cada acción (`extract`, `generate_scope`, `run_ai_leverage`, `generate_prd`, `generate_mvp`):
   - ANTES del LLM: inyectar reglas del contrato en el prompt (`forbiddenKeys`, `forbiddenTerms` como instrucciones explícitas)
   - ANTES del LLM: filtrar inputs con `gateInputs()`
   - DESPUÉS del LLM: ejecutar `validateAgainstContract()` + validadores específicos
   - DESPUÉS del LLM: añadir metadata de gating al output
   - EN EXPORT: aplicar `sanitizeClientOutput()` (integrar en `generate-document`)

9. **Ajustes de prompts específicos:**
   - F2: Añadir `origin: "extracted"|"inferred"`, `source_excerpt`, `confidence`, `is_conflicted` al schema JSON obligatorio
   - F4: Eliminar `fase_implementación` del schema de salida. Añadir prohibición explícita: "NO incluir roadmap, fases, cronograma, presupuesto"
   - F5: Mover "Resumen Ejecutivo" de sección 1 a apéndice. Empezar con "Marco del Problema" y "Ontología de Entidades"
   - F6: Añadir `mvp_not_now[]`, `demo_environment_constraints[]`, `demo_script` al schema obligatorio

10. **En `generate-document/index.ts`:** Llamar a `sanitizeClientOutput()` antes de renderizar en modo cliente.

### Estructura de archivos resultante

```text
supabase/functions/project-wizard-step/
├── index.ts          (orquestación — se reduce ~200 líneas)
├── contracts.ts      (PHASE_CONTRACTS + gateInputs)
├── validators.ts     (validateAgainstContract, detectPhaseContamination, etc.)
└── sanitizer.ts      (sanitizeClientOutput)
```

**Nota sobre Deno edge functions:** Los imports relativos (`./contracts.ts`) funcionan en Deno edge functions de Supabase.

### Frontend (sin cambios en este bloque)

Los cambios de UI (tabs, renderizado especializado) se implementarán en un segundo bloque una vez los nuevos outputs estén activos. Los componentes actuales seguirán funcionando por retrocompatibilidad ya que los nuevos campos son aditivos.

## Orden de implementación

1. `contracts.ts` — ~120 líneas
2. `validators.ts` — ~150 líneas
3. `sanitizer.ts` — ~60 líneas
4. Integración en `index.ts` — modificaciones quirúrgicas en cada handler
5. Integración en `generate-document/index.ts` — sanitizer pre-export
6. Deploy y test

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `supabase/functions/project-wizard-step/contracts.ts` | Nuevo — contratos centralizados |
| `supabase/functions/project-wizard-step/validators.ts` | Nuevo — validadores post-gen |
| `supabase/functions/project-wizard-step/sanitizer.ts` | Nuevo — sanitización export |
| `supabase/functions/project-wizard-step/index.ts` | Integrar contratos + validadores + gating |
| `supabase/functions/generate-document/index.ts` | Sanitizer pre-export cliente |


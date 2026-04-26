# Auto-cadena Pipeline v2 al aprobar el briefing

## Estado actual

`approveStep(2)` ya dispara `runPipelineV2PRD()` automáticamente (líneas 1100-1107 de `useProjectWizard.ts`). La función ya ejecuta secuencialmente:

`build_registry (25) → audit_f4a_gaps (26) → audit_f4b_feasibility (27) → architect_scope (28) → generate_technical_prd (29)`

…y luego espeja Step 29 en Step 3 para que la UI existente lo encuentre.

**Por eso te pasaba que con AFFLUX tenías que pulsar botones manualmente:** el flujo automático sí existía, pero como ya habías generado Steps 25/26/27/28 a mano, el `checkStepExists` los saltaba y solo regeneraba el 29 — encima sobre un Step 28 que se había sobrescrito por el bug de `upsert`.

## Problemas a resolver

1. **Idempotencia ciega:** si Steps 25–28 existen, se reusan aunque sean obsoletos. Esto es lo que ha estado pasando contigo: aprobabas el brief, se reusaba el Step 28 viejo, y el PRD salía mal.
2. **Sin granularidad de progreso:** `chainedPhase` solo distingue 4 fases legacy (`alcance/auditoria/patrones/prd`). En el pipeline v2 hay 5 (registry, gap, feasibility, scope, prd), así que el stepper no refleja exactamente dónde está.
3. **Sin reintento ni feedback claro al fallar** un sub-step (solo `console.error`).
4. **Sin forma de "regenerar limpio"** desde la aprobación: cuando reabrís el briefing, lo apruebas y la cadena reusa todo lo viejo.

## Cambios propuestos

### 1. `src/hooks/useProjectWizard.ts` — `runPipelineV2PRD`

- Añadir parámetro `{ forceRegenerate?: boolean }`. Si `true`, salta el `checkStepExists` y regenera Steps 25–28 desde cero. Como ya arreglamos el `upsert` para que `.insert()` cree versiones nuevas en lugar de sobrescribir, esto dejará un historial limpio sin destruir nada.
- Cuando se dispara desde `approveStep(2)`, pasar `forceRegenerate: true` por defecto. Razón: si el usuario está aprobando un briefing nuevo o re-aprobando uno corregido, lo coherente es regenerar todo el scope. Los Steps anteriores quedan persistidos como versiones históricas.
- Reemplazar el `chainedPhase` legacy por un nuevo estado `pipelineV2Phase` con valores `idle | registry | gap_audit | feasibility | scope | prd | done | error` y un `currentSubStep` con número (25/26/27/28/29) para mostrar progreso real.
- Mantener `chainedPhase` mapeado por compatibilidad con el stepper existente (registry→alcance, gap_audit+feasibility→auditoria, scope→patrones, prd→prd).
- En cada sub-step: `try/catch` con un reintento automático (1 retry tras 3s). Si vuelve a fallar, toast claro indicando qué paso falló y dejar `pipelineV2Phase = "error"` para que el usuario decida.
- Toast de éxito final: "PRD técnico generado · Step 29 v{N}" con link al panel.

### 2. `src/components/projects/wizard/ChainedPRDProgress.tsx`

- Aceptar el nuevo `pipelineV2Phase` y renderizar las 5 fases del pipeline v2 con sus labels reales:
  1. Construir registro de componentes (Step 25)
  2. Auditoría de gaps (Step 26)
  3. Auditoría de viabilidad (Step 27)
  4. Arquitectura de alcance (Step 28)
  5. PRD técnico (Step 29)
- Mantener compatibilidad hacia atrás con `currentPhase` legacy si no se pasa el nuevo prop.
- Mostrar el sub-step actual con icono spinner y un check verde por cada uno completado.

### 3. `src/components/projects/wizard/ProjectWizardStepper.tsx`

- Extender `ChainedPhase` o añadir un derivado para que el stepper de la izquierda muestre "PRD Técnico — generando (Step 26/29)" durante la cadena, en lugar de saltar entre etiquetas legacy.

### 4. `src/pages/ProjectWizard.tsx`

- Renderizar `ChainedPRDProgress` con el nuevo `pipelineV2Phase` cuando está activo, dentro del Step 3.
- Al terminar la cadena con éxito y mirror Step 29 → Step 3, navegar automáticamente al usuario al Step 3 y mostrar el PRD generado (esto ya está parcialmente; solo asegurar que el `setCurrentStep(3)` ocurra antes del scroll y el panel reciba el PRD recién espejado).

### 5. UI de aprobación del briefing (`ProjectWizardStep2`)

- Cambiar el copy del botón "Aprobar briefing" a algo como "Aprobar briefing y generar PRD técnico".
- Añadir un microcopy debajo: "Esto generará automáticamente Steps 25–29 (Component Registry, auditorías, arquitectura de alcance y PRD técnico). Tarda ~3-6 minutos."
- Opcional: checkbox "Reusar steps anteriores si existen" (por defecto OFF) para usuarios avanzados que quieran ahorrarse regeneraciones cuando hacen tweaks menores.

### 6. `PipelineQAPanel`

- Mantener los botones manuales (siguen siendo útiles para QA/debug), pero añadir un banner arriba: "El pipeline se ejecuta automáticamente al aprobar el briefing. Estos botones son para inspección y reejecución manual."

## Lo que NO cambia

- Las edge functions `project-wizard-step` (acciones `build_registry`, `audit_f4a_gaps`, `audit_f4b_feasibility`, `architect_scope`, `generate_technical_prd`) ya funcionan correctamente desde nuestras correcciones recientes (versionado por `.insert()`, reglas deterministas en F5, builder PRD F6 estricto).
- El espejado Step 29 → Step 3 se mantiene tal cual.
- El flujo posterior (aprobar PRD → generar presupuesto → propuesta cliente) sigue igual.

## Resultado esperado

Apruebas el briefing → ves un panel de progreso con 5 sub-steps en directo → al terminar (~3-6 min) tienes el PRD técnico listo en el Step 3, sin haber tocado un solo botón del Pipeline QA. Si algo falla, ves exactamente qué paso y por qué.

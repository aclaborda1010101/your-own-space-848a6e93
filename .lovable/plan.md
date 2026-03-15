

## Plan: Pipeline simplificado a 4 pasos visibles

### Razonamiento

Si el objetivo final es tener un PRD copy-pasteable para Lovable/Expert Forge y un MVP, los pasos intermedios (Alcance, Auditoría IA) son procesamiento interno que no necesita aprobación manual. Sin embargo, el Briefing SÍ necesita revisión humana: si los hechos extraídos son incorrectos, todo lo que viene después será basura.

### Nueva estructura

```text
VISIBLE                          INTERNO (automático)
─────────                        ────────────────────
1. Entrada del Proyecto
         │
2. Briefing (revisión humana)    ← el usuario valida hechos
         │
         ├── [Alcance]           ← se genera internamente
         ├── [Auditoría IA]      ← se ejecuta internamente  
         │
3. PRD Técnico                   ← el usuario recibe PRD completo
         │
4. Descripción MVP               ← lista para Lovable/Forge
```

El usuario ve 4 pasos. Al aprobar el Briefing y pulsar "Generar PRD", el sistema encadena internamente Alcance → Auditoría → PRD en una sola operación, mostrando progreso por sub-fases.

### Cambios técnicos

**1. `src/hooks/useProjectWizard.ts`**
- Cambiar `STEP_NAMES` a 4 pasos: Entrada, Briefing, PRD Técnico, MVP
- Nuevo método `runChainedPRD()` que ejecuta secuencialmente:
  1. Genera Alcance (internamente, sin paso visible)
  2. Genera Auditoría (internamente)
  3. Genera PRD
  4. Guarda todo en DB (alcance/auditoría como datos auxiliares del paso PRD)
- Los pasos internos se guardan en `project_wizard_steps` con step_numbers 10/11 (internos) para trazabilidad, pero no aparecen en la UI
- Actualizar `mapOldStepNumber` para retrocompatibilidad con proyectos existentes de 6 pasos

**2. `src/pages/ProjectWizard.tsx`**
- `TOTAL_STEPS = 4`
- `stepLabels`: solo 4 entradas (1: Entrada, 2: Briefing, 3: PRD Técnico, 4: MVP)
- Step 3 (PRD): usa `ProjectWizardGenericStep` pero el `onGenerate` llama a `runChainedPRD()` que muestra progreso sub-fases
- Step 4 (MVP): igual que ahora
- Eliminar renderizado condicional de steps 3/4/5 antiguos, reemplazar por la nueva lógica

**3. `src/components/projects/wizard/ProjectWizardStepper.tsx`**
- Sin cambios estructurales, solo recibe 4 pasos en lugar de 6

**4. `supabase/functions/project-wizard-step/index.ts`**
- Nueva acción `"generate_prd_chained"` que ejecuta F3 → F4 → F5 secuencialmente en una sola invocación
- Emite eventos de progreso por Realtime (`phase: "alcance"`, `phase: "auditoria"`, `phase: "prd"`)
- Guarda outputs intermedios en DB para trazabilidad pero con flag `_internal: true`

**5. UI de progreso sub-fases**
- Cuando el PRD está generando, mostrar un indicador con las 3 sub-fases:
  - ○ Generando Alcance... → ● Completado
  - ○ Ejecutando Auditoría IA... → ● Completado  
  - ○ Generando PRD Técnico... → ● Completado

**6. Retrocompatibilidad**
- Proyectos existentes con 6 pasos siguen funcionando: si ya tienen step 3/4/5 aprobados, se mapean al nuevo step 3 (PRD)
- El `loadProject` detecta si un proyecto tiene datos en steps 3-5 y los presenta correctamente

### Qué NO cambia
- El backend sigue ejecutando las mismas 3 fases (Alcance, Auditoría, PRD) con los mismos prompts y contratos
- Los contratos de `contracts.ts` y validadores se mantienen intactos
- La calidad del output no se degrada, solo se simplifica la experiencia
- Panel de presupuesto, propuesta, Expert Forge: siguen apareciendo tras PRD aprobado


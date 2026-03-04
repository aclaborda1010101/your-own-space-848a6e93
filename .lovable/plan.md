

## Plan: Sub-paso visual "Ingesta de Datos" en el stepper

Hacer visible la ingesta de datos como sub-item bajo el paso 7 del stepper, sin cambiar la numeración de 10 pasos.

### Cambio 1 — `ProjectWizardStepper.tsx`

Add optional prop `dataSubStep` with shape `{ visible: boolean; active: boolean; complete: boolean }`.

When rendering step 7, if `dataSubStep.visible` is true, render a sub-item after the step 7 button:
- Indented, smaller text, with a `Database` icon
- Label: "Ingesta de Datos"
- Green check if `complete`, blue pulse dot if `active`, muted if pending
- Not clickable (navigating to step 7 handles it)

### Cambio 2 — `ProjectWizard.tsx`

Compute `dataSubStep` state from existing variables:
```typescript
const step6Data = steps.find(s => s.stepNumber === 6)?.outputData;
const sd = step6Data?.services_decision;
const needsData = sd?.rag?.necesario || sd?.pattern_detector?.necesario;

const dataSubStep = needsData ? {
  visible: true,
  active: currentStep === 7 && !dataPhaseComplete,
  complete: currentStep === 7 ? dataPhaseComplete : currentStep > 7,
} : { visible: false, active: false, complete: false };
```

Pass `dataSubStep` to `<ProjectWizardStepper>`.

### Files

| File | Change |
|---|---|
| `src/components/projects/wizard/ProjectWizardStepper.tsx` | Accept `dataSubStep` prop, render sub-item under step 7 |
| `src/pages/ProjectWizard.tsx` | Compute and pass `dataSubStep` to stepper |


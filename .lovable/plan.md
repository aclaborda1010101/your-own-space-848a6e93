

## Plan: Resiliencia de generación en segundo plano

### Problema actual

Cuando el usuario navega fuera del wizard mientras se genera un paso:
- **Pasos síncronos (2, 3, 4-6):** La Edge Function completa y guarda en DB, pero el frontend pierde el `await` y no muestra el resultado al volver. El estado `generating` se resetea.
- **Paso asíncrono (7/PRD):** La Edge Function corre con `waitUntil` en background, pero el polling del frontend se detiene al desmontar el componente. Al volver, el paso queda en status `"generating"` sin que nadie lo recoja.

### Solución

Detectar pasos en status `"generating"` al cargar el proyecto y reanudar el polling automáticamente.

### Cambio: `src/hooks/useProjectWizard.ts`

En `loadProject`, después de construir `wizardSteps` y llamar a `setSteps(wizardSteps)`:

1. Buscar si algún step tiene `status === "generating"`
2. Si lo hay, setear `generating = true` y lanzar `pollForStepCompletion(stepNumber)` automáticamente
3. En el `.then()` del poll, setear `generating = false`; en el `.catch()`, también `generating = false` y mostrar toast de error

```typescript
// After setSteps(wizardSteps):
const generatingStep = wizardSteps.find(s => s.status === "generating");
if (generatingStep) {
  setGenerating(true);
  setCurrentStep(generatingStep.stepNumber);
  pollForStepCompletion(generatingStep.stepNumber)
    .catch((e) => toast.error(e.message || "Error en generación"))
    .finally(() => setGenerating(false));
}
```

Esto cubre todos los casos:
- Usuario sale y vuelve mientras se genera → polling se reanuda
- Edge Function ya terminó antes de volver → `loadProject` muestra status `"review"`, no hay step `"generating"`, no hace nada extra

### Archivos

| Archivo | Cambio |
|---|---|
| `src/hooks/useProjectWizard.ts` | Añadir detección de steps en `"generating"` dentro de `loadProject` y auto-resume de polling |


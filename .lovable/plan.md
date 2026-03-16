

## Diagnóstico: PRD generado pero no visible en el wizard

### Problema
El PRD se generó exitosamente (148KB en step_number=5, status "review"), pero el wizard de 4 pasos muestra el paso 3 vacío porque:
1. El paso visible "3" (PRD Técnico) tiene `output_data = NULL`
2. El contenido real está en `step_number = 5` (esquema legacy)
3. El mapeo de retrocompatibilidad no está copiando el output del paso 5 al paso 3

### Plan

1. **Corregir datos inmediatos** - Migración SQL para copiar el `output_data` del paso 5 al paso 3 de este proyecto, y actualizar `current_step` a 3 en `business_projects`.

2. **Revisar el mapeo en el backend** - Verificar que la función `runChainedPRD` en el edge function `project-wizard-step` guarde el resultado final tanto en el paso 5 (legacy) como en el paso 3 (nuevo esquema), para que futuros proyectos no tengan este problema.

### Detalle técnico
- El hook `useProjectWizard` tiene `mapOldStepNumber` que mapea pasos legacy, pero el backend guarda directamente en step 5.
- La solución permanente es que el backend, al finalizar el PRD encadenado, haga upsert en step_number=3 además de step_number=5.
- Para este proyecto específico, un UPDATE directo resuelve el problema inmediatamente.




## Problema identificado

El pipeline se bloquea porque hay un **desalineamiento de numeración de pasos** entre el frontend y el backend:

| Paso UI | step_number frontend | step_number backend (DB) |
|---------|---------------------|-------------------------|
| Auditoría IA | 4 | 6 |
| PRD Técnico | 5 | 7 |
| Descripción MVP | 6 | 6 (conflicto con audit!) |

El `pollForStepCompletion` consulta `step_number = 5` pero el edge function guarda el PRD en `step_number = 7`. Resultado: 0 filas → error 406 → timeout 600s.

Lo mismo aplica para el audit: el UI envía `stepNumber: 4` pero `STEP_ACTION_MAP` en el backend usa `stepNumber: 6` para `run_ai_leverage`. Y `generate_mvp` TAMBIÉN usa `stepNumber: 6`, creando un conflicto directo.

## Plan de corrección

### 1. Añadir mapeo de step numbers en `pollForStepCompletion` (useProjectWizard.ts)

Crear un mapa `newToOld` que traduzca los step numbers del frontend a los del backend antes de hacer la query de polling:

```text
4 → 6  (Auditoría IA)
5 → 7  (PRD Técnico)  
6 → queda como 6 (MVP — pero necesita distinguirse de audit)
```

Modificar `pollForStepCompletion` para consultar el `step_number` correcto del DB, probando primero el número directo y si no existe, el número mapeado (retrocompat bidireccional).

### 2. Corregir `clearSubsequentSteps` (useProjectWizard.ts)

Actualmente hace `DELETE WHERE step_number > fromStep` con numeración nueva. Cuando `fromStep = 4` (audit en UI), necesita borrar steps 5,6,7,8... en DB. Esto ya funciona parcialmente, pero el mapeo inverso debe ser consistente.

Solución: al borrar, usar `gt` con el número más bajo entre el nuevo y el viejo mapeado, o borrar explícitamente los rangos correctos.

### 3. Corregir `generate_mvp` en el backend (project-wizard-step/index.ts)

`generate_mvp` actualmente mapea a `stepNumber: 6` en `STEP_ACTION_MAP`, mismo que `run_ai_leverage`. Esto sobrescribe los datos de la auditoría.

Cambiar `generate_mvp` a un step_number distinto que no colisione (e.g., `stepNumber: 11` o idealmente alinear todo al sistema nuevo de 6 pasos).

### Enfoque recomendado: Alinear el backend a la numeración nueva

En vez de parches de mapeo, la solución más limpia es actualizar `STEP_ACTION_MAP` y la sección de `generate_prd` en el edge function para usar los step numbers nuevos (4, 5, 6). Esto requiere:

**En `project-wizard-step/index.ts`:**
- `run_ai_leverage` → `stepNumber: 4` (era 6)
- `generate_prd` → guardar en `step_number: 5` (era 7)  
- `generate_mvp` → `stepNumber: 6` (era 6, pero sin conflicto ahora)
- Actualizar todas las lecturas internas (e.g., PRD lee `step_number: 6` para services_decision, debería leer 4)
- `approve_step` retrocompat ya maneja ambas numeraciones, mantenerlo

**En `useProjectWizard.ts`:**
- Eliminar `mapOldStepNumber` y la lógica retrocompat en `loadProject` (ya no necesaria para proyectos nuevos, pero mantener para proyectos existentes)
- `pollForStepCompletion` debe intentar ambos números (nuevo y viejo) para retrocompat

### Archivos a modificar

1. **`supabase/functions/project-wizard-step/index.ts`** — Actualizar `STEP_ACTION_MAP`, sección `generate_prd`, y lecturas internas de steps
2. **`src/hooks/useProjectWizard.ts`** — Añadir mapeo bidireccional en `pollForStepCompletion`

### Riesgo

Proyectos existentes con datos en la numeración vieja (6, 7) necesitan que la retrocompat en `loadProject` siga funcionando. El plan mantiene esa lógica de fallback.


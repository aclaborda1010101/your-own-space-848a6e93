

# Plan: Correcciones y evolución del Wizard de Proyectos

## Problemas identificados y cambios solicitados

### 1. Bug: Progreso incorrecto en la lista de proyectos
En `Projects.tsx` línea 233, el progreso se calcula como `(step / 9) * 100` — usa 9 pasos (el sistema antiguo) en vez de 5. Además, el badge dice "Paso X/9". Esto hace que un proyecto en paso 5 muestre solo ~55% en vez de 100%.

**Fix**: Cambiar `/9` → `/6` (nuevo total con MVP) y actualizar labels.

### 2. Eliminar panel "Detección de Necesidades" (Discovery)
Eliminar la línea `<ProjectDiscoveryPanel>` del wizard (`ProjectWizard.tsx` línea 201).

### 3. Mover "Historial de Actividad" al final
Mover `<ProjectActivityTimeline>` (línea 202) después de todos los paneles (Documentos, Presupuesto, Propuesta), justo antes del cierre del `</main>`.

### 4. Añadir Paso 6: "Descripción del MVP" al pipeline
- `TOTAL_STEPS` → 6
- Añadir a `stepLabels`: `6: "MVP"`
- Añadir a `STEP_CONFIGS`: paso 6 con action `generate_mvp`, label "Generar Descripción MVP", isMarkdown true
- Añadir "Descripción del MVP" a `STEP_NAMES` en `useProjectWizard.ts`

### 5. Nuevo panel: "Lanzamiento del Producto"
Crear un nuevo componente `ProjectLaunchPanel` que aparezca después de la Propuesta para el Cliente. Será un panel colapsable con sección para gestionar el lanzamiento del producto (placeholder inicial que se irá completando).

## Ficheros a modificar

| Fichero | Cambio |
|---|---|
| `src/pages/ProjectWizard.tsx` | Bug progreso, eliminar Discovery, mover Timeline, TOTAL_STEPS=6, step 6 config, añadir panel Launch |
| `src/pages/Projects.tsx` | Fix `/9` → `/6`, labels |
| `src/hooks/useProjectWizard.ts` | Añadir "Descripción del MVP" a STEP_NAMES |
| `src/config/projectPipelinePrompts.ts` | Añadir prompt para MVP (paso 6) |
| `supabase/functions/project-wizard-step/index.ts` | Añadir action `generate_mvp` |
| `src/components/projects/wizard/ProjectLaunchPanel.tsx` | Nuevo componente placeholder |


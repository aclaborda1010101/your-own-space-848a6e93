
# Rediseño del flujo del wizard de proyectos

## Diagnóstico

1. **Aprobar Brief no avanza nada.** En `useProjectWizard.ts` → `approveStep(2)` solo hace `loadProject()`. Nunca llama a `setCurrentStep(3)` ni dispara `runChainedPRD()`. Por eso te quedas en Paso 2 mirando el brief aprobado sin que pase nada.
2. **El progreso está enterrado.** El `ProjectWizardStepper` (Entrada / Briefing / Alcance / Auditoría / Patrones / PRD / MVP / Forge) vive dentro de un `CollapsibleCard` cerrado por defecto en `ProjectWizard.tsx`. No se ve el avance global del proyecto.
3. **Pipeline V2 (PipelineQAPanel) ensucia el flujo.** Está renderizado siempre debajo del Step 2, mezclado con el contenido productivo. Es una herramienta de debug, no debería estar en el flujo principal.
4. **Falta encadenado completo.** El flujo deseado es:
   `Entrada → Brief (aprobar) → PRD (auto) → Budget (auto) → Propuesta cliente`
   Hoy cada paso es manual y aislado.

## Cambios propuestos

### 1. Encadenar la aprobación del Brief con el resto del pipeline
**Archivo:** `src/hooks/useProjectWizard.ts`

- Modificar `approveStep(2)` para que, al aprobar el briefing, automáticamente:
  - `setCurrentStep(3)` (avanza la UI a PRD).
  - Llame a `runChainedPRD()` (ya existe y genera Alcance + Auditoría + Patrones + PRD encadenado).
- Modificar `runChainedPRD()` para que, al terminar con éxito, automáticamente:
  - `setCurrentStep(4)` desde el punto de vista visual del progreso (o lo deje en "PRD listo, generando presupuesto").
  - Llame a `approveStep(3)` automáticamente (auto-aprobar PRD generado) si quieres flujo 100% automático, o lo deje en `review` para que tú lo valides — **te lo pregunto en la sección de decisiones**.
  - Llame a `generateBudgetEstimate()` con los modelos de monetización por defecto.
- Tras `generateBudgetEstimate()` el estado ya queda con `budgetData`, lo que automáticamente desbloquea el `ProjectProposalExport` (propuesta cliente) en `ProjectWizard.tsx`.

### 2. Sacar el progreso del proyecto a un panel lateral fijo dentro del wizard
**Archivos:** `src/pages/ProjectWizard.tsx`, `src/components/projects/wizard/ProjectWizardStepper.tsx`

- Convertir el layout del wizard en `grid grid-cols-[260px_1fr]` (en desktop) con:
  - **Columna izquierda fija**: `ProjectWizardStepper` (siempre visible, sin colapsar). Muestra fase actual, % global, sub-progreso del PRD encadenado, y permite navegar entre pasos completados.
  - **Columna derecha**: contenido del paso actual + paneles de Budget/Propuesta debajo cuando aplica.
- Eliminar el `CollapsibleCard "Pipeline del proyecto"` que ahora envuelve al stepper.
- En móvil, el stepper colapsa arriba con un toggle.
- Aclaración importante: el progreso vive en una **columna lateral propia del wizard**, no se inyecta en la sidebar global de la app (`SidebarNew`). Mezclar el progreso de un proyecto con la nav global complicaría mucho la UX y rompería el patrón de `AppLayout`.

### 3. Mover PipelineQAPanel a "Avanzado / Interno"
**Archivo:** `src/pages/ProjectWizard.tsx`

- Quitar el `<PipelineQAPanel />` de su posición actual debajo del Step 2.
- Renderizarlo dentro del bloque `CollapsibleCard "Avanzado / Interno"` que ya existe abajo, junto al `ManifestViewer` y al resto de herramientas internas.
- Así sigue accesible para QA pero deja de ensuciar el flujo principal.

### 4. Indicador visual claro del encadenado
**Archivo:** `src/pages/ProjectWizard.tsx` y `src/components/projects/wizard/ChainedPRDProgress.tsx`

- Cuando `generating === true` y `chainedPhase !== "idle"`, mostrar un banner persistente arriba del contenido del paso indicando: "Generando PRD automáticamente tras aprobar Brief…" con la barra de progreso y la fase activa.
- Después del PRD, mostrar otro banner: "Generando estimación de presupuesto…" mientras `budgetGenerating === true`.
- El `ProjectWizardStepper` lateral ya tiene la lógica para reflejar `processing` por fase, así que esto solo requiere asegurar que pase los flags correctos.

### 5. Permitir cancelar/desactivar el encadenado automático (opt-out)
**Archivo:** `src/pages/ProjectWizard.tsx`

- Añadir un toggle pequeño "Encadenar automáticamente PRD + Presupuesto al aprobar Brief" en la cabecera, persistido en `localStorage` por proyecto. Por defecto: ON.
- Si el usuario lo desactiva, `approveStep(2)` se comporta como hoy (solo aprueba) y deja los siguientes pasos en manual. Útil para QA o para iterar el brief sin lanzar generación pesada.

## Decisiones que necesito de ti

1. **¿Auto-aprobar el PRD generado** o dejarlo en estado `review` para que lo valides manualmente antes de pasar al presupuesto?
   - Opción A (recomendada): auto-pasa a `review` y **espera tu aprobación** del PRD antes de lanzar el presupuesto. Más seguro, te da control en el documento más caro/largo.
   - Opción B: auto-aprueba PRD y dispara presupuesto sin parar.

2. **Modelos de monetización para el presupuesto automático.** Hoy `generateBudgetEstimate(selectedModels)` recibe los modelos seleccionados desde el panel de presupuesto. Si encadenamos automático, hay que decidir defaults:
   - Opción A: usa los 3 modelos canónicos por defecto (proyecto cerrado + retainer + revenue share).
   - Opción B: genera **sin** modelos seleccionados (lista vacía) y tú los marcas después en el panel de Budget para regenerar.

## Lo que NO toco

- `SessionGuard` y `runtimeFreshness` siguen como están — el problema de pérdida de sesión se atajó en el cambio anterior.
- La generación de PRD encadenada (edge function `project-wizard-step` con `action: "generate_prd_chained"`) no se modifica. Solo cambia **cuándo** se dispara desde el frontend.
- Los componentes `ProjectBudgetPanel` y `ProjectProposalExport` no se tocan — ya están bien y se renderizan solos cuando hay datos.

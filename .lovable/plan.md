

## Plan: Hacer editable el output de pasos genéricos (4-10)

Actualmente los pasos 4-10 muestran el output como solo lectura. El usuario necesita poder editar el contenido antes de aprobar para corregir errores de la IA (como incluir proyectos incorrectos).

### Cambio: `ProjectWizardGenericStep.tsx`

Add an edit mode toggle to the generic step component:

1. Add state: `editing` (boolean), `editedContent` (string)
2. Add an "Editar" button next to "Regenerar" and "Aprobar"
3. When editing:
   - For markdown steps: show a `<textarea>` instead of the read-only prose view
   - For JSON steps: show a `<textarea>` with `JSON.stringify(outputData, null, 2)`
4. Add "Guardar cambios" and "Cancelar" buttons in edit mode
5. On save: call `onUpdateOutputData` with the parsed content (JSON.parse for JSON, or `{ document: text }` for markdown)

### Cambio: `ProjectWizard.tsx`

Pass `onUpdateOutputData` to `ProjectWizardGenericStep` for steps 4-10, wiring it to update the step's `output_data` in Supabase via the hook.

### Cambio: `useProjectWizard.ts`

Add `updateStepOutputData(stepNumber, newData)` function that updates `project_wizard_steps` output_data directly and refreshes local state.

### Files

| File | Change |
|---|---|
| `src/components/projects/wizard/ProjectWizardGenericStep.tsx` | Add edit mode with textarea, save/cancel buttons |
| `src/pages/ProjectWizard.tsx` | Wire `onUpdateOutputData` for generic steps |
| `src/hooks/useProjectWizard.ts` | Add `updateStepOutputData` function |


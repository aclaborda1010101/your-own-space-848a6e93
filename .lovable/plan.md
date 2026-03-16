

## Problem

When step 4 (MVP) is approved, the database correctly stores `status: "approved"`. However, when the user navigates away and returns, the `ProjectWizardGenericStep` component renders the step identically to a non-approved step — showing "Regenerar", "Editar", and "Aprobar y continuar" buttons. The component never receives or checks the step's `status`.

## Root Cause

`ProjectWizardGenericStep` has no `status` prop. It only checks if `outputData` exists to show content, but has no concept of "approved" vs "review" state.

## Plan

### 1. Add `status` prop to `ProjectWizardGenericStep`

- Add optional `status?: string` to the `Props` interface
- When `status === "approved"`:
  - Show an "Aprobado" badge (green, with check icon) instead of "Generado"
  - Replace the action buttons ("Regenerar", "Editar", "Aprobar y continuar") with a read-only view and a subtle "Desbloquear edición" button if the user wants to make changes
  - Visually indicate the step is locked (e.g., muted border or green accent)

### 2. Pass `status` from `ProjectWizard.tsx`

- For step 3 (PRD) and step 4 (MVP), pass `status={step3Data?.status}` / `status={step4Data?.status}` to the component

### 3. Approved state UI

When approved:
- Badge: green "Aprobado ✓" replacing "Generado"
- Content area: still visible and scrollable (read-only)
- Buttons: single outline "Desbloquear para editar" button that switches back to the normal edit/regenerate view
- Download buttons remain available


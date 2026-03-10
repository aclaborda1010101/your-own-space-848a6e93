
# Fix: ProjectBudgetPanel crash on missing data

## Problem
The `ProjectBudgetPanel` crashes with `Cannot read properties of undefined (reading 'phases')` because `budgetData` loaded from the database (`output_data`) may have a different structure than expected — missing `development`, `recurring_monthly`, or `monetization_models` keys.

## Fix
Add defensive null checks throughout `ProjectBudgetPanel.tsx` before accessing nested properties:

- `budgetData.development?.phases?.map(...)` instead of `budgetData.development.phases.map(...)`
- `budgetData.recurring_monthly?.items?.map(...)` — already uses `?.` but parent `recurring_monthly` needs it too
- `budgetData.monetization_models?.map(...)` 
- All `.toLocaleString()` calls on potentially undefined numbers need fallbacks
- Wrap each section in a conditional: only render "Development costs" if `budgetData.development` exists, etc.

This is a single-file fix in `src/components/projects/wizard/ProjectBudgetPanel.tsx`. Every property access on `budgetData.*` gets optional chaining or a guard condition.



## Problem

The `CollapsibleCard` component uses `useState(defaultOpen)` — pure local state that resets every time the component remounts. When you navigate away from the wizard and come back, React unmounts the page, and all panels reset to `defaultOpen={false}`.

## Solution: Persist accordion state in sessionStorage

Persist each panel's open/closed state keyed by its `id` prop + the project ID, using `sessionStorage` so it survives navigation within the session but resets on new browser sessions.

### Changes

**1. `src/components/dashboard/CollapsibleCard.tsx`**
- Replace `useState(defaultOpen)` with a hook that reads initial state from `sessionStorage` (key: `collapsible-${id}`)
- On `onOpenChange`, write the new state to `sessionStorage`
- Fall back to `defaultOpen` if no stored value exists

**2. `src/pages/ProjectWizard.tsx`**
- Pass more specific `id` values to `CollapsibleCard` instances that include the project ID (e.g., `id={`pipeline-${id}`}`) so each project remembers its own panel states independently

This is a minimal change — ~10 lines total across 2 files. No new dependencies needed.


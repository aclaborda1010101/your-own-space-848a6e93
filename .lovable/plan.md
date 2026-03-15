

## Plan: Fix "centros comerciales" project crash

### Root Cause
**Runtime error**: `d.opciones.join is not a function` in `ProjectWizardStep2.tsx:551`

The briefing data for this project has a `decisiones_pendientes` entry where `opciones` is a string (or object) instead of an array. The guard `d.opciones?.length > 0` passes for strings (they have `.length`), but `.join()` only exists on arrays.

### Fix

**File**: `src/components/projects/wizard/ProjectWizardStep2.tsx`, line 550-551

Change the guard to check `Array.isArray(d.opciones)`:

```tsx
{Array.isArray(d.opciones) && d.opciones.length > 0 && (
  <p className="text-xs text-muted-foreground mt-1">Opciones: {d.opciones.join(" · ")}</p>
)}
```

This is a one-line defensive fix. No other changes needed.


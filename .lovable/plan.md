

## Plan: Actualizar caché del preview

Cambiar el timestamp en `src/main.tsx` línea 1 para forzar rebuild del bundle.

### Cambio
- `src/main.tsx` línea 1: `// cache-bust: 2026-04-13T12:00` → `// cache-bust: 2026-04-13T15:30`


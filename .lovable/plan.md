# Forzar rebuild del preview de Lovable

La preview está sirviendo una versión cacheada y no muestra los cambios recientes (bloque "Plazos de implementación" en el Paso 4 del wizard).

## Acción

Actualizar el timestamp del marcador `cache-bust` en `src/main.tsx`:

- Línea 1 actual: `// cache-bust: 2026-04-26T07:00`
- Nueva: `// cache-bust: 2026-04-27T17:30`

Esto fuerza a Vite a invalidar la caché y reconstruir el bundle, que es el patrón estándar del proyecto (regla Core de memoria).

## Después de aplicar

1. Espera ~10–15s a que el preview se reconstruya.
2. Recarga con **Force Refresh** (botón en la TopBar) si sigue cacheado.
3. Vuelve a Proyectos → AFFLUX → Paso 4 (Presupuesto) → modo edición y verifica que aparece el bloque **"Plazos de implementación"**.

## Nota

Si tras el rebuild sigue sin aparecer, el problema no es caché sino que el componente no está montado en esa vista — en ese caso lo investigo en `ProjectBudgetPanel.tsx` y el flujo del Paso 4.

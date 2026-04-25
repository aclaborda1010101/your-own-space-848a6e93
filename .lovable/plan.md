# Plan: arreglar preview obsoleto y warning de refs

## Diagnóstico

Lo que ves no es que el código esté mal: el preview de Lovable está sirviendo un bundle cacheado de hace varias iteraciones y solo se invalida cuando escribes en el chat (eso fuerza un HMR puntual que arrastra los cambios pendientes).

Hay dos causas confirmadas:

1. **Cache-bust desactualizado**: `src/main.tsx` línea 1 tiene `// cache-bust: 2026-04-25T11:35`, anterior a todos los cambios recientes (chunked extractor, brief-normalizer, clean-brief-builder, botones nuevos de Step 2). Según la memoria del proyecto (`mem://arquitectura/lovable-preview-resiliencia-cache`), actualizar ese timestamp es el mecanismo oficial para forzar rebuild + reload del preview.

2. **Warning de React en consola** (visible en `code--read_console_logs`):
   ```
   Warning: Function components cannot be given refs.
   Check the render method of `ProjectWizardStep2`.
   at Badge (.../ui/badge.tsx)
   ```
   Hay un `<Badge>` envuelto en un componente que le pasa ref (probablemente `TooltipTrigger asChild` o `Collapsible asChild` alrededor de un Badge añadido en los botones nuevos de "Reintentar bloques fallidos" / "Limpiar y normalizar"). No rompe el render pero ensucia logs y puede impedir que tooltips funcionen sobre esos badges.

## Cambios a aplicar

### 1. `src/main.tsx` — bumpear cache-bust
Cambiar línea 1:
```ts
// cache-bust: 2026-04-25T11:35
```
por el timestamp actual (ej. `// cache-bust: 2026-04-25T18:40`). Esto dispara `ensureRuntimeFreshness()` y fuerza al preview a recargar el bundle nuevo con los botones de chunked extraction y normalización ya en pantalla, sin depender de que escribas en el chat.

### 2. `src/components/ui/badge.tsx` — convertir Badge a `forwardRef`
Reescribir el componente `Badge` para que use `React.forwardRef<HTMLDivElement, BadgeProps>(...)`. Es un cambio aislado, retro-compatible (todas las llamadas existentes a `<Badge>` siguen funcionando igual) y elimina el warning. Esto desbloquea que cualquier `TooltipTrigger asChild` o `Slot` que envuelva un Badge funcione correctamente — relevante porque los nuevos paneles de alerta de chunks fallidos en Step 2 ya muestran badges dentro de tooltips/collapsibles.

### 3. `src/components/projects/wizard/ProjectWizardStep2.tsx` — verificar cita del warning
Tras el fix de Badge, revisar (líneas ~395-450, que es donde la pila de error apunta) que ningún Badge esté envuelto en un patrón obsoleto. Si todo apunta solo a Badge sin ref propio, el cambio (2) basta.

## Qué NO toca este plan

- No reextrae briefings ni toca lógica de chunked extraction.
- No modifica edge functions.
- No cambia datos del proyecto AFFLUX.

Es puramente un fix de refresco de preview + un warning de React. Tras esto deberías ver inmediatamente los botones nuevos ("✨ Limpiar y normalizar", "🔁 Reintentar bloques fallidos", visor de Brief Limpio) sin tener que escribir en el chat para forzarlo.

## Nota a futuro

Cada vez que hagamos cambios grandes en componentes del wizard, conviene bumpear el `cache-bust` en `main.tsx` en la misma tanda. Lo añado como recordatorio de hábito; no requiere nueva memoria porque ya está documentado en `mem://arquitectura/lovable-preview-resiliencia-cache`.

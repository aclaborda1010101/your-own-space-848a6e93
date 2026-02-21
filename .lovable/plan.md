
# Fix: No se puede hacer scroll en la Peticion Tecnica Generada

## Problema

La pantalla "Peticion Tecnica Generada" (`PatternIntentReview`) no permite scroll. El contenido se desborda por debajo de la pantalla y los botones de accion quedan cortados o inaccesibles.

La causa: el componente usa `ScrollArea` con `max-h-[60vh]` para la zona de cards, pero el header, la descripcion original y los botones de accion ocupan espacio adicional. El total supera el viewport y no hay scroll global funcional.

## Solucion

Reestructurar el layout para que:
1. El contenedor externo (en `PatternDetector.tsx`) use `flex flex-col` con altura completa
2. El contenido scrolleable ocupe todo el espacio disponible entre el header y los botones
3. Los botones de accion queden siempre fijos abajo

## Cambios

### `src/components/projects/PatternDetector.tsx` (linea 441-442)

Cambiar el contenedor del overlay para usar layout vertical con altura completa:

```
// Antes
<div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-start justify-center p-4 pt-8 overflow-y-auto">
  <div className="w-full max-w-2xl">

// Despues
<div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-start justify-center p-4 pt-8 overflow-hidden">
  <div className="w-full max-w-2xl max-h-full flex flex-col">
```

### `src/components/projects/PatternIntentReview.tsx`

Cambiar el layout del componente raiz de `space-y-4` a un `flex flex-col` con altura completa:

- Contenedor raiz: `flex flex-col h-full overflow-hidden` en vez de `space-y-4`
- Header y descripcion original: se mantienen fijos arriba con `shrink-0`
- `ScrollArea`: cambiar `max-h-[60vh]` a `flex-1 min-h-0` para que ocupe todo el espacio disponible
- Botones de accion: se mantienen fijos abajo con `shrink-0`

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/projects/PatternDetector.tsx` | Ajustar clases del overlay contenedor |
| `src/components/projects/PatternIntentReview.tsx` | Reestructurar layout a flex column con scroll central |

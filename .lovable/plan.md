

# Compactar botones de categoria y ambito en el panel de detalle

## Problema
En el panel derecho de detalle de contacto, los botones de "profesional / personal / familiar" (asignar categorias) y "Ver profesional / Ver personal / Ver familiar" (cambiar ambito del perfil IA) se ven apelotonados y se descuadran con distintas resoluciones.

## Solucion

**Archivo: `src/pages/StrategicNetwork.tsx`**

### 1. Categorias del contacto (Row 3, lineas ~1196-1212)
Cambiar de `grid grid-cols-3` a `flex flex-wrap gap-1` con pills mas compactos. Como un contacto puede tener varias categorias a la vez, se mantienen como toggles (no dropdown).

- Reducir padding: `px-2 py-1` a `px-1.5 py-0.5`
- Texto mas compacto con solo el icono + nombre corto

### 2. Selector de ambito (Row 4, lineas ~1216-1231)
Reemplazar los 3 botones "Ver profesional / Ver personal / Ver familiar" por un `Select` dropdown. Solo se muestra si el contacto tiene mas de 1 categoria.

```text
Antes:  [Ver profesional] [Ver personal] [Ver familiar]
Despues: [Ambito: Profesional  v]
```

### Resultado visual esperado

```text
[profesional] [personal] [familiar]    <-- pills compactos (toggles)
[Ambito: Profesional  v]              <-- dropdown (solo si >1 categoria)
```

Ocupa menos espacio vertical y no se rompe al cambiar resolucion.


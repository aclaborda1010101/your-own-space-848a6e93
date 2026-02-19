

# Fix: Bio de contacto en movil/iPad + botones de filtro uniformes

## Problema 1: Bio no visible en movil ni iPad

El layout actual usa `grid-cols-1 lg:grid-cols-[320px_1fr]` (linea 1600). En pantallas menores a `lg` (1024px), ambos paneles (lista de contactos + detalle) se apilan verticalmente. La lista ocupa casi toda la pantalla con `max-h-[calc(100vh-300px)]`, asi que el panel de detalle queda debajo y fuera de vista. El usuario selecciona un contacto pero no ve que la bio aparece abajo.

**Solucion**: En movil/tablet, cuando se selecciona un contacto, ocultar la lista y mostrar solo el detalle con un boton "Volver a lista". Es el patron clasico de master-detail responsive.

Cambios en la seccion del layout (lineas 1599-1716):
- En pantallas `< lg`: si hay `selectedContact`, mostrar solo `ContactDetail` con un boton "Volver"
- Si no hay `selectedContact`, mostrar solo la lista
- En pantallas `>= lg`: mantener el grid de 2 columnas actual

Se usara `useIsMobile` (ya existe en el proyecto, breakpoint 768px) y un check adicional para `lg` (1024px) via media query o clase CSS con `hidden`/`block`.

## Problema 2: Botones de filtro con tamanos diferentes

Los botones de categoria (Todos/Profesional/Personal/Familiar, lineas 1615-1628) y de vista (Activos/Top 100/Favoritos/Todos, lineas 1631-1667) tienen ancho variable porque dependen del texto interior. El usuario quiere que todos tengan el mismo tamano.

**Solucion**: Aplicar `flex-1` o `min-w-[80px]` a cada boton para que todos ocupen el mismo ancho. Usar `grid grid-cols-4` en vez de `flex gap-1` para distribucion uniforme.

## Detalle tecnico

### Archivo modificado: `src/pages/StrategicNetwork.tsx`

**Cambio 1 — Layout responsive master-detail** (lineas 1599-1716):
- Envolver la lista en un `div` con clase `lg:block` y condicion: en pantalla pequena, ocultar si hay contacto seleccionado
- Envolver el detalle en un `div` con clase `lg:block` y condicion: en pantalla pequena, ocultar si NO hay contacto seleccionado
- Anadir boton "Volver a contactos" arriba del detalle, visible solo en `< lg`
- Al pulsar "Volver", se hace `setSelectedContact(null)`

**Cambio 2 — Botones uniformes** (lineas 1615-1667):
- Cambiar `flex gap-1 flex-wrap` por `grid grid-cols-4 gap-1` en ambas filas de filtros
- Esto hace que cada boton ocupe exactamente 1/4 del ancho disponible
- Mantener `h-7 text-xs` existente

### Ninguna dependencia nueva necesaria



## Plan: Evitar cortes de página entre encabezados y tablas en el PDF

### Problema
En el PDF generado, los encabezados (h2, h3) quedan al final de una página y su contenido (tabla, lista) empieza en la siguiente. Esto es especialmente visible con el "CHANGELOG INTERNO" que se corta entre la cabecera y la tabla.

### Solución
Añadir reglas CSS de `page-break-inside: avoid` y `break-inside: avoid` en el CSS del generador de documentos (`supabase/functions/generate-document/index.ts`):

1. **Tablas**: `page-break-inside: avoid` para que no se partan entre páginas (salvo tablas muy largas que el motor forzará)
2. **Encabezados h2/h3/h4**: `page-break-after: avoid` para que siempre arrastren al menos el primer bloque de contenido a la misma página
3. **Filas de tabla (`tr`)**: `page-break-inside: avoid` para evitar que una fila se corte a mitad

### Cambios en el CSS

- En `h2` (línea ~234): añadir `page-break-after: avoid;`
- En `h3` (línea ~244): añadir `page-break-after: avoid;`
- En `h4` (línea ~252): añadir `page-break-after: avoid;`
- En `table` (línea ~335): añadir `page-break-inside: avoid;`
- En `tr`: añadir `page-break-inside: avoid;`

### Redeploy
Redesplegar la Edge Function `generate-document` para que los cambios apliquen.


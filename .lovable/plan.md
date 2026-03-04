

## Plan: Eliminar valores hardcodeados del generador DOCX

El generador ya es genérico en su diseño — la portada usa parámetros, los callouts detectan patrones `[PENDIENTE:`, `[ALERTA:`, `[CONFIRMADO:]` en el markdown, el resumen ejecutivo parsea `<!--EXEC_SUMMARY_JSON-->`, y la firma se genera condicionalmente para steps client-facing. Todo funciona con cualquier proyecto.

Sin embargo hay **3 valores hardcodeados** que rompen la genericidad:

### Cambios en `supabase/functions/generate-document/index.ts`

| Línea | Problema | Fix |
|---|---|---|
| 169 | `["Autor", "Agustín Cifuentes"]` en metadatos de portada | Aceptar `author` como parámetro opcional en el body del request. Si no viene, omitir la fila o poner "—" |
| 624 | `___/___/2026` en firma | Usar el año actual dinámicamente: `new Date().getFullYear()` |
| 633 | `makeSignBlock("ManIAS Lab.", "Agustín Cifuentes")` en firma | Usar el mismo parámetro `author` para el nombre del firmante de ManIAS |

### Cambio en el request handler (línea 1044)

Extraer `author` del body JSON junto con los demás campos y pasarlo a `createCoverPage` y `createSignaturePage`.

### Resultado

Un generador 100% genérico: portada, callouts, firma y resumen ejecutivo funcionan con cualquier proyecto sin modificar código. Los datos vienen del request o del markdown.


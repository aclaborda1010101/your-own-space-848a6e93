

## Plan: DOCX Premium — De "correcto" a "consultoría McKinsey"

Este es un rediseño integral del generador DOCX. Se divide en fases de implementacion priorizadas.

### Archivo a modificar
`supabase/functions/generate-document/index.ts` — reescritura sustancial (~90% del archivo cambia)

---

### FASE P0 — Bugs + fundamentos tipograficos

**1. Fix indice duplicado**: El TOC genera `1. 1. TITULO` porque el heading ya trae numero. Solucion: en `createManualTOC`, detectar si el heading ya empieza con digito+punto y NO añadir contador propio.

**2. Tablas ASCII**: Añadir deteccion de tablas con formato `+---+---+` ademas del formato `|`. Convertir ambas a `Table()` real.

**3. Fuente segura**: Reemplazar Montserrat por **Calibri** (body 10.5pt) y mantener Arial para headings. Usar **Consolas** para codigo. Actualizar `parseInlineFormatting`, `parseBulletRuns`, `jsonToParagraphs` y estilos del documento.

**4. Colores corporativos actualizados**:
```
primary: "0D9488" (teal), text: "374151" (gris oscuro), 
light: "F9FAFB", muted: "6B7280", alert_red: "DC2626",
alert_orange: "D97706", confirmed_green: "059669"
```

**5. Headings rediseñados**:
- H1: Arial Bold 16pt, color teal, borde inferior teal 1.5pt, Title Case (no mayusculas). Sin fondo teal completo.
- H2: Arial Bold 12pt, gris oscuro, sin borde
- H3: Arial Bold 10pt, gris medio

**6. Spacing global**: Interlineado body 1.15 (line: 276). Spacing after H1=12pt, H2=8pt, parrafos=6pt, antes/despues tabla=12pt.

**7. Tablas profesionales**: Solo bordes horizontales gris (#E5E7EB, 0.5pt), sin verticales. Header: teal, MAYUSCULAS, blanco bold 10pt. Zebra: blanco/#F9FAFB. Padding: 6pt arr/abj, 8pt izq/der. Primera columna bold si es etiqueta.

---

### FASE P1 — Portada premium + header/footer + callouts + firma

**8. Portada premium**: Franja teal superior (3cm via Table sin bordes con fondo #0D9488) con logo ManIAS. Titulo Arial Bold 28pt oscuro. Subtitulo Arial 18pt gris. Linea decorativa teal. Metadatos en tabla invisible. Badge CONFIDENCIAL: celda fondo rojo (#DC2626), texto blanco.

**9. Header mejorado**: Proyecto izquierda + CONFIDENCIAL derecha via tab stops. Linea separadora 0.5pt gris. Excluir portada (la portada ya esta en la misma seccion pero el header aparece en todas).

**10. Footer mejorado**: Linea separadora + "ManIAS Lab. | Consultora Tecnologica" izquierda + "Pagina X de Y" derecha.

**11. Callout boxes**: Detectar `[PENDIENTE:`, `[ALERTA:`, `[CONFIRMADO:` en markdown. Generar tabla 1 celda con:
- PENDIENTE: fondo #FEF3C7, borde izq 3pt naranja
- ALERTA: fondo #FEE2E2, borde izq 3pt rojo  
- CONFIRMADO: fondo #D1FAE5, borde izq 3pt verde

**12. Pagina de firma**: Tabla 2 columnas con recuadros de firma (cliente vs ManIAS Lab), campos nombre/fecha, validez 15 dias. Se genera automaticamente al final del documento para steps client-facing (3, 5).

---

### FASE P2 — Resumen ejecutivo visual + graficos

**13. Resumen ejecutivo con KPIs**: Despues de portada y ANTES del indice. Parsear bloque JSON `<!--EXEC_SUMMARY_JSON-->...<!--/EXEC_SUMMARY_JSON-->` del contenido. KPI boxes = tabla 4 columnas, numero grande teal 24pt, label 9pt gris, fondo #F3F4F6. Fases con barras visuales (celdas teal proporcionales). Inversion total en recuadro teal.

**14. Timeline Gantt visual**: Detectar seccion de fases en el contenido. Generar tabla con celdas coloreadas representando duracion (merge cells). Gradiente teal-verde por fase.

**15. Matriz de riesgos**: Tabla 4x4 con colores por cuadrante (rojo/naranja/amarillo/verde segun probabilidad x impacto).

**16. Prompt update** (`src/config/projectPipelinePrompts.ts`): Añadir al prompt del documento final (paso 5) instruccion de generar bloque JSON de KPIs al inicio con estructura `kpis`, `total_investment`, `roi_estimate`, `phases`.

---

### Resumen de cambios por archivo

| Archivo | Cambios |
|---|---|
| `supabase/functions/generate-document/index.ts` | Reescritura de: BRAND colors, createCoverPage (portada premium), createManualTOC (fix duplicacion), parseMarkdownTable (solo bordes horizontales, styling pro), markdownToParagraphs (callouts, headings, Calibri, spacing), createExecutiveSummary (nuevo), createSignaturePage (nuevo), createGanttTimeline (nuevo), createRiskMatrix (nuevo), buildDocx (estilos, header, footer), parseInlineFormatting (Calibri) |
| `src/config/projectPipelinePrompts.ts` | Añadir instruccion JSON de KPIs al prompt de documento final |

### Nota sobre implementacion

Dado el volumen de cambios (~800 lineas reescritas), se implementara en una sola iteracion reescribiendo el archivo completo para evitar conflictos entre ediciones parciales. El deploy se hara automaticamente.


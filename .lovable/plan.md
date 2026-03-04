

## Plan: Mejoras tipográficas y corrección del índice DOCX

### Problemas identificados

1. **Texto de párrafo no justificado** — Los párrafos normales no tienen `alignment: AlignmentType.JUSTIFIED`
2. **Fuente incorrecta** — Se usa `Arial` en todo el body; debe ser `Montserrat`
3. **Línea verde bajo H1 queda mal** — El separador accent verde tras cada H1 no aporta valor visual; eliminarlo
4. **El índice (TOC) no se genera** — `TableOfContents` de la librería `docx` solo inserta un campo TOC que Word renderiza al abrir el documento y hacer "Actualizar campos". En muchos visores (Google Docs, LibreOffice, vista previa) aparece vacío. Solución: generar un **índice manual** recorriendo los headings del contenido y creando párrafos con los títulos de sección numerados

### Cambios en `supabase/functions/generate-document/index.ts`

| Cambio | Detalle |
|---|---|
| Fuente Montserrat en body | Reemplazar `font: "Arial"` por `font: "Montserrat"` en todos los TextRun de párrafos normales, bullets, blockquotes, inline formatting y estilos del documento. Mantener Arial solo en headings y portada |
| Texto justificado | Añadir `alignment: AlignmentType.JUSTIFIED` en párrafos normales (línea 428), bullets, blockquotes y JSON body |
| Eliminar línea verde tras H1 | Borrar el bloque de párrafo accent (líneas 345-349) que inserta la barra verde después de cada H1 |
| Índice manual | Reemplazar `createTableOfContents()` por una función que: 1) Escanee el markdown buscando líneas `#` y `##`, 2) Genere párrafos con el título de cada sección (H1 sin indent, H2 con indent), 3) Esto garantiza que el índice sea visible sin necesidad de que Word actualice campos |

### Resultado
Documento con texto justificado en Montserrat, sin barras verdes bajo secciones, y con un índice de contenidos real y visible en cualquier visor.


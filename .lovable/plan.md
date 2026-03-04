

## Plan: DOCX Profesional con Tablas y Formato Comercial

### Archivo: `supabase/functions/generate-document/index.ts`

#### 1. Importar componentes de tabla
Añadir a los imports: `Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, PageNumber, NumberFormat`

#### 2. Parser de tablas Markdown
Nueva funcion `parseMarkdownTable(lines: string[], startIndex: number)` que:
- Detecta bloques de lineas que empiezan con `|`
- Parsea header row y data rows
- Genera `Table` con:
  - Header: fondo `BRAND.primary`, texto blanco bold
  - Filas alternas: zebra striping con `BRAND.light`
  - Bordes finos en gris
  - Texto con inline formatting (bold, italic)

#### 3. Actualizar `markdownToParagraphs`
Modificar el loop principal para:
- Detectar cuando una linea empieza con `|`
- Acumular lineas de tabla consecutivas
- Llamar a `parseMarkdownTable` y añadir el `Table` al array de children
- Retornar `(Paragraph | Table)[]` en vez de solo `Paragraph[]`

#### 4. Margenes de pagina profesionales
En `buildDocx`, añadir al `properties` de la seccion:
```
page: {
  margin: { top: 1440, bottom: 1440, left: 1200, right: 1200 }
}
```

#### 5. Numero de pagina en footer
Añadir `PageNumber.CURRENT` al footer junto al branding ManIAS Lab.

#### 6. Linea accent verde despues de H1
Tras cada H1, insertar un parrafo fino con shading `BRAND.accent` como separador visual.

#### 7. Actualizar tipos de retorno
`markdownToParagraphs` y `buildDocx` deben aceptar `(Paragraph | Table)[]` en `children`.

### Resultado
Documento DOCX con tablas formateadas profesionalmente (colores corporativos, zebra), margenes amplios, paginacion, y separadores visuales entre secciones.


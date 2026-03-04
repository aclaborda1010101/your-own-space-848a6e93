

## Plan: Mejoras adicionales al DOCX profesional

Analizando el generador actual, hay varias mejoras de alto impacto que aún se pueden aplicar:

### 1. Índice automático (Table of Contents)
Insertar un TOC después de la portada que liste todas las secciones H1/H2 con número de página. La librería `docx` soporta `TableOfContents` nativo que Word renderiza al abrir el documento.

### 2. Header mejorado con alineación
Actualmente el header mete todo en una línea. Mejorarlo para que el nombre del proyecto esté a la izquierda y "CONFIDENCIAL" a la derecha usando tab stops, más una línea separadora fina debajo.

### 3. Portada con metadatos en tabla invisible
Los metadatos (Cliente, Fecha, Versión) están centrados como párrafos sueltos. Colocarlos en una tabla sin bordes con dos columnas (etiqueta: valor) da un aspecto mucho más limpio y profesional.

### 4. Estilos de documento definidos
Definir estilos (`styles`) en el `Document` para que los headings tengan formato consistente sin repetir font/size/color en cada TextRun. Esto también permite que el TOC funcione correctamente.

### 5. Spacing mejorado entre secciones
Añadir más breathing room antes de las tablas y después de los bloques de bullets para que el contenido no se sienta apretado.

### Archivo a modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/generate-document/index.ts` | TOC tras portada, header con tab stops, metadatos en tabla invisible, estilos de documento, mejor spacing |

### Resultado
Documento con índice navegable, header profesional con alineación dual, portada con metadatos alineados en tabla, y estilos consistentes definidos a nivel de documento.




## Plan: Profesionalizar los documentos DOCX

### Problemas identificados
1. **"---"** aparece en los documentos (marca de ChatGPT/IA)
2. **Emojis** en documentos formales
3. **Cada sección principal** (H1) debe empezar en página nueva
4. **Marca incorrecta**: dice "Agustito Consultora Tecnológica" en vez de "ManIAS Lab."
5. **Portada** poco profesional
6. **Logo** no aparece en el documento

### Cambios

**1. Edge Function `generate-document/index.ts`**

- **Marca**: Reemplazar todas las referencias a "Agustito" / "Consultora Tecnológica" por "ManIAS Lab."
  - Cover page: "ManIAS Lab." con "IAS" en verde accent
  - Footer: "ManIAS Lab." en lugar de "Agustito · Consultora Tecnológica"
  - Header: mantener nombre del proyecto + "CONFIDENCIAL"

- **Logo en portada**: 
  - Importar `ImageRun` del paquete `docx`
  - Subir el logo a Supabase Storage (`project-documents/brand/manias-logo.png`)
  - En la edge function, descargar el logo desde storage y embeber con `ImageRun` en la portada
  - Centrado, tamaño aprox 180x60px

- **Portada profesional**: 
  - Bloque superior con fondo dark teal (#0A3039) ocupando ~40% de la página con el logo centrado en blanco/verde
  - Título del documento en grande, bold, centrado debajo
  - Nombre del proyecto en verde accent
  - Línea separadora verde accent (no "---")
  - Datos (Cliente, Fecha, Versión) en bloque inferior
  - "CONFIDENCIAL" en bold al final

- **Sanitización del markdown** (nueva función `sanitizeMarkdown`):
  - Eliminar líneas que sean solo `---`, `***`, `___` (separadores horizontales)
  - Eliminar emojis con regex Unicode (`/[\u{1F600}-\u{1FFFF}\u{2600}-\u{27FF}\u{FE00}-\u{FEFF}]/gu` etc.)
  - Aplicar antes de `markdownToParagraphs()`

- **Page break en cada H1**:
  - Antes de cada `# Sección`, insertar un `new Paragraph({ children: [new PageBreak()] })` para que cada sección principal empiece en página nueva

**2. Subir logo a Storage**
- Copiar `user-uploads://MANIAS.png` al proyecto
- Subirlo a Supabase Storage bucket `project-documents` con path `brand/manias-logo.png`
- Alternativamente, hardcodear el logo como base64 en la edge function (más fiable, sin dependencia de storage)

**3. Redeploy edge function**

### Archivos a modificar
1. `supabase/functions/generate-document/index.ts` — toda la lógica
2. Redeploy de la edge function


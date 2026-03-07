

## Problemas detectados en "Detección de necesidades"

### Problema 1: Solo permite seleccionar un archivo
El `<input type="file">` en línea 238-243 no tiene el atributo `multiple`. Hay que añadirlo.

### Problema 2: La subida falla silenciosamente para PDFs
Los console logs muestran que `pdfjs-dist` no puede cargar su worker (`pdf.worker.min.mjs` falla al importarse dinámicamente). Esto causa que `extractTextFromFile` lance una excepción, que se captura pero no sube el archivo porque el error ocurre antes del upload a Storage.

El problema raíz está en `src/lib/document-text-extract.ts` línea 4: la URL del worker apunta a una versión CDN que no se puede importar como módulo dinámico en el entorno del preview.

### Plan de cambios

**Archivo: `src/components/projects/wizard/ProjectDiscoveryPanel.tsx`**

1. Añadir `multiple` al input file (línea 238-243).
2. Modificar `handleFileUpload` para procesar múltiples archivos en bucle (actualmente solo toma `e.target.files?.[0]`). Cada archivo se sube a Storage y su texto se concatena. Se guardan las referencias de todos los archivos para crear un discovery item por archivo, o concatenar en uno solo.
3. Reestructurar el flujo: separar la extracción de texto del upload a Storage. Si la extracción falla, seguir con el upload (el archivo se sube aunque no se extraiga texto).

**Archivo: `src/lib/document-text-extract.ts`**

4. Corregir la configuración del worker de pdfjs-dist para que funcione en el entorno Vite/preview. Usar un import inline o desactivar el worker para usar el fallback, en lugar de apuntar a un CDN que falla.

### Resultado esperado
- Se pueden seleccionar y adjuntar varios archivos a la vez.
- Los archivos se suben correctamente a Storage aunque falle la extracción de texto.
- Los PDFs se procesan sin error del worker.


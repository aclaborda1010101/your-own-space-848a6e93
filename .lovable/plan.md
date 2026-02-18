

# Soporte multi-formato en importacion WhatsApp

## Contexto

Actualmente solo se aceptan archivos `.txt`. WhatsApp exporta chats en `.txt` por defecto, pero los usuarios pueden tener sus conversaciones en otros formatos (CSV de herramientas de backup, PDF exportados, etc.).

## Formatos a soportar

1. **TXT** (ya soportado) - formato nativo de WhatsApp "dd/MM/yyyy, HH:mm - Nombre: mensaje"
2. **CSV** - exportaciones de herramientas de backup (columnas tipicas: fecha, remitente, mensaje)
3. **PDF** - WhatsApp permite exportar chats como PDF; se extraera el texto con parsing
4. **ZIP** - WhatsApp exporta como .zip cuando incluye media; se extraera el .txt interno

## Cambios tecnicos

**Archivo: `src/pages/DataImport.tsx`**

### 1. Ampliar accept en los inputs

Cambiar `accept=".txt"` a `accept=".txt,.csv,.pdf,.zip"` en los tres inputs de archivo (lineas 932, 1194, 1274 aprox).

### 2. Funcion `extractTextFromFile(file: File): Promise<string>`

Nueva funcion que detecta el formato por extension y extrae el texto plano:

- **.txt / .md**: `file.text()` directamente (comportamiento actual)
- **.csv**: `file.text()` y luego convertir filas CSV a formato WhatsApp estandar (detectando columnas de fecha, remitente y mensaje)
- **.pdf**: Usar la API del navegador o una libreria ligera como `pdf.js` para extraer texto. Alternativa: enviar a una edge function que parsee el PDF
- **.zip**: Usar `JSZip` para descomprimir y buscar el archivo `.txt` dentro

### 3. Funcion `parseCSVToWhatsAppText(csvText: string): string`

Detecta el formato del CSV (con o sin headers) y convierte cada fila al formato de linea WhatsApp estandar para que `parseWhatsAppSpeakers` funcione sin cambios.

Logica:
- Si tiene headers, detectar columnas por nombre (date/fecha, sender/remitente, message/mensaje)
- Si no tiene headers, asumir orden: fecha, remitente, mensaje
- Generar lineas en formato `dd/MM/yyyy, HH:mm - Nombre: mensaje`

### 4. Actualizar `handleBulkAnalyze` y `handleWhatsAppImport`

Reemplazar las llamadas directas a `file.text()` por `extractTextFromFile(file)` en:
- `handleBulkAnalyze` (linea 324)
- El bucle de importacion bulk (linea 413)
- `handleWhatsAppImport` (linea 495)

### 5. Dependencia para ZIP

Instalar `jszip` para descomprimir archivos ZIP en el navegador.

### 6. Manejo de PDF

Para PDF, dos opciones (recomiendo la opcion A por simplicidad):
- **Opcion A**: Usar `pdfjs-dist` en el navegador para extraer texto localmente
- **Opcion B**: Enviar el PDF a una edge function que lo parsee

### 7. Actualizar textos de ayuda

Cambiar el texto "Selecciona multiples archivos .txt" por "Selecciona archivos de WhatsApp (.txt, .csv, .pdf, .zip)".

## Dependencias nuevas

- `jszip` - para descomprimir .zip
- `pdfjs-dist` - para extraer texto de PDF

## Archivos a modificar

- `src/pages/DataImport.tsx` (unico archivo de codigo)
- `package.json` (nuevas dependencias)


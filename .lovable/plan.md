
# Soporte para nuevos formatos de importacion (XLSX + TXT bloques)

## Resumen

Actualmente el sistema solo acepta CSV para contactos y backup WhatsApp, y el parser de TXT solo entiende el formato clasico `[DD/MM/YY, HH:MM] Nombre: mensaje`. Hay 3 formatos nuevos que no se soportan:

1. **XLSX** para contactos y WhatsApp (individual, masivo, backup)
2. **TXT con bloques separados por `----`** y marcadores `from Name`/`to Name`/`notification`

## Cambios

### 1. Instalar libreria XLSX

Agregar `xlsx` (SheetJS) para parsear archivos Excel. Es la libreria estandar para esto (~200KB gzip).

### 2. Crear helper de conversion XLSX a texto

En `src/lib/whatsapp-file-extract.ts`:

- Nueva funcion `convertXlsxToCSVText(file: File): Promise<string>` que lee el XLSX y lo convierte a texto CSV con las mismas columnas, para reutilizar los parsers existentes de backup CSV.
- Nueva funcion `convertContactsXlsxToCSVText(file: File): Promise<string>` para contactos.

### 3. Soporte TXT con bloques `----`

En `src/lib/whatsapp-file-extract.ts`:

- Nueva funcion `parseBlockFormatTxt(text: string, myIdentifiers: string[]): ParsedMessage[]` que parsea el formato:

```text
----------------------------------------------------
Irina  Rivero
2026-01-21 06:07:27 from Irina  Rivero (+246999358140577) - Leido

Que bobo para que se la quitaste?

----------------------------------------------------
Irina  Rivero
2026-01-21 06:20:28 to Irina  Rivero - Leido

Yo?
```

Logica:
- Detectar bloques entre lineas de `----`
- Extraer fecha (`YYYY-MM-DD HH:MM:SS`), direccion (`from`=entrante, `to`=saliente), nombre del remitente
- Ignorar bloques `notification`
- Extraer contenido del mensaje (lineas restantes del bloque)

- Nueva funcion `detectBlockFormat(text: string): boolean` para saber si un texto usa este formato (busca 3+ ocurrencias de `----` seguidas de linea con `from`/`to`)

### 4. Actualizar DataImport.tsx

**Contactos:**
- Cambiar `accept=".csv"` a `accept=".csv,.xlsx"`
- En `handleCsvPreview`: si es `.xlsx`, usar `convertContactsXlsxToCSVText()` para obtener texto CSV, luego pasar a `parseContactsCSV()` existente

**WhatsApp individual:**
- Cambiar `accept` a `".txt,.csv,.pdf,.zip,.xlsx"`
- En `handleWhatsAppImport`: si es `.xlsx`, convertir a CSV text y usar parsers de backup CSV
- Si es `.txt`, primero probar `detectBlockFormat()` y usar `parseBlockFormatTxt()` si aplica

**WhatsApp bulk (importacion rapida):**
- Cambiar `accept` a incluir `.xlsx`
- En `handleBulkAnalyze`: misma logica, si es XLSX convertir primero

**WhatsApp backup:**
- Cambiar `accept=".csv"` a `accept=".csv,.xlsx"`
- En `handleBackupAnalyze`: si es `.xlsx`, convertir a CSV text y continuar con flujo existente

### 5. Actualizar extractTextFromFile

En `whatsapp-file-extract.ts`, agregar caso para `.xlsx` que lo convierta a texto WhatsApp usando la conversion XLSX -> CSV -> texto.

## Detalle tecnico

### Formato XLSX WhatsApp (12 columnas)

Las columnas del XLSX son equivalentes al CSV de 12 columnas pero con nombres en español:

| Col XLSX | Col CSV backup |
|----------|---------------|
| Sesion de chat | chat_name (col 0) |
| Fecha del mensaje | send_date (col 1) |
| Fecha de envio | read_date (col 2) |
| Tipo | direction (col 3): Entrante/Saliente/Notificacion |
| ID del remitente | phone (col 4) |
| Nombre del remitente | contact_name (col 5) |
| Estado | status (col 6) |
| Respuesta para | reply_context (col 7) |
| Texto | message (col 8) |
| Adjunto | media_file (col 9) |
| Tipo de adjunto | media_type (col 10) |
| Informacion del adjunto | media_size (col 11) |

La conversion XLSX -> CSV simplemente escribe las filas como CSV separado por comas, y el parser `parseBackupCSVByChat` / `extractMessagesFromBackupCSV` ya funciona con ese formato.

### Formato TXT con bloques

Patron de cada bloque:
```text
----------------------------------------------------
{chatName}
{YYYY-MM-DD HH:MM:SS} {from|to} {contactName} [(phone)] - {status}

{mensaje multilinea}
```

El parser extrae: chatName de la linea 2, fecha/direccion/sender de la linea 3, y contenido de las lineas restantes hasta el siguiente `----`.

### Archivos modificados

1. `package.json` - agregar dependencia `xlsx`
2. `src/lib/whatsapp-file-extract.ts` - nuevas funciones de conversion XLSX y parser de bloques TXT
3. `src/pages/DataImport.tsx` - actualizar accepts, agregar logica XLSX y TXT bloques en handlers

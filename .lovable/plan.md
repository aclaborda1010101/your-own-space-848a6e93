

# Fix: Importacion de WhatsApp backup CSV devuelve 0 mensajes

## Problema

El archivo "WhatsApp - Angel Baena.csv" es un backup CSV de 12 columnas. El flujo actual en `handleWhatsAppImport`:

1. `extractTextFromFile()` detecta el CSV y lo convierte a lineas de texto con formato `2024-02-23 15:55:42 - Angel Baena: mensaje`
2. `parseWhatsAppSpeakers()` intenta parsear esas lineas con un regex que espera fechas DD/MM/YYYY (1-2 digitos iniciales)
3. El regex falla porque `2024` tiene 4 digitos, no 1-2
4. Resultado: 0 speakers, 0 mensajes
5. `extractMessagesFromWhatsAppTxt()` tiene el mismo problema con su regex

Ya existen funciones especificas para backup CSV (`extractMessagesFromBackupCSV`, `parseBackupCSVByChat`) en `whatsapp-file-extract.ts` que funcionan correctamente, pero no se usan en el flujo de importacion individual.

## Solucion

Modificar `handleWhatsAppImport` en `src/pages/DataImport.tsx` para detectar si el archivo es un backup CSV y usar los parsers correctos.

### Cambio en `src/pages/DataImport.tsx`

En la funcion `handleWhatsAppImport` (linea ~714):

**Antes:**
- Siempre usa `extractTextFromFile` + `parseWhatsAppSpeakers` + `extractMessagesFromWhatsAppTxt`

**Despues:**
- Detectar si el archivo es CSV
- Si es CSV, leer el texto raw y probar `parseBackupCSVByChat` para verificar si es formato backup
- Si es backup CSV: usar `extractMessagesFromBackupCSV` directamente para obtener mensajes y calcular conteos desde ahi
- Si no es backup CSV: mantener el flujo actual con `extractTextFromFile` + `parseWhatsAppSpeakers` + `extractMessagesFromWhatsAppTxt`

### Logica concreta

```text
1. Leer texto raw del archivo CSV
2. Llamar parseBackupCSVByChat(rawText) 
3. Si devuelve resultados (es backup CSV):
   a. Extraer mensajes con extractMessagesFromBackupCSV(rawText, chatName, myIdentifiers)
   b. Calcular speakers y conteos desde los mensajes extraidos
   c. Insertar mensajes en contact_messages
4. Si no es backup CSV:
   a. Continuar con el flujo existente (extractTextFromFile, etc.)
```

### Archivos a modificar

- `src/pages/DataImport.tsx`: funcion `handleWhatsAppImport` (~lineas 682-780)
  - Agregar import de `parseBackupCSVByChat` y `extractMessagesFromBackupCSV`
  - Agregar deteccion de backup CSV antes del parsing
  - Usar parsers correctos segun tipo de archivo

No se necesitan cambios en `whatsapp-file-extract.ts` ya que las funciones correctas ya existen.


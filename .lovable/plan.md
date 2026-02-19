

# Fix: Importacion de backup XLSX con deteccion dinamica de columnas

## Problema
El parser `parseBackupCSVByChat` asume columnas en posiciones fijas (formato de 12 columnas exacto). Si el XLSX tiene cabeceras, columnas en otro orden, o nombres diferentes, falla silenciosamente y muestra "No se detectó formato de backup".

## Solucion
Hacer el parser flexible para detectar automaticamente las columnas relevantes por nombre (con aliases), en lugar de asumir posiciones fijas.

## Detalle tecnico

### 1. Nuevo helper de deteccion de columnas en `src/lib/whatsapp-file-extract.ts`

Agregar una funcion `detectBackupColumns` que:
- Lee la primera fila del CSV convertido
- Busca columnas por nombre normalizado (sin acentos, minusculas) con multiples aliases:
  - Chat/Sesion/Nombre del chat -> chatName (col 0)
  - Fecha/Date/Fecha de envio -> date (col 1)
  - Tipo/Direction/Direccion -> direction (col 3)
  - Telefono/Phone/Numero -> phone (col 4)
  - Contacto/Contact/Nombre -> contactName (col 5)
  - Mensaje/Message/Texto -> message (col 8)
  - Tipo de medio/Media type -> mediaType (col 10)
- Si no encuentra headers, prueba el formato posicional actual como fallback

### 2. Modificar `parseBackupCSVByChat` en `src/lib/whatsapp-file-extract.ts`

- Usar `detectBackupColumns` para mapear columnas dinamicamente
- Mantener la logica actual como fallback si no se detectan headers
- Adaptar la deteccion de "Entrante"/"Saliente" para aceptar variantes: "incoming"/"outgoing", "enviado"/"recibido", etc.

### 3. Modificar `extractMessagesFromBackupCSV` en `src/lib/whatsapp-file-extract.ts`

- Aplicar la misma deteccion dinamica de columnas
- Usar indices detectados en lugar de posiciones fijas

### 4. Agregar logging en `handleBackupAnalyze` en `src/pages/DataImport.tsx`

- Antes de mostrar error "No se detectó formato", loguear las primeras 3 lineas del CSV convertido para debug
- Esto ayudara a diagnosticar formatos futuros no reconocidos

### Archivos modificados

1. `src/lib/whatsapp-file-extract.ts` - Deteccion dinamica de columnas en parseBackupCSVByChat y extractMessagesFromBackupCSV
2. `src/pages/DataImport.tsx` - Logging de debug en handleBackupAnalyze


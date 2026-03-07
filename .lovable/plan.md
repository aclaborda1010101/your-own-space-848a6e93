

## Diagnóstico: Problemas en la importación de WhatsApp

Tras revisar el código en profundidad, he identificado varios problemas que causan pérdida de mensajes:

### Problema 1: CSV multi-línea se rompe (CRÍTICO)
En `whatsapp-file-extract.ts`, todas las funciones usan `csvText.split('\n')` para separar filas. Si un mensaje de WhatsApp contiene saltos de línea y está correctamente escapado entre comillas en el CSV (`"Hola\nqué tal"`), el split lo rompe en fragmentos. Cada fragmento se procesa como una fila incompleta y se descarta (`cols.length < 3`). **Esto causa pérdida masiva de mensajes en backups CSV.**

### Problema 2: Errores de inserción silenciosos (CRÍTICO)
En `DataImport.tsx`, las inserciones por lotes no comprueban errores:
```typescript
await (supabase as any).from("contact_messages").insert(batch);
// No se comprueba { error } — si falla, los mensajes se pierden sin aviso
```
Esto ocurre en:
- `storeContactMessages` (línea 637)
- Importación masiva bulk (línea 532)

### Problema 3: Lotes de 500 pueden ser demasiado grandes
Mensajes largos en lotes de 500 pueden exceder el límite de payload de Supabase (~2MB), causando fallos silenciosos.

### Problema 4: Sin feedback de progreso
No hay logging ni contadores que indiquen cuántos mensajes se insertaron realmente vs. cuántos se esperaban.

---

## Plan de corrección

### 1. Fix CSV multi-línea (`whatsapp-file-extract.ts`)
Crear una función `splitCSVLines(text)` que respete campos entre comillas con saltos de línea internos. Reemplazar todos los `csvText.split('\n')` por esta función en:
- `tryParseBackupCSV`
- `parseBackupCSVByChat`
- `extractMessagesFromBackupCSV`

### 2. Verificar errores en inserciones (`DataImport.tsx`)
En `storeContactMessages` y en la importación bulk:
- Capturar `{ error, count }` del insert
- Si hay error, reintentar con lotes más pequeños (200 → 50)
- Acumular contadores de éxito/fallo
- Mostrar toast con resumen real: "X de Y mensajes importados"

### 3. Reducir batch size y añadir reintentos
- Reducir batch default de 500 a 200
- Si un lote falla, dividirlo y reintentar con lotes de 50
- Log por consola de cada lote procesado

### 4. Añadir logging de verificación
- Console.log con totales: mensajes parseados vs. insertados por chat
- Toast final con resumen preciso

### Archivos a editar
- `src/lib/whatsapp-file-extract.ts`: Nueva función `splitCSVLines`, usarla en 3 funciones
- `src/pages/DataImport.tsx`: Error handling en inserciones, reducir batch size, logging


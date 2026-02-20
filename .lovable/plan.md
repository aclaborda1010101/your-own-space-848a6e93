

# Fix: Mensajes de WhatsApp almacenados sin contenido real

## Problema detectado

**Todos los mensajes importados desde el backup CSV de WhatsApp tienen solo la fecha/hora en el campo `content`, sin el texto real del mensaje.**

Datos afectados:
- Carls Primo: 24.458 mensajes sin contenido
- Mi Nena: 44.032 mensajes sin contenido
- **Todos los contactos principales** estan afectados (100% de mensajes vacios)

Esto explica por que el analisis de la IA dice "datos insuficientes": recibe 500 mensajes pero todos contienen timestamps como "2026-02-18 12:38:11" en lugar del texto real.

## Causa raiz

El parser de backup CSV (`extractMessagesFromBackupCSV` en `src/lib/whatsapp-file-extract.ts`) esta mapeando la columna incorrecta como `message`. El formato posicional de 12 columnas asume:
- Columna 0: chat_name
- Columna 1: date
- Columna 8: message

Pero si el CSV del usuario tiene un orden de columnas diferente, o si la deteccion por headers falla parcialmente, el campo `message` puede acabar apuntando a la columna de fecha.

## Plan de solucion

### Paso 1: Diagnosticar el formato exacto del CSV

Antes de corregir el parser, necesitamos saber que formato tiene el CSV original del usuario para ajustar el mapeo. Anadiremos logging de diagnostico al proceso de importacion.

### Paso 2: Corregir el parser con validacion de contenido

En `src/lib/whatsapp-file-extract.ts`, funcion `extractMessagesFromBackupCSV`:
- Anadir una validacion post-deteccion que compruebe si el campo `message` detectado parece contener fechas en lugar de texto
- Si se detecta que el contenido son fechas, intentar buscar la columna correcta recorriendo las demas columnas que tengan texto real
- Anadir una segunda pasada de fallback: si la columna 8 contiene fechas, probar columnas 6, 7, 9 como alternativas

### Paso 3: Reimportar los mensajes afectados

Dado que los mensajes ya estan almacenados sin contenido:
- **Opcion A** (recomendada): Borrar los registros de `contact_messages` que tienen contenido tipo fecha y reimportar desde el archivo CSV original
- **Opcion B**: Si se tiene acceso al CSV original, ejecutar un script de correccion que lea el CSV, extraiga el contenido correcto y actualice los registros existentes

### Paso 4: Re-ejecutar el analisis

Una vez reimportados los mensajes con contenido real, relanzar `contact-analysis` para Carls Primo y los demas contactos afectados.

## Archivos a modificar

- `src/lib/whatsapp-file-extract.ts` — Corregir `detectBackupColumns` y `extractMessagesFromBackupCSV` con validacion de contenido
- `src/pages/DataImport.tsx` — Anadir logging de diagnostico del formato CSV

## Pregunta clave para avanzar

Para poder corregir el mapeo necesito saber el formato exacto del CSV. Tienes acceso al archivo CSV original del backup de WhatsApp? Si puedes compartir las primeras 3-5 lineas (cabeceras + datos), podre ajustar el parser exactamente al formato correcto. Alternativamente, puedo anadir un modo de diagnostico que muestre las columnas detectadas antes de importar.


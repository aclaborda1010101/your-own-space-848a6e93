

# Plan: Almacenar mensajes WhatsApp .txt y mostrar todos los contactos

## Diagnostico confirmado

1. **Contactos**: El filtro por defecto es `'top100'` (linea 797 de StrategicNetwork.tsx). Los 1800+ contactos estan en memoria pero no se muestran.
2. **Mensajes**: La tabla `contact_messages` tiene **0 registros**. El flujo `handleWhatsAppImport` solo llama a `parseWhatsAppSpeakers()` que cuenta mensajes pero NO almacena contenido. Solo el flujo de backup CSV (`handleBackupImport`) usa `storeContactMessages` para guardar mensajes reales.

---

## Cambio 1: Mostrar todos los contactos

**Archivo**: `src/pages/StrategicNetwork.tsx` linea 797

Cambiar el valor por defecto del filtro de `'top100'` a `'all'`.

---

## Cambio 2: Parser de mensajes WhatsApp .txt

**Archivo**: `src/lib/whatsapp-file-extract.ts`

Crear nueva funcion `extractMessagesFromWhatsAppTxt(text: string, chatName: string, myIdentifiers: string[]): ParsedMessage[]` que:

- Parsee cada linea del .txt exportado de WhatsApp
- Soporte ambos formatos de fecha:
  - `[DD/MM/YY, HH:MM:SS] Nombre: texto`
  - `DD/MM/YYYY, HH:MM - Nombre: texto`
  - Variantes con AM/PM, puntos, guiones como separadores de fecha
- Detecte mensajes multilinea (linea sin patron de fecha = continuacion del anterior)
- Descarte mensajes del sistema (cifrado, cambios de asunto, numeros de telefono sin nombre)
- Clasifique tipo de mensaje:
  - `text` para mensajes normales
  - `media` para "imagen omitida", "video omitido", "sticker omitido"
  - `audio` para "audio omitido"
  - `document` para "documento omitido"
  - `link` para mensajes que contienen URLs
- Convierta la fecha parseada a formato ISO (`YYYY-MM-DDTHH:MM:SS`)
- Determine `direction`: `'outgoing'` si el sender coincide con `myIdentifiers`, `'incoming'` en caso contrario

---

## Cambio 3: Almacenar mensajes en handleWhatsAppImport

**Archivo**: `src/pages/DataImport.tsx`, funcion `handleWhatsAppImport` (linea 664)

Despues de parsear speakers (linea 702), anadir:

1. Importar `extractMessagesFromWhatsAppTxt` desde `whatsapp-file-extract`
2. Llamar al nuevo parser con el texto, el nombre del chat (nombre del contacto vinculado), y los myIdentifiers
3. Insertar los mensajes en `contact_messages` en batches de 500, usando la misma estructura que `storeContactMessages`:

```text
{
  user_id: user.id,
  contact_id: linkedContactId,
  source: 'whatsapp',
  sender: m.sender,
  content: m.content,
  message_date: m.messageDate (ISO),
  chat_name: linkedContactName,
  direction: m.direction
}
```

4. Actualizar el toast de exito para incluir el numero de mensajes almacenados

---

## Secuencia de implementacion

1. Crear `extractMessagesFromWhatsAppTxt` en `whatsapp-file-extract.ts`
2. Modificar `handleWhatsAppImport` en `DataImport.tsx` para almacenar mensajes
3. Cambiar filtro por defecto en `StrategicNetwork.tsx`

## Resultado esperado

- Todos los contactos visibles en la red estrategica
- Los mensajes de WhatsApp .txt se almacenan completos en `contact_messages`
- Al hacer "Analizar IA", el edge function `contact-analysis` lee los mensajes reales y produce analisis con datos concretos


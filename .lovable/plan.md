
# Fix: Analisis IA sin datos + Tabs del panel de contacto

## Problema raiz

La tabla `contact_messages` tiene **0 filas**. La importacion masiva de WhatsApp creo contactos desde los metadatos de grupos (nombres de participantes), pero **no persistio el contenido de los mensajes** vinculado a cada contacto. Por eso:
- "Analizar con IA" devuelve "datos insuficientes" (no hay mensajes que analizar)
- `wa_message_count` es 0 en todos los contactos
- Las pestanas WhatsApp/Email/Plaud son placeholders estaticos sin funcionalidad

## Plan de cambios (4 partes)

### Parte 1: Tab WhatsApp - Importar mensajes para un contacto

**Archivo: `src/pages/StrategicNetwork.tsx`**

Reemplazar el placeholder estatico de la tab "WA" por:
- Boton "Importar WhatsApp" que abre un dialogo para subir un `.txt` exportado de WhatsApp (chat individual)
- Usa las funciones existentes de `whatsapp-file-extract.ts` para parsear el archivo
- Inserta los mensajes en `contact_messages` vinculados al `contact_id`
- Actualiza `wa_message_count` y `last_contact` en `people_contacts`
- Muestra un resumen de mensajes importados (total, rango de fechas)
- Si ya hay mensajes, muestra estadisticas basicas: total mensajes, ultimo contacto, distribucion incoming/outgoing

### Parte 2: Tab Email - Vincular emails al contacto

**Archivo: `src/pages/StrategicNetwork.tsx`**

Reemplazar el placeholder de la tab "Email" por:
- Campo para anadir una o mas direcciones de email al contacto (guardadas en `people_contacts.email` como texto, o en un array dentro de `metadata`)
- Una vez vinculado el email, buscar automaticamente en `jarvis_emails_cache` los emails que coincidan con esas direcciones (`from_address` o `to_addresses`)
- Mostrar los emails encontrados como una lista resumida (fecha, asunto, preview)

### Parte 3: Tab Plaud - Mostrar y subir conversaciones

**Archivo: `src/pages/StrategicNetwork.tsx`**

La tab Plaud ya muestra grabaciones si existen. Anadir:
- Boton "Subir conversacion" que permita pegar texto manualmente (textarea)
- Guardar como registro en `contact_messages` con `source: 'manual'`
- Esto permite al usuario anadir notas de conversaciones presenciales

### Parte 4: Tab Perfil - Cargar datos existentes

**Archivo: `src/pages/StrategicNetwork.tsx`**

El perfil ya funciona si `personality_profile` tiene datos. El problema es que sin mensajes, el analisis IA genera perfiles vacios. Con las partes 1-3 implementadas, el usuario podra:
1. Importar mensajes de WhatsApp en la tab WA
2. Pulsar "Analizar con IA"
3. El perfil se generara con datos reales

Ademas, mejorar la tab Perfil para que:
- Si no hay analisis IA pero si hay datos basicos del contacto (empresa, rol, grupos, emails), muestre esa informacion como "Datos conocidos" antes de hacer el analisis
- Muestre el campo `context` (que contiene info de grupos de WhatsApp)

## Detalle tecnico

### Flujo de importacion WhatsApp en tab contacto

```text
1. Usuario pulsa "Importar WhatsApp"
2. Selecciona archivo .txt (exportacion de chat individual)
3. Sistema parsea con extractTextFromFile + extractMessagesFromWhatsAppTxt
4. Filtra mensajes del contacto vs mensajes propios (usando my_identifiers del perfil)
5. Inserta en contact_messages con contact_id vinculado
6. Actualiza wa_message_count = count de mensajes
7. Toast de confirmacion con resumen
```

### Campos de email en contacto

Se usara el campo existente `people_contacts.email` (tipo text) para la direccion principal. Para multiples emails, se almacenaran en `metadata.emails` como array.

### Archivos modificados

- `src/pages/StrategicNetwork.tsx` - Tabs WhatsApp, Email, Plaud y Perfil con funcionalidad real
- Sin cambios en Edge Functions (la logica de analisis ya funciona, solo necesita datos)
- Sin migraciones SQL (las tablas ya existen)

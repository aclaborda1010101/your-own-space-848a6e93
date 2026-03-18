

# Plan: WhatsApp QR accesible + Chat que lee conversaciones de WhatsApp

## Problema 1: "¿Dónde escaneo el QR?"
El botón para generar y escanear el QR de WhatsApp solo existe en **Ajustes > WhatsApp Personal**, que es difícil de encontrar. El usuario está en `/data-import` donde ve el estado "Connection Closed" pero no tiene forma de reconectar desde ahí.

## Problema 2: "El chat debe poder leer los WhatsApp"
Cuando le preguntas a POTUS (el chat de Jarvis) sobre una conversación o un contacto, no tiene acceso a los mensajes de WhatsApp almacenados en `contact_messages`. Solo tiene contexto de WHOOP, tareas y perfil.

---

## Cambios propuestos

### 1. Añadir botón de reconexión WhatsApp en Data Import
**Archivo**: `src/pages/DataImport.tsx`

Cuando el estado de la instancia Evolution es "close" o "Connection Closed", mostrar un botón directo que:
- Opción A: Abra un diálogo/sheet con el `WhatsAppConnectionCard` (el mismo componente de Settings) para generar el QR sin salir de Data Import.
- Opción B: Navegue directamente a `/settings` con la sección WhatsApp abierta.

Se implementará la Opción A (diálogo inline) para que el usuario no pierda contexto.

### 2. Inyectar mensajes de WhatsApp en el contexto de POTUS
**Archivo**: `supabase/functions/potus-core/index.ts`

En la función `getChatContext`, añadir una consulta a `contact_messages` que:
- Detecte si el mensaje del usuario menciona un nombre de contacto o pregunta sobre conversaciones.
- Busque en `contact_messages` (y opcionalmente en `people_contacts`) mensajes relevantes.
- Inyecte un resumen de los últimos mensajes de ese contacto en el prompt del sistema.

Concretamente:
- Añadir una nueva función `getWhatsAppContext(supabase, userId, userMessage)` que:
  1. Extraiga nombres propios del mensaje del usuario.
  2. Busque contactos coincidentes en `people_contacts`.
  3. Para cada contacto encontrado, traiga los últimos 20-30 mensajes de `contact_messages`.
  4. Devuelva un string formateado con la conversación.
- Integrar este contexto en el system prompt de POTUS, en una sección `CONVERSACIONES WHATSAPP RELEVANTES`.

### 3. Añadir triggers de WhatsApp al router de POTUS
**Archivo**: `supabase/functions/potus-core/index.ts`

Añadir palabras clave como "whatsapp", "mensaje", "conversación", "le dije", "me dijo", "chat con" para que POTUS sepa que debe buscar contexto de mensajes.

---

## Detalle técnico

**Query para buscar mensajes por contacto**:
```typescript
// Buscar contacto por nombre
const { data: contacts } = await supabase
  .from("people_contacts")
  .select("id, name")
  .eq("user_id", userId)
  .ilike("name", `%${contactName}%`)
  .limit(3);

// Traer mensajes recientes
const { data: messages } = await supabase
  .from("contact_messages")
  .select("content, sender, direction, message_date")
  .eq("contact_id", contactId)
  .order("message_date", { ascending: false })
  .limit(30);
```

**Archivos a editar**:
1. `src/pages/DataImport.tsx` - Diálogo con WhatsAppConnectionCard
2. `supabase/functions/potus-core/index.ts` - Contexto WhatsApp en chat (deploy)


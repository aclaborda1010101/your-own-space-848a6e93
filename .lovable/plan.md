

## Plan: Añadir herramienta de búsqueda en WhatsApp al chat de JARVIS

### Qué se consigue
Podrás preguntarle a JARVIS cosas como "¿qué me dijo Álvaro sobre la web del grupo Fitz?" y buscará en tus mensajes de WhatsApp almacenados en `contact_messages`.

### Cambios en `supabase/functions/jarvis-agent/index.ts`

**1. Nueva tool definition** `search_whatsapp_messages`:
- Parámetros: `query` (qué buscar), `contact_name` (opcional, filtrar por contacto)
- Descripción clara para que el LLM la use cuando pregunten por conversaciones/mensajes

**2. Nueva función `executeSearchWhatsAppMessages`**:
- Busca en `people_contacts` por nombre (fuzzy con `ilike`)
- Consulta `contact_messages` del contacto encontrado, filtrando por `content ilike %query%`
- Devuelve hasta 30 mensajes relevantes con fecha, dirección y contenido
- Si no especifica contacto, busca en todos los mensajes del usuario (limitado a 50)

**3. Actualizar `executeTool` switch** para incluir el nuevo case

**4. Actualizar `SYSTEM_PROMPT`** para mencionar que puede buscar en conversaciones de WhatsApp

### Ejemplo de flujo
```
Usuario: "¿qué me comentó Álvaro sobre una web del grupo Fitz?"
→ JARVIS llama search_whatsapp_messages(query: "web grupo Fitz", contact_name: "Álvaro")
→ Busca en people_contacts "Álvaro" → encuentra "Álvaro Benavides"
→ Busca en contact_messages con content ilike "%web%grupo%Fitz%"
→ Devuelve mensajes relevantes al LLM
→ JARVIS responde con la info contextualizada
```

### Archivos
- **Editar**: `supabase/functions/jarvis-agent/index.ts` (nueva tool + función + prompt)


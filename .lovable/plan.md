

# Plan: Upgrade JARVIS Agent — Acceso completo a datos + Inteligencia mejorada

## Problemas actuales

1. **Sin acceso a emails**: Solo muestra asunto/remitente de no leídos en contexto. No puede buscar en el contenido (`body_text`) de emails.
2. **Sin acceso a perfiles de contactos**: No puede consultar `personality_profile`, `ai_tags`, `role`, ni el historial relacional de un contacto.
3. **Sin acceso a emails de Plaud**: Los emails con transcripciones Plaud adjuntas tienen `body_text` con el contenido, pero el chatbot no busca ahí.
4. **Modelo limitado**: Usa `gemini-2.5-flash` que es rápido pero poco profundo en razonamiento. Para preguntas complejas necesita un modelo más potente.
5. **Prompt poco agresivo con herramientas**: El agente a veces responde "no tengo esa información" sin haber usado las herramientas de búsqueda.

## Cambios

### 1. Nueva herramienta: `search_emails`
**Archivo**: `supabase/functions/jarvis-agent/index.ts`

- Tool definition con params `query` (texto), `contact_name` (opcional), `from_address` (opcional).
- Busca en `jarvis_emails_cache` por `ilike` en `subject`, `body_text`, `from_addr`, `to_addr`.
- Si hay `contact_name`, resuelve con `resolveContactName` y busca emails vinculados a las direcciones del contacto (campo `metadata.emails` en `people_contacts`).
- Devuelve remitente, asunto, fecha y fragmento del body (max 800 chars por email, max 10 resultados).

### 2. Nueva herramienta: `get_contact_profile`
**Archivo**: `supabase/functions/jarvis-agent/index.ts`

- Tool definition con param `contact_name`.
- Resuelve el nombre con `resolveContactName`.
- Devuelve: nombre, rol, `ai_tags`, `personality_profile` (completo), último contacto, conteo de mensajes WA, y notas recientes de `contact_messages` (últimos 5 mensajes).
- Permite preguntas como "¿qué sabes de Dani?" o "¿cómo es la personalidad de mi madre?"

### 3. Upgrade de modelo a `gemini-2.5-pro` para preguntas complejas
**Archivo**: `supabase/functions/jarvis-agent/index.ts`

- Detectar preguntas que requieren razonamiento (preguntas con "por qué", "analiza", "compara", multi-herramienta) y usar `google/gemini-2.5-pro`.
- Mantener `gemini-2.5-flash` para respuestas simples y modo proactivo.

### 4. System prompt reforzado
**Archivo**: `supabase/functions/jarvis-agent/index.ts`

Añadir al prompt:
- "REGLA DE ORO: NUNCA digas que no tienes información sin haber usado TODAS las herramientas relevantes primero. Si te preguntan algo sobre una persona, usa get_contact_profile + search_whatsapp_messages + search_plaud_transcriptions + search_emails."
- "EMAILS: Puedes buscar en todos los correos almacenados con search_emails. Busca por contenido, remitente o contacto."
- "PERFILES: Puedes consultar toda la información conocida de un contacto con get_contact_profile."
- "INTELIGENCIA: Cuando respondas, conecta información de múltiples fuentes. Si encuentras datos en WhatsApp Y en Plaud sobre el mismo tema, sintetízalos."
- "Si el usuario pregunta algo y no encuentras nada, di EXACTAMENTE qué herramientas usaste y qué buscaste, para que pueda reformular."

### 5. Mejorar búsqueda de WhatsApp
**Archivo**: `supabase/functions/jarvis-agent/index.ts`

- Actualmente solo busca por el término más largo. Cambiar a búsqueda `or` con múltiples términos para mayor recall.
- Aumentar límite de 30 a 50 mensajes.
- Incluir más contexto por mensaje (500 chars en vez de 300).

---

## Archivo a modificar

1. `supabase/functions/jarvis-agent/index.ts` — 2 nuevas tools + modelo mejorado + prompt reforzado + mejora búsqueda WA


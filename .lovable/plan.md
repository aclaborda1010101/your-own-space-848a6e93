

## Respuestas a tus preguntas

### 1. Como funciona la captura automatica de datos de WhatsApp

El flujo ya esta funcionando asi:

```text
WhatsApp (tu movil) 
  → Evolution API (Cloud) 
    → evolution-webhook (Edge Function)
      → Busca/crea contacto en people_contacts
      → Guarda mensaje en contact_messages
      → Si mensaje >20 chars o 5+ msgs/dia → dispara contact-analysis
      → Si contacto es favorito → genera borradores de respuesta
```

**contact-analysis** es la Edge Function que analiza los mensajes acumulados de un contacto y actualiza su perfil (bio, sentiment, tags, scores, etc.) automaticamente en `people_contacts`. Cada vez que llega un mensaje relevante, se re-analiza el contacto y se actualiza su ficha.

En resumen: **ya esta automatico**. Los contactos se crean solos, los mensajes se guardan, y los perfiles se enriquecen con IA. Solo los contactos marcados como "favoritos" reciben borradores de respuesta.

### 2. Enviar WhatsApp directamente desde las sugerencias

Actualmente las sugerencias (`SuggestedResponses`) solo copian el texto al portapapeles. Ya existe la Edge Function `send-whatsapp` que envia mensajes via la API de Meta y persiste el mensaje en el CRM. Solo falta conectarlos.

**Plan: Agregar boton "Enviar" a las sugerencias de respuesta**

#### Cambios en `src/components/contacts/SuggestedResponses.tsx`:
- Agregar un boton "Enviar" (icono Send) junto al boton de copiar en cada sugerencia
- Al hacer click: llamar `supabase.functions.invoke('send-whatsapp', { body: { contact_id, message: text } })`
- Mostrar estado de envio (loading spinner) y toast de confirmacion
- Marcar la sugerencia como "accepted" tras enviar exitosamente
- Agregar dialog de confirmacion rapido antes de enviar ("Enviar este mensaje a [contacto]?")

#### Archivos a modificar:
| Archivo | Cambio |
|---------|--------|
| `src/components/contacts/SuggestedResponses.tsx` | Agregar boton enviar + logica de envio via `send-whatsapp` |

Un solo archivo, cambio directo. La Edge Function `send-whatsapp` ya resuelve el telefono desde el `contact_id` y persiste el mensaje saliente.


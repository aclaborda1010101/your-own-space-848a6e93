

## Plan: Generar borrador con IA al hacer click en "Enviar WhatsApp" desde Proxima Accion

### Problema
Al pulsar "Enviar WhatsApp" desde la tarjeta de proxima accion, el sistema copia literalmente el `pretexto` como mensaje (ej: "Seguimiento del bienestar familiar..."). Esto no es un mensaje real, es solo una guia de contexto. Deberia generar un borrador con el clon de voz del usuario, usando el pretexto y el `que` como contexto.

### Solucion

**1. Modificar `generate-response-draft` edge function** para aceptar un nuevo modo `proactive`:
- Nuevo parametro opcional: `proactive_context` (string con el que + pretexto de la proxima accion)
- Cuando `proactive_context` esta presente, NO requiere `message_content` (no hay mensaje entrante que responder)
- El prompt cambia: en vez de "responde a este mensaje", genera "inicia una conversacion con este contexto/objetivo"
- Mantiene todo el sistema de few-shot voice cloning

**2. Modificar `StrategicNetwork.tsx`** en el onClick del boton "Enviar WhatsApp":
- En vez de copiar el pretexto como mensaje, llamar a `generate-response-draft` con `proactive_context`
- Mostrar un loading state mientras genera
- Cuando llega la respuesta, mostrar las 3 sugerencias en el dialog para que el usuario elija una (o edite)
- Mantener la opcion de escribir manualmente

### Cambios en el edge function

```typescript
// Nuevo parametro
const { contact_id, user_id, message_id, message_content, proactive_context } = await req.json();

// Si es proactivo, el prompt cambia:
const userPrompt = proactive_context
  ? `Genera 3 mensajes para INICIAR conversación con ${contact.name}. 
     Objetivo: ${proactive_context}
     Usa el mismo tono de los ejemplos.`
  : `Mensaje recibido de ${contact.name}: "${message_content}"...`;
```

### Cambios en StrategicNetwork.tsx

- Al click en "Enviar WhatsApp", llamar al edge function con `proactive_context: proximaAccion.que + " | " + proximaAccion.pretexto`
- Mostrar loading en el dialog
- Presentar las 3 sugerencias como opciones clickeables
- Al seleccionar una, cargarla en el textarea editable para revision final antes de enviar

### Archivos
- **Editar**: `supabase/functions/generate-response-draft/index.ts` (aceptar modo proactivo)
- **Editar**: `src/pages/StrategicNetwork.tsx` (generar borrador con IA en vez de copiar pretexto)


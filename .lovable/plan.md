

# Diagnóstico: Por qué no llegan los WhatsApp de "Juany"

## Hallazgo clave

La segunda captura revela el problema: estás usando un **CRM externo** (parece Chatwoot/Trengo) conectado a tu WhatsApp Business API. Ese CRM es el que tiene registrado el webhook en Meta, **no** tu Edge Function de Supabase.

```text
Juany envía "Hola", "Gggg"
        ↓
   Meta WhatsApp API
        ↓
   CRM externo (webhook registrado ahí)  ← los mensajes llegan aquí
        ✗
   Supabase whatsapp-webhook            ← nunca recibe el POST
```

Meta solo permite **un webhook URL** por app/número. Si el CRM lo tiene configurado, Supabase nunca recibirá los eventos.

## "Failed to fetch" en Test Webhook

El fix de CORS se editó en el archivo pero probablemente **no se ha desplegado** todavía. Necesita un deploy explícito de la Edge Function.

## Soluciones posibles

### Opción A: Configurar Meta para enviar a Supabase directamente
- Cambiar la Callback URL en Meta Developers a `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/whatsapp-webhook`
- Desventaja: el CRM externo dejará de recibir mensajes

### Opción B: Usar el CRM como fuente y reenviar a Supabase
- Configurar un webhook secundario en el CRM que reenvíe los eventos a tu Edge Function
- Depende de si el CRM soporta webhooks de salida

### Opción C: Doble webhook via Meta (no soportado nativamente)
- Meta no soporta múltiples URLs de webhook por app
- Se necesitaría un proxy intermedio (ej: Cloudflare Worker) que reciba y reenvíe a ambos destinos

## Acción inmediata recomendada

1. **Deploy de la Edge Function** para que el fix CORS funcione y el botón "Test Webhook" deje de dar "Failed to fetch"
2. **Decidir** si quieres que Meta envíe directamente a Supabase (perdiendo el CRM) o configurar reenvío desde el CRM

## Plan de implementación

1. Desplegar `whatsapp-webhook` con los CORS headers ya corregidos
2. Según la opción elegida, actualizar la configuración externa correspondiente

No hay cambios de código necesarios -- el problema es de configuración externa (Meta webhook URL apunta al CRM, no a Supabase).


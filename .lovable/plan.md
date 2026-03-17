

## Plan: Panel de gestion WhatsApp via Evolution API

### Situacion actual

Ya tienes:
- `evolution-webhook` funcionando (recibe mensajes y los persiste en CRM)
- `EVOLUTION_DEFAULT_USER_ID` configurado
- Tu numero conectado a Evolution API

Falta:
- Los secrets `EVOLUTION_API_URL` y `EVOLUTION_API_KEY` para que la app pueda comunicarse con tu servidor Evolution
- Una edge function para gestionar la instancia (ver QR, estado, desconectar)
- Un panel en Settings para ver el estado y reconectar si es necesario

### Paso 1: Secrets

Necesito que me des dos datos de tu servidor Evolution:
- **URL base** (ej: `https://evo.tudominio.com` o la URL que te dio Evolution Cloud
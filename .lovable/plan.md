

## Configurar Secrets de WhatsApp y Verificar

### Paso 1: Guardar secrets

Se configuraran los 2 secrets necesarios en Supabase Edge Functions:

| Secret | Valor |
|--------|-------|
| `WHATSAPP_API_TOKEN` | El token proporcionado por el usuario |
| `WHATSAPP_PHONE_ID` | `900125106527105` (proporcionado anteriormente) |

### Paso 2: Verificar webhook (GET)

Llamar al endpoint de verificacion para confirmar que funciona:

```text
GET /whatsapp-webhook?hub.mode=subscribe&hub.verify_token=jarvis-verify-token&hub.challenge=test123
```

Resultado esperado: respuesta `test123` con status 200.

### Paso 3: Test mensaje entrante (POST)

Simular un mensaje de WhatsApp para probar el flujo completo:
- Si el numero no esta vinculado, deberia responder con mensaje de bienvenida
- Si esta vinculado, deberia enrutar al gateway y generar respuesta

### Paso 4: Recordatorio token permanente

El token actual es temporal (24h). Se recordara al usuario crear un System User Token permanente en Meta Business Settings para evitar que deje de funcionar.

### Archivos a modificar

Ninguno. Solo configuracion de secrets y pruebas de verificacion.


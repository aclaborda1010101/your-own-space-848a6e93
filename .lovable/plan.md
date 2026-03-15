

# Configurar EVOLUTION_DEFAULT_USER_ID y desplegar webhook

## Estado actual
- El secreto `EVOLUTION_DEFAULT_USER_ID` **ya existe** en Supabase, pero puede tener un valor incorrecto o vacío.
- El webhook `whatsapp-webhook` ya tiene logging de diagnóstico añadido en el mensaje anterior.

## Plan

### 1. Actualizar el secreto EVOLUTION_DEFAULT_USER_ID
Usar la herramienta de secretos para establecer el valor `f103da90-81d4-43a2-ad34-b33db8b9c369` como `EVOLUTION_DEFAULT_USER_ID`.

### 2. Desplegar el webhook actualizado
El `whatsapp-webhook` con el logging de diagnóstico añadido anteriormente se desplegará automáticamente.

### 3. Verificar
Una vez desplegado, enviar un WhatsApp de prueba y revisar los logs del Edge Function para confirmar que:
- El POST llega al webhook
- El mensaje se persiste en `contact_messages`
- El toast aparece en la UI

**Archivos a desplegar:** `supabase/functions/whatsapp-webhook/index.ts` (ya editado)


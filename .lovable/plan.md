

# Sincronizar todos los emails de la bandeja

## Problema actual

La Edge Function `email-sync` tiene dos limitaciones que impiden tener contexto completo:

1. **Limite de 20 emails por sync** (linea 70): `fetchResult.slice(-20)` descarta todo excepto los ultimos 20
2. **Solo 7 dias hacia atras en primera sync** (linea 60): Si no hay `last_sync_at`, solo busca emails de la ultima semana
3. **Gmail API tambien limita a 20** (existe un `maxResults=20` en la funcion `fetchGmailMessages`)

## Cambios en `supabase/functions/email-sync/index.ts`

### 1. Eliminar limite de 20 en IMAP (linea 70)
- Cambiar `fetchResult.slice(-20)` por iterar sobre todos los resultados
- Esto aplica a Gmail via IMAP, IONOS, Outlook, iCloud

### 2. Ampliar ventana temporal inicial (linea 58-60)
- Cambiar los 7 dias por defecto a **365 dias** (1 ano) para la primera sincronizacion
- Asi la primera sync trae todo el correo reciente relevante
- Las siguientes syncs solo traen desde `last_sync_at`

### 3. Aumentar limite en Gmail API REST (funcion `fetchGmailMessages`)
- Cambiar `maxResults=20` a `maxResults=500` para traer mas emails via API
- Implementar paginacion con `nextPageToken` para traer todos los disponibles

### 4. Evitar duplicados en inserciones
- Actualmente hace `insert` sin control de duplicados
- Anadir un check por `message_id` o usar `upsert` con constraint para no insertar emails repetidos en `jarvis_emails_cache`

## Resultado

Al pulsar "Sincronizar Emails":
- Primera vez: trae todos los emails del ultimo ano
- Siguientes veces: trae solo los nuevos desde la ultima sincronizacion
- Sin limite artificial de 20 emails

## Archivo a modificar

Solo `supabase/functions/email-sync/index.ts`


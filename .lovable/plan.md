

# Plan: Refresh semanal de perfiles de contactos favoritos

## Resumen

Crear un cron semanal (domingos 4:00 AM) que re-analice los contactos favoritos con mensajes nuevos desde su último análisis. Coste estimado: ~€2.88/mes.

## Cambios

### 1. Nueva Edge Function: `contact-profiles-refresh`
**Crear**: `supabase/functions/contact-profiles-refresh/index.ts`

- Usa service role key (sin auth de usuario)
- Busca contactos favoritos (`is_favorite = true`) con `personality_profile` existente
- Filtra solo los que tienen mensajes nuevos en `contact_messages` con `created_at > people_contacts.updated_at`
- Para cada contacto stale, invoca `contact-analysis` internamente pasando el `user_id` del contacto
- Máx 15 contactos por ejecución, 5s delay entre cada uno
- Logging de cuántos contactos se actualizaron

### 2. Config
**Modificar**: `supabase/config.toml` — añadir `[functions.contact-profiles-refresh]` con `verify_jwt = false`

### 3. Cron job semanal via SQL
Ejecutar migración SQL para programar con `pg_cron`:
```sql
SELECT cron.schedule(
  'contact-profiles-weekly-refresh',
  '0 4 * * 0',  -- Domingos 4:00 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/contact-profiles-refresh',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('supabase.service_role_key')),
    body := '{}'::jsonb
  );
  $$
);
```

### Archivos
1. **Crear** `supabase/functions/contact-profiles-refresh/index.ts`
2. **Modificar** `supabase/config.toml`
3. **SQL migration** para el cron job


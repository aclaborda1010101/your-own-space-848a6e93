

## Plan: Corregir resolución de usuario en el webhook de Evolution

### Problema
El webhook `evolution-webhook` usa un `EVOLUTION_DEFAULT_USER_ID` hardcoded como variable de entorno. Cuando conectaste tu nuevo WhatsApp, los mensajes siguen yéndose al usuario anterior porque:
1. `WhatsAppConnectionCard.saveOwnership()` intenta escribir en columnas (`provider`, `access_token`) que **no existen** en `user_integrations` -- falla silenciosamente
2. El webhook no consulta quién es el dueño actual de la instancia; siempre usa el env var

### Solución

**1. Migración SQL: crear tabla `whatsapp_instance_owners`**

```sql
CREATE TABLE public.whatsapp_instance_owners (
  instance_name TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.whatsapp_instance_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own instance" 
  ON public.whatsapp_instance_owners FOR ALL TO authenticated
  USING (user_id = auth.uid());
```

**2. Edge function `evolution-webhook/index.ts`: resolver user_id dinámicamente**

Reemplazar el bloque `EVOLUTION_DEFAULT_USER_ID` por una consulta a `whatsapp_instance_owners`:

```typescript
// Resolve user_id from instance owner
const instanceName = body.instance || "jarvis-whatsapp";
const { data: owner } = await supabase
  .from("whatsapp_instance_owners")
  .select("user_id")
  .eq("instance_name", instanceName)
  .maybeSingle();

const userId = owner?.user_id || Deno.env.get("EVOLUTION_DEFAULT_USER_ID");
if (!userId) { /* return 400 */ }
```

**3. Frontend `WhatsAppConnectionCard.tsx`: corregir saveOwnership**

Cambiar `saveOwnership` para escribir en `whatsapp_instance_owners` en lugar de la tabla `user_integrations` con columnas inexistentes:

```typescript
await supabase.from("whatsapp_instance_owners").upsert({
  instance_name: INSTANCE_NAME,
  user_id: user.id,
  connected_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}, { onConflict: "instance_name" });
```

Igualmente corregir `checkOwnership` para consultar `whatsapp_instance_owners`.

**4. Actualizar `send-whatsapp` y `whatsapp-webhook`**

Misma lógica: consultar `whatsapp_instance_owners` antes de caer al fallback `EVOLUTION_DEFAULT_USER_ID`.

### Archivos a modificar
- Nueva migración SQL (tabla `whatsapp_instance_owners`)
- `supabase/functions/evolution-webhook/index.ts` -- resolver user_id dinámicamente
- `supabase/functions/send-whatsapp/index.ts` -- mismo cambio
- `supabase/functions/whatsapp-webhook/index.ts` -- mismo cambio
- `src/components/settings/WhatsAppConnectionCard.tsx` -- fix saveOwnership/checkOwnership




## Fix de errores TypeScript en Edge Functions (parche directo)

Sin más vueltas. Cambios mínimos y locales para que el build pase. No toco lógica.

### Archivos y cambios

**1. `supabase/functions/contact-profiles-refresh-all/index.ts`**

Línea 117 — forzar tipo del Set:
```ts
const uniqueUsers: string[] = Array.from(
  new Set((usersWithNet || []).map((r: any) => r.user_id as string))
);
```
Esto resuelve los 3 errores de `uid: unknown` (líneas 125, 128, 132) sin más cambios.

**2. `supabase/functions/detect-task-signals/index.ts`**

- Cambiar firmas de `pickContactsToScan`, `scanContact`, `loadPriorDecisions` para aceptar `admin: any` (resuelve los TS2345 de `SupabaseClient<...> not assignable`).
- En el bucle de `counts` (línea 118):
  ```ts
  const cid = m.contact_id as string;
  if (!cid) continue;
  counts.set(cid, (counts.get(cid) ?? 0) + 1);
  ```
- Línea 166: castear `message_date` y `content`:
  ```ts
  new Date(m.message_date as string)
  ((m.content as string) || "").slice(...)
  ```
- Antes de `extractWithLLM(contact, ...)`: castear `contact` a `{ id: string; name: string; company: string | null }`.

**3. Resto de funciones del log truncado**

Si tras redeploy aparecen más errores con el mismo patrón (`unknown` desde queries Supabase, `SupabaseClient not assignable`), aplico el mismo cast puntual (`as string` / `admin: any`) función por función. Sin refactor global.

### Reglas

- Solo casts y anotaciones. Cero cambios de lógica, payloads, RLS, ni runtime.
- Cambios reversibles línea a línea.
- No desactivo strict mode global.

### Verificación

Build limpio del proyecto. Las funciones críticas (`detect-task-signals`, `contact-profiles-refresh-all`, webhooks WhatsApp) siguen ejecutándose idénticas porque el código JS generado no cambia.


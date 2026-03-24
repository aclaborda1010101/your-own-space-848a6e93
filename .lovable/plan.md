
Objetivo: corregir el nuevo fallo del PRD y dejar estable la generación encadenada.

Diagnóstico confirmado:
- En el proyecto `876f2c76-f9fc-4fff-a0fc-d61770b23bb2`, las fases internas sí avanzaron:
  - Step 10 = `review`
  - Step 11 = `review`
  - Step 12 = `review`
- El fallo ocurre al entrar en la fase 3 (generación del PRD).
- En base de datos, el error guardado en Step 3 v2 es:
  - `PRD generation failed: {"error":"Unauthorized"}`

Causa raíz:
- `supabase/functions/project-wizard-step/index.ts` autentica todas las entradas con:
  - `supabaseUser.auth.getUser()`
- Pero la llamada recursiva de `generate_prd_chained` hacia `generate_prd` se hace ahora con:
  - `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
- Ese token no es un JWT de usuario válido para `auth.getUser()`, así que la función se auto-rechaza con `Unauthorized`.

Qué ha pasado:
- El cambio anterior evitó depender del JWT del usuario, pero en esta función concreta rompió la autenticación interna.
- O sea: no ha fallado el pipeline de alcance/auditoría/patrones; ha fallado exactamente el salto interno hacia `generate_prd`.

Plan de corrección:
1. Ajustar la autenticación interna del edge function.
   - Opción recomendada: soportar dos modos:
     - llamada externa con JWT de usuario
     - llamada interna confiable con `SUPABASE_SERVICE_ROLE_KEY`
   - Si entra por service role, exigir `stepData.user_id` o derivarlo del contexto ya validado antes.

2. Corregir la llamada recursiva de `generate_prd_chained`.
   - Mantener la llamada interna, pero enviar también el `user.id` explícitamente en `stepData`.
   - Así el tramo interno no dependerá de `auth.getUser()` para identificar al actor del proyecto.

3. Endurecer la validación de seguridad.
   - Permitir service-role solo para acciones internas controladas (`generate_prd` invocada desde el propio pipeline).
   - Mantener JWT obligatorio para entradas de usuario desde frontend.

4. Mejorar trazabilidad del error.
   - Guardar en `output_data.error` más contexto:
     - acción que falló
     - si era llamada interna
     - tipo de auth usada
   - Esto evita volver a tener un `Unauthorized` ambiguo.

5. Verificación tras aplicar el cambio.
   - Regenerar el PRD del mismo proyecto.
   - Confirmar que Step 3/5 pasan a `review`.
   - Confirmar que se crean/actualizan `project_documents`.
   - Confirmar que no reaparece `PRD generation failed: {"error":"Unauthorized"}`.

Implementación más segura:
- No dejarlo en “usar siempre service role” ni en “volver sin más al JWT”.
- Lo correcto aquí es distinguir explícitamente orquestación interna vs llamada de usuario, porque este edge function ya mezcla ambos patrones.

Resultado esperado:
- El PRD volverá a generarse completo.
- El pipeline encadenado podrá ejecutar la fase 3 sin romperse por autenticación.
- La función quedará consistente con el resto de la arquitectura de orquestación interna.

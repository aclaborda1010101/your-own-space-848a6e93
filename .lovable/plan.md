## Diagnóstico

El frontend lanza el error genérico **"La propuesta NO se regeneró (sigue en versión 1)"** porque:

1. La edge function `generate_client_proposal` (en `supabase/functions/project-wizard-step/index.ts`, líneas 2123–2156) hace `await supabase.from("project_wizard_steps").insert(...)` **sin capturar el resultado**.
2. Si ese `INSERT` falla (RLS, JSON inválido, payload demasiado grande, conflicto, etc.), la función **igualmente devuelve `200 OK`** con `{ ok: true, version: newVersion30 }`.
3. El frontend (`useProjectWizard.ts` líneas 1497–1526) verifica que la versión en BBDD haya subido. Como la fila nunca se insertó, sigue en v1 y lanza el mensaje "La propuesta NO se regeneró (...). Revisa la consola para ver el error del backend."
4. Pero el backend **nunca loggeó el error real** porque ni el cliente Supabase ni el handler lo imprimieron.

Por eso ni `error` (de `functions.invoke`) ni `data.error` se activan: el HTTP es 200 limpio, pero la fila no existe.

Confirmado en BBDD: solo existe Step 30 v1 (creado el 19:34) — no hay v2 a pesar de los reintentos.

## Cambios

### 1. Edge function `supabase/functions/project-wizard-step/index.ts` (Step 30, ~línea 2133)

Capturar el error del insert y devolver 500 con mensaje real:

```ts
const { error: insertErr } = await supabase.from("project_wizard_steps").insert({...});
if (insertErr) {
  console.error("[generate_client_proposal] INSERT failed:", insertErr);
  return new Response(JSON.stringify({
    error: `INSERT_FAILED: ${insertErr.message} (code=${insertErr.code})`,
    details: insertErr.details ?? null,
    hint: insertErr.hint ?? null,
  }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

Además, releer la fila recién insertada antes de devolver `ok:true` para confirmar persistencia:

```ts
const { data: confirm } = await supabase
  .from("project_wizard_steps")
  .select("id, version")
  .eq("project_id", projectId).eq("step_number", 30)
  .order("version", { ascending: false }).limit(1).maybeSingle();
if (!confirm || confirm.version !== newVersion30) {
  return new Response(JSON.stringify({ error: "PERSIST_VERIFY_FAILED" }), { status: 500, headers: ... });
}
```

### 2. Aplicar el mismo patrón defensivo a los otros inserts del mismo handler (Step 6 budget, Step 28 scope, etc.) sólo si están sin error-check — revisar rápidamente y arreglar los que falten.

### 3. Frontend `src/hooks/useProjectWizard.ts` (línea 1509)

Mejorar el `throw error` para extraer el cuerpo real del `FunctionsHttpError` usando el helper existente `getEdgeFunctionErrorMessage` (`src/lib/edge-function-error.ts`), de modo que el toast muestre el mensaje real (ej. `INSERT_FAILED: ...`) y no el genérico:

```ts
if (error) {
  const realMsg = await getEdgeFunctionErrorMessage(error, "Error generando propuesta cliente");
  throw new Error(realMsg);
}
```

### 4. Cache-bust en `src/main.tsx`

Actualizar el comentario `// cache-bust:` para forzar recarga.

## Resultado esperado

Al pulsar "Regenerar propuesta cliente":
- Si el insert funciona → v2 creada, propuesta actualizada con los nuevos textos.
- Si el insert falla → toast con el mensaje real del backend (ej. tamaño de payload, RLS, etc.) en lugar del mensaje genérico "Revisa la consola".

Esto desbloquea el diagnóstico definitivo y, en la mayoría de casos, también la regeneración (porque normalmente el insert sí funciona y el bug era simplemente que un error transitorio anterior se enmascaraba).

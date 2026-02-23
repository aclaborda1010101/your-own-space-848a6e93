
# Fix: 401 Unauthorized en execute-domain-analysis

## Problema diagnosticado

El job `DOMAIN_ANALYSIS` se crea correctamente en `rag_jobs`, pero cuando el `rag-job-runner` invoca `rag-architect` con action `execute-domain-analysis`, recibe **401 Unauthorized**.

**Causa raiz**: La action `execute-domain-analysis` esta dentro del bloque de autenticacion JWT (linea 2720+), pero el job runner envia el `SUPABASE_SERVICE_ROLE_KEY` como Bearer token, no un JWT de usuario. La llamada a `getClaims()` falla porque el service role key no es un token JWT valido.

## Solucion

Mover `execute-domain-analysis` al bloque de **service-role** que ya existe para `build-batch` y `post-build` (lineas 2695-2710). Este bloque valida que el token sea exactamente el service role key, que es lo que envia el job runner.

## Cambio unico en `supabase/functions/rag-architect/index.ts`

### 1. Ampliar el bloque service-role (linea 2695)

Cambiar la condicion de:
```text
if (action === "build-batch" || action === "post-build")
```
a:
```text
if (action === "build-batch" || action === "post-build" || action === "execute-domain-analysis")
```

Y dentro del bloque, agregar el routing para `execute-domain-analysis`:
```text
let result;
if (action === "build-batch") {
  result = await handleBuildBatch(body);
} else if (action === "post-build") {
  result = await handlePostBuild(body);
} else {
  // execute-domain-analysis
  const ragId = body.ragId as string;
  if (!ragId) throw new Error("ragId is required");
  const { data: ragProject, error: ragErr } = await supabase
    .from("rag_projects")
    .select("domain_description, moral_mode")
    .eq("id", ragId)
    .single();
  if (ragErr || !ragProject) throw new Error("RAG project not found");
  await analyzeDomain(ragId, ragProject.domain_description, ragProject.moral_mode);
  result = { ok: true, ragId };
}
```

### 2. Eliminar `execute-domain-analysis` del switch JWT (lineas 2782-2796)

Remover el case completo ya que ahora se maneja en el bloque service-role.

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/rag-architect/index.ts` | Mover execute-domain-analysis del switch JWT al bloque service-role |

## Resultado esperado

El job en estado RETRY (id: `9fdadf46`) se procesara en el siguiente intento del job runner. El RAG `bcb87cf0` pasara de `domain_analysis` a `waiting_confirmation` y la UI se actualizara automaticamente via polling.

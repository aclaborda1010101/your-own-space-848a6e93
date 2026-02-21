

# Fix: El RAG solo procesa una fraccion de los subdominios

## Problema raiz

El build del RAG intenta procesar 11 subdominios x 7 niveles = **77 llamadas LLM** en un solo proceso background (`EdgeRuntime.waitUntil`). Cada llamada toma ~45 segundos, lo que requeriria ~58 minutos en total. Pero la Edge Function de Supabase tiene un limite de ejecucion (wall-clock ~150s), que mata el proceso mucho antes.

Resultado actual: Solo se procesaron 8 de 77 runs (1 subdominio completo + 1 parcial del segundo). El auto-heal marco el proyecto como "completed" porque todos los runs *existentes* estan terminados, pero ignora que faltan 68 runs que nunca se crearon.

## Solucion: Arquitectura de build incremental por lotes

En lugar de ejecutar todo en un solo proceso, dividir el build en "lotes" que se procesan uno a uno. Cada invocacion de la Edge Function procesa un lote pequeno (ej: 1 subdominio = 7 niveles) y luego se auto-invoca para el siguiente lote.

### Cambios en `supabase/functions/rag-architect/index.ts`:

1. **Nueva accion `build-batch`**: Procesa un solo subdominio (7 niveles LLM). Al terminar, hace una llamada HTTP a si misma para procesar el siguiente subdominio. Asi cada invocacion dura ~5 minutos maximo (7 x 45s), bien dentro del limite.

2. **Modificar `handleConfirm` y `handleRebuild`**: En vez de lanzar `buildRag()` completo, lanza solo el primer lote con `build-batch` pasando `batchIndex: 0`.

3. **Logica de `buildBatch`**:
   - Recibe `ragId` y `batchIndex` (indice del subdominio actual)
   - Procesa los 7 niveles de investigacion para ese subdominio
   - Al terminar, si quedan mas subdominios, hace `fetch()` a si mismo con `batchIndex + 1`
   - Si es el ultimo subdominio, ejecuta el Quality Gate y marca como `completed`

4. **Arreglar auto-heal en `handleStatus`**: Ademas de comprobar que todos los runs existentes estan terminados, verificar que el numero de runs coincide con `subdomains * levels`. Si faltan runs, NO marcar como completed.

### Flujo nuevo:

```text
confirm/rebuild
  -> build-batch (subdominio 0, 7 niveles)
    -> self-invoke build-batch (subdominio 1, 7 niveles)
      -> self-invoke build-batch (subdominio 2, 7 niveles)
        -> ... (hasta subdominio N)
          -> Quality Gate -> status: completed
```

### Beneficios:
- Cada invocacion dura max ~6 minutos, dentro del limite de Supabase
- Si un lote falla, los anteriores estan guardados y se puede reintentar desde el lote que fallo
- El progreso se actualiza en tiempo real entre lotes

### Detalles tecnicos:

**`buildBatch` function** (reemplaza `buildRag`):
- Parametros: `ragId`, `batchIndex`, `serviceRoleKey` (para auto-invocarse)
- Procesa `activeSubdomains[batchIndex]` con los 7 niveles
- Usa `chatWithTimeout` (50s) para cada nivel
- Al completar, si `batchIndex + 1 < activeSubdomains.length`:
  - Hace `fetch(SUPABASE_URL + '/functions/v1/rag-architect', { body: { action: 'build-batch', ragId, batchIndex: batchIndex + 1 } })`
  - Con header `Authorization: Bearer SERVICE_ROLE_KEY` para autenticarse
- Si es el ultimo batch: ejecuta Quality Gate y marca completed

**Auto-heal mejorado en `handleStatus`**:
- Contar subdominios esperados desde `domain_map.subdomains`
- Comparar runs existentes con `expected = subdomains * 7`
- Solo marcar como completed si `runs.length >= expected` y todos estan done

### Archivos modificados:
- `supabase/functions/rag-architect/index.ts` - nueva arquitectura de lotes

### Migration SQL:
- Resetear el RAG actual a `failed` para poder regenerarlo con la nueva arquitectura


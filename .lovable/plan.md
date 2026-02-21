

# Fix: 3 problemas del RAG Architect

## Diagnostico

**Problema 1 - triggerBatch no avanza**: El batch procesa 1 subdominio x 7 niveles secuencialmente. Con Perplexity + Firecrawl + embeddings por nivel, la funcion excede el timeout (~150s) antes de terminar los 7 niveles. Solo completo 3 de 7 ("multimedia" quedo colgado). Como nunca llego a la linea 763 (`EdgeRuntime.waitUntil(triggerBatch(nextBatch))`), el segundo subdominio nunca se disparo.

**Problema 2 - Solo 1 chunk por nivel**: La tabla confirma `chunks_generated: 1` en los 3 niveles completados. El prompt de chunking pide dividir en 300-800 palabras, pero Gemini con `responseFormat: "json"` y contenido extenso tiende a colapsar todo en un solo chunk. Ademas, el contenido scrapeado puede ser corto si Firecrawl falla y el fallback directo devuelve poco.

**Problema 3 - HTML crudo en chunks**: Cuando Firecrawl falla y se usa `directFetch`, el `stripHtmlBasic` no limpia suficiente (markdown residual, headers de navegacion, boilerplate de suscripciones, etc.). Ademas, el contenido de Perplexity puede contener markdown con ruido.

## Solucion

### Cambio 1: Dividir cada nivel en su propia invocacion

En vez de procesar 7 niveles secuencialmente en un solo batch (timeout garantizado), cada batch procesa **1 subdominio x 1 nivel**. Esto da ~20s por invocacion (suficiente para Perplexity + 2-3 scrapes + chunking + embeddings).

**Archivo**: `supabase/functions/rag-architect/index.ts`

- Cambiar `batchIndex` para que codifique `(subdomainIndex, levelIndex)` en lugar de solo `subdomainIndex`
- Nuevo esquema: `batchIndex = subdomainIndex * 7 + levelIndex`
- Cada invocacion procesa exactamente 1 nivel de 1 subdominio
- Al terminar, dispara `triggerBatch(ragId, batchIndex + 1)` para el siguiente nivel/subdominio
- El total de batches sera `numSubdomains * 7`
- La Quality Gate se ejecuta solo cuando `batchIndex + 1 >= totalBatches`

Cambios concretos en `handleBuildBatch`:
- Eliminar el loop `for (const level of RESEARCH_LEVELS)` (lineas 600-743)
- Calcular `subdomainIndex = Math.floor(idx / 7)` y `levelIndex = idx % 7`
- Procesar un solo nivel con el codigo existente (sin loop)
- Actualizar la condicion de "siguiente batch" en linea 762: `nextBatch < totalBatches` donde `totalBatches = activeSubdomains.length * RESEARCH_LEVELS.length`

Cambios en `triggerBatch`:
- Ninguno, ya funciona con cualquier indice numerico

### Cambio 2: Mejorar el chunking para generar 5-10 chunks

**Archivo**: `supabase/functions/rag-architect/index.ts`, funcion `chunkRealContent`

- Agregar al prompt: "DEBES generar entre 5 y 15 chunks. Si el contenido es extenso, dividelo en mas chunks. NUNCA devuelvas solo 1 chunk."
- Si Gemini devuelve solo 1 chunk y el contenido tiene >1000 caracteres, hacer chunking manual por parrafos (split por `\n\n` o cada ~500 palabras) como fallback
- Reducir el rango de tamano por chunk de "300-800 palabras" a "200-500 palabras" para forzar mas divisiones
- Agregar log del numero de chunks generados para debugging

Fallback mecanico si Gemini devuelve < 3 chunks:
```text
1. Dividir el contenido por separadores ("---", "\n\n\n", doble salto de linea)
2. Agrupar parrafos contiguos hasta ~400 palabras
3. Para cada grupo, generar un summary con la primera oracion
4. Devolver los grupos como chunks
```

### Cambio 3: Limpiar contenido antes del chunking

**Archivo**: `supabase/functions/rag-architect/index.ts`

Agregar una funcion `cleanScrapedContent(text: string): string` que se aplica ANTES de pasar el contenido a `chunkRealContent`:

- Eliminar lineas de navegacion/UI: "Subscribe", "Sign up", "Cookie", "Privacy Policy", "Terms of Service", patron de menus
- Eliminar lineas que son solo URLs sueltas sin contexto
- Eliminar bloques de markdown repetitivos (headers `#####` consecutivos sin contenido)
- Eliminar bloques cortos (<20 chars) que son botones o labels
- Colapsar multiples saltos de linea en maximo 2
- Eliminar lineas que contienen solo emojis o simbolos decorativos

Mejorar `stripHtmlBasic`:
- Agregar eliminacion de `<aside>`, `<form>`, `<iframe>`, `<noscript>`
- Eliminar atributos `class`, `id`, `style` residuales
- Decodificar mas entidades HTML (`&quot;`, `&#39;`, etc.)

### Cambio 4: Mejorar auto-heal en handleStatus

Para evitar que el RAG quede "building" eternamente si un batch falla sin disparar el siguiente:

- En `handleStatus`, si el RAG esta en "building" y el ultimo run completado tiene >5 minutos y no hay runs "running", detectar el indice del proximo batch que deberia ejecutarse y dispararlo automaticamente
- Esto actua como "retry" automatico cuando el usuario consulta el status

## Resumen de cambios

| Archivo | Que cambia |
|---------|-----------|
| `supabase/functions/rag-architect/index.ts` | `handleBuildBatch`: 1 nivel por invocacion en vez de 7; `chunkRealContent`: prompt mejorado + fallback mecanico; nueva `cleanScrapedContent`; `stripHtmlBasic` mejorado; `handleStatus`: auto-retry de batches estancados |

## Secuencia de implementacion

1. Modificar `rag-architect/index.ts` con los 4 cambios
2. Deploy del edge function
3. Resetear el RAG actual a `failed` via SQL
4. Regenerar para probar


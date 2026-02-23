

# Fix: Rate limiting en post-build para evitar errores 429 de Gemini

## Problema raíz

Las funciones `buildKnowledgeGraph` y `detectContradictions` iteran sobre ~10 subdominios llamando a Gemini en un loop sin pausa entre iteraciones. Gemini devuelve 429 (rate limit) porque recibe demasiadas requests en poco tiempo. El error se loguea con `console.warn` y el loop continua, pero casi todos los subdominios fallan, resultando en 0 nodos de knowledge graph.

Además, el usuario pulsó el botón dos veces, disparando dos ejecuciones en paralelo, lo que duplicó la presión sobre la API.

## Solución

### 1. Agregar delays entre subdominios en `buildKnowledgeGraph` (linea ~1617)

Agregar un `await sleep(5000)` entre cada iteración del loop de subdominios para espaciar las llamadas a Gemini:

```typescript
for (const sub of activeSubdomains) {
    // Delay between subdomains to avoid Gemini rate limits
    if (activeSubdomains.indexOf(sub) > 0) {
      await new Promise(r => setTimeout(r, 5000));
    }
    // ... rest of the loop
```

### 2. Agregar delays entre subdominios en `detectContradictions` (linea ~1824)

Mismo patrón:

```typescript
for (const sub of activeSubdomains) {
    if (activeSubdomains.indexOf(sub) > 0) {
      await new Promise(r => setTimeout(r, 5000));
    }
    // ... rest of the loop
```

### 3. Agregar retry con backoff en caso de 429 en `buildKnowledgeGraph`

Envolver la llamada a `chatWithTimeout` en un retry (max 2 intentos, 10s backoff) para que si falla por rate limit, espere y reintente una vez antes de rendirse.

### 4. Deshabilitar botón durante ejecución (UI)

Prevenir que el usuario dispare múltiples ejecuciones paralelas. El botón ya tiene `disabled={regenerating}` pero el estado se resetea al terminar la invocación, no cuando el proceso background termina. Esto es menor pero se puede mejorar mostrando un mensaje de "proceso en curso".

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/rag-architect/index.ts` | Delays de 5s entre subdominios en `buildKnowledgeGraph` y `detectContradictions`, retry con backoff en llamadas Gemini |

## Resultado esperado

Con 10 subdominios y 5s de delay, el proceso completo de KG tardara ~50s en vez de ~2s, pero completara todos los subdominios sin errores 429.


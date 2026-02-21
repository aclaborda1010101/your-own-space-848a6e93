
# Fix: RAG Build se queda pillado en un nivel de research

## Problema diagnosticado

1. El research run `academic` para "Emotional Regulation in Children" tiene status `running` desde hace 20+ minutos con 0 sources/chunks
2. La edge function murio (timeout) durante la llamada a Gemini y no ejecuto el catch que marca el run como `failed`
3. El build entero esta parado porque el loop secuencial se detuvo
4. El proyecto RAG sigue en status `building` indefinidamente

## Solucion inmediata: Resetear el RAG atascado

Migration SQL para:
- Marcar el research run atascado como `failed`
- Resetear el proyecto RAG a `failed` con un error_log explicativo

## Solucion estructural: Hacer el build mas resiliente

### Cambios en `supabase/functions/rag-architect/index.ts`:

1. **Timeout por llamada LLM**: Envolver cada `chat()` en un `Promise.race` con timeout de 50s para que si Gemini no responde, el catch se ejecute y el loop continue al siguiente nivel

2. **Continuar tras error**: El catch actual ya marca el run como `failed` y continua el loop (lineas 429-437). El problema es que el timeout mata el proceso entero. Con el timeout individual por llamada, el catch se ejecutara correctamente.

3. **Detectar runs huerfanos**: En la accion `status`, si un run lleva mas de 10 minutos en `running`, marcarlo automaticamente como `failed` (auto-heal)

### Cambios concretos en el edge function:

**Nuevo helper `chatWithTimeout`:**
```
async function chatWithTimeout(messages, options, timeoutMs = 50000) {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("LLM timeout after " + timeoutMs + "ms")), timeoutMs)
  );
  return Promise.race([chat(messages, options), timeoutPromise]);
}
```

**En `buildRag`**, reemplazar las 2 llamadas a `chat()` por `chatWithTimeout()`:
- Linea 353: la llamada de generacion de chunks
- La llamada del quality gate (si existe)

**En `handleStatus`**, anadir auto-heal:
- Si algun research_run tiene status `running` y `started_at` > 10 minutos, actualizarlo a `failed` con error "Timeout detectado"

### Archivos modificados:
- `supabase/functions/rag-architect/index.ts` - timeout wrapper + auto-heal en status

### Migration SQL:
- Resetear el RAG actual atascado (marcar run como failed, proyecto como failed)

## Secuencia
1. Migration SQL para desbloquear el RAG actual
2. Edge function con timeout wrapper y auto-heal
3. Deploy

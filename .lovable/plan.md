# Plan: instrumentar coste real en las 3 funciones no trackeadas

## Objetivo
Que `/ai-costs` muestre exactamente cuánto gastan `jarvis-history-ingest`, `contact-analysis` y `process-whatsapp-media`. Hoy registran $0 y los $50/semana son invisibles.

## Estrategia (1 cambio central + 3 puntuales)

### 1. Instrumentar `_shared/ai-client.ts` (cubre `contact-analysis` entero)
`contact-analysis` hace **6 llamadas LLM** vía `chat()` del cliente compartido. En lugar de tocar 6 sitios, instrumento una sola vez en `chat()`:

- Después del `break outer` (cuando hay `result`), leer `data.usage` que devuelve el Gateway (`prompt_tokens`, `completion_tokens`).
- Si no viene `usage`, estimar con `estimateTokens()` sobre input/output.
- Añadir parámetros opcionales `userId`, `operation` a `ChatOptions` para que el caller los pase.
- Llamar `recordCost()` fire-and-forget (no bloquear si falla).

Esto trackea automáticamente las 6 llamadas de `contact-analysis` (gemini-flash + gemini-pro) sin tocar el archivo de 1358 líneas.

### 2. `jarvis-history-ingest/index.ts` — `extractMeta()` (línea 56-95)
Hace `fetch` directo al Gateway (no usa `chat()`). Añadir `recordCost()` después de parsear la respuesta:
- `service: "gemini-2.5-flash"` (modelo real que devuelve el Gateway)
- `operation: "jarvis-history-ingest:extract-meta"`
- Tokens desde `j.usage` o estimados desde el chunk de entrada y el JSON salida.
- Pasar `userId` recibido en el body de la función.

**Nota:** `embedText()` también consume (Gemini embeddings ~$0.00001/1k tokens). Lo añado también como `service: "gemini-embedding"` con `operation: "jarvis-history-ingest:embed"`.

### 3. `process-whatsapp-media/index.ts` — 3 puntos
- **`transcribeAudio`**: añadir `recordCost()` con `service: "whisper-large-v3"`, coste = `WHISPER_RATE_PER_MINUTE × duración`. Como no tenemos duración, estimar por bytes (1 MB ≈ 1 min audio comprimido).
- **`describeImage`**: `service: "gemini-2.5-flash"`, `operation: "process-whatsapp-media:vision-image"`. Usar `j.usage` si viene.
- **`extractPdfText`**: igual que image pero `operation: "process-whatsapp-media:vision-pdf"`.
- Pasar `userId` derivado del `messageId` (lookup en `contact_messages` para obtener owner) o aceptarlo en el body si el caller lo manda.

## Notas técnicas

- El Gateway de Lovable devuelve `usage: { prompt_tokens, completion_tokens, total_tokens }` en cada respuesta. Lo aprovecho cuando viene; fallback a `estimateTokens()`.
- `recordCost()` ya existe en `_shared/cost-tracker.ts` y usa SERVICE_ROLE_KEY internamente.
- Todas las llamadas a `recordCost()` son fire-and-forget con try/catch interno → cero riesgo de romper la función.
- No toco lógica de negocio, solo añado tracking.

## Verificación
1. Forzar 1 ejecución manual de cada función vía `supabase--curl_edge_functions`.
2. Query: `SELECT operation, COUNT(*), SUM(cost_usd) FROM project_costs WHERE operation LIKE 'jarvis-history-ingest%' OR operation LIKE 'process-whatsapp-media%' OR operation LIKE 'contact-analysis%' GROUP BY operation;`
3. Confirmar que `/ai-costs` muestra el desglose nuevo.

## Lo que NO toco
- Lógica de extracción, prompts, cron schedules (ya ajustados).
- Ninguna otra función.
- RLS, esquema de `project_costs` (ya tiene los campos necesarios).

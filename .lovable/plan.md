

# RAG Architect v2: Modos renombrados + Sistema de Consulta + Exportacion

## 1. Renombrar los 3 modos

Cambiar en todos los archivos de `ethical/hardcore/dios` a `estandar/profundo/total`:

| Antes | Despues | Descripcion |
|-------|---------|-------------|
| ethical | estandar | Fuentes publicas y legales, budget controlado (2-3h, 500 fuentes) |
| hardcore | profundo | + preprints, patentes, tesis, datos gov, scraping etico, 3+ idiomas (3-5h, 2000 fuentes) |
| dios | total | Exhaustividad absoluta, todas las fuentes legales del planeta, sin techo, 5+ idiomas (4-8h, 5000+) |

**Archivos afectados:**
- `supabase/functions/rag-architect/index.ts` — `getMoralPrompt()` y `getBudgetConfig()` y default en `handleCreate`
- `src/components/rag/RagCreator.tsx` — array MORAL_MODES (ids, nombres, descripciones, colores)
- `src/pages/RagArchitect.tsx` — mapa `modeIcons`
- `src/hooks/useRagArchitect.tsx` — default param en `createRag`

Nota: el modo "total" mantiene el prompt sin restricciones pero cambia la descripcion de "dark web/Tor" a "exhaustividad absoluta con todas las fuentes legales que existan".

## 2. Nuevas tablas (2)

### `rag_api_keys`
Para clientes que accedan al RAG via chat embebible o API:
- id, rag_id (FK), api_key (unique), client_name, monthly_query_limit, queries_used_this_month, is_active, expires_at, created_at

### `rag_exports`
Para trackear exportaciones:
- id, rag_id (FK), format (chat_embed/api/document_pdf/document_md/portable_package), file_path, file_size_mb, download_count, expires_at, created_at

RLS en ambas tablas via `user_owns_rag_project(rag_id)`.

## 3. Accion `query` en la Edge Function

Nuevo case en `rag-architect/index.ts`:

1. Recibe `ragId` + `question`
2. Busca chunks relevantes con keyword search (tsvector) ya que no hay embeddings generados aun
3. Reranking: envia los top 20 chunks al LLM para seleccionar los 8 mas relevantes
4. Genera respuesta con prompt que obliga a citar fuentes y no inventar
5. Guarda en `rag_query_log`
6. Devuelve answer + sources + confidence

## 4. Accion `export` en la Edge Function

Nuevo case que genera un documento Markdown estructurado por taxonomia/subdominios:
1. Lee todos los chunks, variables, contradicciones, quality checks
2. Organiza por subdominio
3. Genera markdown con resumen ejecutivo, hallazgos por subdominio, variables, fuentes, debates
4. Devuelve el markdown como string (el frontend lo descarga)

## 5. Nuevo componente: `RagChat.tsx`

Chat integrado dentro de cada RAG completado:
- Input de pregunta
- Historial de conversacion (local state)
- Cada respuesta muestra: texto, fuentes citadas (colapsables), badge de confidence
- Queries sugeridas (del domain map validation_queries)
- Boton "Exportar conocimiento" que llama a la accion export

## 6. Integracion en la UI

En `RagBuildProgress.tsx` (o en `RagArchitect.tsx` detail view):
- Cuando status === "completed", mostrar tabs: "Progreso" | "Consultar" | "Exportar"
- Tab Consultar: renderiza `RagChat`
- Tab Exportar: boton para generar y descargar MD

## 7. Hook: nuevas funciones

Anadir a `useRagArchitect.tsx`:
- `queryRag(ragId, question)`: llama action "query"
- `exportRag(ragId, format)`: llama action "export"

## Secuencia de implementacion

1. Migration SQL: 2 tablas nuevas (rag_api_keys, rag_exports) + RLS
2. Edge function: renombrar modos + anadir acciones query y export
3. Hook: anadir queryRag y exportRag
4. RagCreator: actualizar modos
5. RagChat: nuevo componente
6. RagArchitect page: actualizar modeIcons + tabs en detail view para completed RAGs
7. Deploy edge function

## Detalle tecnico

### Prompt de consulta (accion query)

```text
Eres un asistente experto en {domain}.
Tu conocimiento proviene EXCLUSIVAMENTE de los documentos proporcionados.

REGLAS:
1. Responde SOLO con informacion de los documentos.
2. Si no tienes datos suficientes, di "No tengo datos suficientes" y sugiere que buscar.
3. Cita fuentes con formato: [Fuente: nombre].
4. Si hay debates entre fuentes, presenta todos los puntos de vista.
5. Nunca inventes datos ni cites fuentes que no esten en los documentos.
6. Responde en el idioma de la pregunta.

DOCUMENTOS:
{chunks_with_metadata}
```

### Busqueda de chunks (sin embeddings por ahora)

Como los chunks no tienen embeddings generados en el build actual, la busqueda usara:
- `ILIKE` con terminos clave extraidos de la pregunta
- Ordenados por relevancia de subdominio
- Top 20 enviados al LLM para reranking a top 8

Futuro: generar embeddings con OpenAI ada-002 durante el build y usar cosine similarity via pgvector.




# Correccion Critica: RAG Architect -- De sintetico a REAL

## Resumen

Transformar el pipeline del RAG Architect de un generador sintetico (Gemini inventando contenido) a un RAG real que busca, descarga, chunkea y embeddea fuentes reales de internet.

## APIs disponibles (todas las keys ya estan configuradas)

| API | Uso | Secret |
|-----|-----|--------|
| Perplexity (sonar-pro) | Buscar fuentes reales con URLs verificadas | PERPLEXITY_API_KEY |
| Firecrawl | Descargar contenido real de URLs | FIRECRAWL_API_KEY |
| OpenAI (text-embedding-3-small) | Generar embeddings de 1024 dimensiones | OPENAI_API_KEY |
| Gemini (ya en uso) | Chunkear contenido descargado + responder queries | GOOGLE_AI_API_KEY |

## Cambios

### 1. Migracion SQL: Crear funcion `search_rag_chunks`

```sql
CREATE OR REPLACE FUNCTION search_rag_chunks(
  query_embedding vector(1024),
  match_rag_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID, content TEXT, subdomain TEXT, 
  source_name TEXT, source_url TEXT, 
  metadata JSONB, similarity FLOAT
)
```

Esta funcion hace JOIN con `rag_sources` para devolver nombre y URL de la fuente junto con cada chunk.

### 2. Reescribir `handleBuildBatch` en `rag-architect/index.ts`

El flujo actual por cada nivel de research:

```text
ACTUAL (sintetico):
  Prompt a Gemini "genera conocimiento" -> chunks inventados -> embedding NULL
```

El flujo nuevo:

```text
NUEVO (real):
  1. Perplexity sonar-pro: buscar query del subdominio+nivel -> URLs reales + citations
  2. Firecrawl: scrapear cada URL -> markdown real
  3. Gemini: organizar contenido descargado en chunks estructurados (NO inventar)
  4. OpenAI: generar embedding por chunk (text-embedding-3-small, 1024 dims)
  5. Guardar chunks + embeddings + source_id en rag_chunks
```

Detalle de cada paso dentro del loop por nivel:

**Paso 1 - Buscar fuentes reales:**
- Llamar a `https://api.perplexity.ai/chat/completions` con modelo `sonar-pro`
- Query: `"{subdominio} {nivel} {dominio}"` (ej: "developmental psychology surface regulacion emocional ninos 5 anos")
- Extraer `citations[]` (URLs reales verificadas por Perplexity) y el `content` con la respuesta
- Guardar cada URL en `rag_sources` con `source_url` real

**Paso 2 - Descargar contenido:**
- Para cada URL de las citations, llamar a Firecrawl `/v1/scrape` con `formats: ['markdown']`
- Timeout de 10s por URL, skip si falla
- Acumular todo el markdown descargado

**Paso 3 - Chunkear contenido REAL:**
- Enviar el contenido descargado a Gemini con instruccion explicita: "SOLO organiza este contenido, NO inventes nada"
- Gemini devuelve array de chunks con content, summary, concepts
- Si no hay contenido suficiente descargado, usar el texto de la respuesta de Perplexity como fallback (que tambien es contenido basado en busqueda real)

**Paso 4 - Generar embeddings:**
- Para cada chunk, llamar a OpenAI `text-embedding-3-small` con `dimensions: 1024`
- Rate limit: ~200ms entre llamadas

**Paso 5 - Guardar:**
- Insert en `rag_chunks` con el campo `embedding` poblado (ya no NULL)
- Vincular `source_id` al source real guardado en paso 1

### 3. Reescribir `handleQuery` en `rag-architect/index.ts`

Reemplazar la busqueda por `ilike` con busqueda vectorial:

```text
ACTUAL:
  keywords -> ilike '%keyword%' -> chunks

NUEVO:
  1. Generar embedding de la pregunta (OpenAI text-embedding-3-small)
  2. Llamar a search_rag_chunks() via supabase.rpc() con cosine similarity
  3. Pasar los chunks reales como contexto a Gemini
  4. Gemini responde citando fuentes reales con URLs
```

### 4. Helpers nuevos en el edge function

Se anaden las siguientes funciones helper al archivo:

- `searchWithPerplexity(query, level)`: llama a Perplexity API, devuelve `{ content, citations }`
- `scrapeUrl(url)`: llama a Firecrawl, devuelve markdown
- `generateEmbedding(text)`: llama a OpenAI embeddings, devuelve `number[]`
- `chunkRealContent(content, subdomain)`: llama a Gemini para organizar contenido real en chunks JSON
- `stripHtmlBasic(html)`: limpieza basica de HTML como fallback si Firecrawl falla

### 5. Gestion de timeouts

Cada batch procesa 1 subdominio x 7 niveles. Con las llamadas externas adicionales (Perplexity + Firecrawl + OpenAI), cada nivel tomara mas tiempo. Para mantener dentro del limite de ~150s:

- Limitar a 3-5 URLs por nivel para Firecrawl (no todas las citations)
- Timeout de 10s por scrape
- Si un nivel excede 40s total, marcar como parcial y continuar
- La arquitectura de lotes (batch por subdominio) ya mitiga el timeout global

### 6. Archivo modificado

Solo se modifica un archivo:
- `supabase/functions/rag-architect/index.ts` -- reescritura de `handleBuildBatch` y `handleQuery`, adicion de helpers

### 7. Despues de implementar

- Borrar los chunks sinteticos existentes del RAG actual
- Resetear el RAG a `failed` para poder regenerarlo
- Relanzar el build con la nueva arquitectura real
- Test de validacion: preguntar "Cuantas rabietas al dia son normales en un nino de 4 anos?" y verificar que cita fuentes reales con URLs que abren paginas reales

## Secuencia tecnica

1. Crear migracion SQL con `search_rag_chunks`
2. Modificar `rag-architect/index.ts`: nuevos helpers + reescribir `handleBuildBatch` + reescribir `handleQuery`
3. Deploy edge function
4. Resetear RAG existente via SQL
5. Probar regeneracion


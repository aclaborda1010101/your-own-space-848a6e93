

# Correccion de Calidad del RAG -- 5 Fixes Criticos

## Estado actual

El edge function `rag-architect` ya tiene implementaciones parciales de algunas de estas mejoras:
- `cleanScrapedContent` existe (lineas 323-356) pero es basica: solo filtra boilerplate por patron de linea, no elimina bloques de navegacion/footer/sidebar completos ni URLs sueltas
- `searchWithSemanticScholar` existe (lineas 217-319) y se usa para niveles academic/frontier
- El prompt de chunking (lineas 409-422) pide chunks de 200-500 palabras pero no fuerza idioma ni estructura con titulo/age_range
- No hay deduplicacion de chunks
- No hay control de idioma

## Cambios por orden de implementacion

### FIX 1 -- Mejorar cleanScrapedContent (lineas 323-356)

Reescribir la funcion para que sea mucho mas agresiva:
- Eliminar bloques completos de navegacion, footer, sidebar, cookies, newsletter, redes sociales
- Eliminar URLs sueltas que no son citas
- Filtrar lineas cortas (< 40 chars) que son menus/breadcrumbs
- Descartar contenido si despues de limpiar queda < 200 chars
- Esto ya se llama dentro de `chunkRealContent` (linea 396), asi que solo hay que mejorar la funcion

### FIX 5 -- Chunks mas pequenos y estructurados (lineas 405-431)

Actualizar el prompt de chunking en `chunkRealContent`:
- Reducir tamano objetivo a 150-400 palabras
- Forzar estructura: titulo descriptivo, contenido, conceptos, age_range, source_type
- Cada chunk = UN concepto (no mezclar temas)
- Actualizar el parsing para manejar los nuevos campos (title, age_range, source_type en metadata)

### FIX 3 -- Deduplicacion de chunks

Crear funcion SQL `check_chunk_duplicate` que busca chunks con similitud > 0.92 en el mismo RAG.

En el loop de insercion de chunks (lineas 981-1011), antes de insertar:
1. Generar embedding (ya se hace)
2. Llamar a `check_chunk_duplicate` con ese embedding
3. Si hay duplicado, skip sin insertar

### FIX 4 -- Control de idioma (lineas 405-431)

Anadir al prompt de chunking la instruccion de generar TODO en espanol, traduciendo contenido en ingles pero manteniendo terminos tecnicos originales entre parentesis y citas de autores en su idioma original.

### FIX 2 -- Mejorar busqueda academica (lineas 839-916)

La integracion de Semantic Scholar ya existe pero las queries son genericas (`subdomain domain peer-reviewed`). Mejorar con:
- Queries especificas por subdominio con autores clave (Gottman, Siegel, Shanker, Bowlby)
- Busquedas adicionales por autores clave como queries separadas
- Reducir el filtro de citationCount de > 5 a > 3 para capturar mas papers relevantes

## Detalle tecnico por archivo

### `supabase/functions/rag-architect/index.ts`

**FIX 1** - Reescribir `cleanScrapedContent` (lineas 323-356):
- Anadir patrones regex para eliminar bloques de navegacion, footer, sidebar, cookies, newsletter, share buttons, related posts
- Eliminar URLs sueltas no citadas
- Filtrar lineas < 40 chars sin punto ni dos puntos
- Return vacio si resultado < 200 chars

**FIX 5 + FIX 4** - Actualizar prompt en `chunkRealContent` (lineas 405-431):
- Tamano: 150-400 palabras por chunk
- Estructura obligatoria: title, content, concepts, age_range, source_type
- Idioma: todo en espanol, terminos tecnicos en parentesis
- Actualizar parsing (lineas 448-454) para extraer title, age_range, source_type al metadata

**FIX 3** - Anadir check de duplicados en el loop de insercion (lineas 981-1011):
- Despues de generar embedding, llamar `supabase.rpc('check_chunk_duplicate', ...)`
- Si devuelve resultado, log y continue

**FIX 2** - Mejorar queries en la seccion Semantic Scholar (lineas 839-843):
- Anadir funcion `getAcademicQueries(subdomain, domain)` que genera 3-4 queries especificas en ingles por subdominio
- Anadir busqueda de autores clave si el dominio es de psicologia/desarrollo infantil
- Ejecutar multiples busquedas en Semantic Scholar por subdomain

### Migracion SQL

Crear funcion `check_chunk_duplicate`:

```text
CREATE OR REPLACE FUNCTION check_chunk_duplicate(
  query_embedding vector(1024),
  match_rag_id UUID,
  similarity_threshold FLOAT DEFAULT 0.92
)
RETURNS TABLE (id UUID, similarity FLOAT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT rc.id, (1 - (rc.embedding <=> query_embedding))::FLOAT AS similarity
  FROM rag_chunks rc
  WHERE rc.rag_id = match_rag_id
    AND rc.embedding IS NOT NULL
    AND (1 - (rc.embedding <=> query_embedding))::FLOAT > similarity_threshold
  LIMIT 1;
END;
$$;
```

## Secuencia de implementacion

1. Migracion SQL (funcion check_chunk_duplicate)
2. Editar rag-architect/index.ts con los 5 fixes
3. Deploy del edge function
4. Para probar: borrar chunks del RAG de Bosco existente, cambiar status a "failed", y regenerar

## Archivos afectados

| Archivo | Tipo de cambio |
|---------|---------------|
| `supabase/functions/rag-architect/index.ts` | Editar (5 fixes) |
| Migracion SQL | Nueva funcion `check_chunk_duplicate` |


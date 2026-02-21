

# Integrar Semantic Scholar API para fuentes academicas reales

## Problema actual

El RAG usa Perplexity para TODOS los niveles de investigacion, incluyendo "academic" y "frontier". Perplexity busca web general y devuelve blogs de divulgacion (psicomaster.es, neuro-class.com) en lugar de papers de PubMed, journals de la AAP, o investigaciones de Siegel/Shanker/Gottman.

## Solucion

Agregar una funcion `searchWithSemanticScholar` que se use para los niveles "academic" y "frontier", y combinar sus resultados con Perplexity para los demas niveles.

Semantic Scholar API es gratuita y no requiere API key.

### Cambios en `supabase/functions/rag-architect/index.ts`

**1. Nueva funcion `searchWithSemanticScholar`**

```text
GET https://api.semanticscholar.org/graph/v1/paper/search
  ?query=emotional+regulation+preschool+children
  &limit=20
  &fields=title,abstract,url,year,citationCount,externalIds
```

La funcion:
- Construye una query academica a partir del subdominio + dominio
- Llama a la API de Semantic Scholar (sin key)
- Filtra papers por citationCount > 5 y ano > 2010 (configurable)
- Devuelve `{ papers: [{title, abstract, url, year, citations}], urls: string[] }`
- Ordena por relevancia (citationCount * recency)

**2. Modificar la logica de seleccion de fuentes en `handleBuildBatch`**

En las lineas 727-731 donde actualmente solo usa Perplexity:

```text
SI level === "academic" O level === "frontier":
  1. Buscar con Semantic Scholar (papers reales)
  2. Usar Perplexity como complemento (para reviews/meta-analisis)
  3. Combinar citations de ambos, priorizando Semantic Scholar
  4. Marcar fuentes de Semantic Scholar como tier1_gold

SI NO:
  Usar Perplexity como hasta ahora (sin cambios)
```

**3. Manejar URLs de papers academicos**

Los papers de Semantic Scholar devuelven URLs tipo:
- `https://www.semanticscholar.org/paper/HASH`
- `https://doi.org/10.xxxx/yyyy` (via externalIds.DOI)
- Links directos a PubMed via externalIds.PubMed

Para el scraping (paso 2), intentar en orden:
1. URL de DOI (suele redirigir al paper completo)
2. PubMed link (abstracts completos)
3. URL de Semantic Scholar (tiene abstract)

Si Firecrawl falla en papers (comun por paywalls), usar el abstract del paper como contenido minimo garantizado.

**4. Mejorar la query de busqueda academica**

En vez de pasar la query tal cual, construir una query academica:
- Traducir terminos clave al ingles (Semantic Scholar funciona mejor en ingles)
- Agregar terminos academicos del subdominio (del domain_map)

## Impacto esperado

| Metrica | Antes | Despues |
|---------|-------|---------|
| Tipo de fuentes (academic) | Blogs divulgacion | Papers PubMed, journals |
| Tier de calidad | tier2_silver | tier1_gold |
| Citaciones verificables | URLs genericas | DOI + PubMed IDs |
| Cobertura tematica | Superficial | Frameworks reales (Gottman, Siegel) |

## Detalles tecnicos

- API gratuita, sin key, rate limit ~100 req/5min (suficiente)
- Retry con backoff si 429
- Timeout de 10s por request
- No requiere nuevas tablas ni migraciones
- No requiere nuevos secrets
- Solo se modifica `supabase/functions/rag-architect/index.ts`

## Secuencia

1. Agregar `searchWithSemanticScholar()` al edge function
2. Modificar `handleBuildBatch` para usar Semantic Scholar en niveles academic/frontier
3. Deploy del edge function
4. Resetear RAG a failed y regenerar para probar

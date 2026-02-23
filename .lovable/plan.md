

# Regenerar Knowledge Graph: nueva action `regenerate-enrichment`

## Problema

- El RAG `bcb87cf0` tiene **0 nodos** en el knowledge graph porque `buildKnowledgeGraph` falló por rate limits 429 de Gemini durante el post-build.
- La action `post-build` es service-role only, así que no se puede invocar desde la UI directamente.
- No existe ninguna action JWT que permita al usuario re-disparar los pasos de enriquecimiento (knowledge graph, taxonomy, contradictions, quality gate).

## Solución

### 1. `rag-architect/index.ts` — Nueva action JWT `regenerate-enrichment`

Agregar un case en el switch JWT (línea ~2919, antes del `default`):

```typescript
case "regenerate-enrichment":
  // Validate ownership
  const { data: ragEnrich } = await supabase
    .from("rag_projects")
    .select("id")
    .eq("id", body.ragId)
    .eq("user_id", userId)
    .single();
  if (!ragEnrich) throw new Error("RAG not found or unauthorized");
  
  // Trigger post-build chain starting from knowledge_graph
  EdgeRuntime.waitUntil(triggerPostBuild(body.ragId, body.step || "knowledge_graph"));
  result = { status: "enrichment_started", ragId: body.ragId, step: body.step || "knowledge_graph" };
  break;
```

Esto re-dispara la cadena completa: knowledge_graph → taxonomy → contradictions → quality_gate. Si solo falta un paso, se puede pasar `step` para empezar desde ahí.

### 2. `useRagArchitect.tsx` — Nueva función `regenerateEnrichment`

```typescript
const regenerateEnrichment = async (ragId: string, step: string = "knowledge_graph") => {
  const data = await invoke("regenerate-enrichment", { ragId, step });
  toast.success("Regeneración de enriquecimiento iniciada");
  await refreshStatus(ragId);
  return data;
};
```

### 3. `RagBuildProgress.tsx` — Botón "Regenerar Knowledge Graph"

Visible cuando el RAG está completado. Invoca `regenerateEnrichment`.

### 4. `RagArchitect.tsx` — Pasar la nueva función al componente

Añadir `onRegenerateEnrichment` como prop.

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/rag-architect/index.ts` | Nueva action JWT `regenerate-enrichment` (1 case en switch) |
| `src/hooks/useRagArchitect.tsx` | Nueva función `regenerateEnrichment` |
| `src/components/rag/RagBuildProgress.tsx` | Botón "Regenerar Knowledge Graph" |
| `src/pages/RagArchitect.tsx` | Pasar prop al componente |

## Flujo

```text
Usuario pulsa "Regenerar Knowledge Graph"
  → useRagArchitect.regenerateEnrichment(ragId)
  → rag-architect action "regenerate-enrichment" (JWT)
  → Valida ownership
  → EdgeRuntime.waitUntil(triggerPostBuild(ragId, "knowledge_graph"))
  → Post-build chain: KG → Taxonomy → Contradictions → Quality Gate
  → RAG se actualiza con el resultado final
```




# Plan: Fix Knowledge Graph Regeneration UX

## Problema

El botton "Regenerar Knowledge Graph" no da feedback real: el spinner desaparece tras la llamada HTTP pero el proceso background tarda ~60s. Ademas, si el usuario no esta logueado, falla silenciosamente.

## Cambios en `src/components/rag/RagBuildProgress.tsx`

### 1. Imports nuevos
- Agregar `useEffect, useRef` a los imports de React
- Importar `supabase` desde `@/integrations/supabase/client`

### 2. Nuevo estado
```typescript
const [isRegenerating, setIsRegenerating] = useState(false);
const [kgNodeCount, setKgNodeCount] = useState<number>(0);
const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

### 3. useEffect para cargar count inicial de nodos KG
Al montar, consultar `rag_knowledge_graph_nodes` con `count: 'exact', head: true` filtrado por `rag_id`. Tambien limpiar interval al desmontar.

### 4. Handler `handleRegenerateKG` reemplaza el onClick inline
1. Verificar sesion: `supabase.auth.getSession()` → si no hay session, `toast.error("Debes iniciar sesion")` y return
2. `setIsRegenerating(true)`
3. `toast.info("Regeneracion iniciada. ~60 segundos...", { duration: 10000 })`
4. Invocar `onRegenerateEnrichment(rag.id, "knowledge_graph")`
5. Iniciar polling cada 10s (max 12 polls = 2 min):
   - Query count de nodos KG
   - Actualizar `kgNodeCount`
   - Si count > 0 y pollCount > 3 y count estable (igual al anterior) → clearInterval + toast.success + setIsRegenerating(false)
   - Si pollCount >= 12 y count === 0 → toast.error + clearInterval + setIsRegenerating(false)

### 5. Boton actualizado
- `disabled={isRegenerating || regenerating}`
- Label dinamico: "Regenerando... (N nodos)" durante proceso, "Regenerar KG (N nodos)" si ya hay nodos, "Regenerar Knowledge Graph" si 0

### 6. Cleanup del interval en useEffect return

## Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/rag/RagBuildProgress.tsx` | Auth check, toast informativo, polling de nodos KG, label dinamico, count inicial |

No se tocan Edge Functions.


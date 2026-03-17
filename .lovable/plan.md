

## Plan: Eliminar RAG Architect de la app (frontend)

El RAG Architect ya tiene su ruta redirigida a `/projects`. Solo quedan archivos muertos en el frontend que hay que eliminar. Las edge functions backend (`rag-architect`, `rag-job-runner`, `rag-recovery`) y las tablas de DB se mantienen porque otros sistemas las usan (Expert Forge, pipeline, embed público).

### Archivos a eliminar (10 archivos)

| Archivo | Razón |
|---------|-------|
| `src/pages/RagArchitect.tsx` | Página principal del RAG Architect |
| `src/hooks/useRagArchitect.tsx` | Hook del RAG Architect |
| `src/components/rag/RagCreator.tsx` | Formulario de creación |
| `src/components/rag/RagDomainReview.tsx` | Review de dominio |
| `src/components/rag/RagBuildProgress.tsx` | Progreso de build |
| `src/components/rag/RagChat.tsx` | Chat del RAG |
| `src/components/rag/RagApiTab.tsx` | Tab de API keys |
| `src/components/rag/RagIngestionConsole.tsx` | Consola de ingesta |
| `src/components/rag/RagHealthTab.tsx` | Tab de salud |
| `src/components/rag/RagEvidenceInspector.tsx` | Inspector de evidencia |

### Archivos a modificar (2 archivos)

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Eliminar lazy import de `RagEmbed`, eliminar ruta `/rag-architect` y `/rag/:ragId/embed` |
| `src/pages/RagEmbed.tsx` | Eliminar (embed público del RAG) |

### Lo que NO se toca
- Edge functions: `rag-architect/`, `rag-job-runner/`, `rag-recovery/` — los usa Expert Forge y el pipeline
- Tablas DB: `rag_projects`, `rag_sources`, `rag_chunks`, etc. — datos existentes
- `supabase/functions/_shared/rag-loader.ts` — lo usan otros agentes




## Fix: Eliminar contradicción pgvector vs RAG externo en PRD

Three targeted edits in `src/config/projectPipelinePrompts.ts`:

### 1. PRD_SYSTEM_PROMPT (line ~552)

After the existing "PROHIBIDO mencionar: Next.js, Express..." line, add a new rule:

```
Si el proyecto consume RAG como servicio externo (deployment_mode SAAS), la regla de traducción Qdrant→pgvector NO aplica. No traducir bases vectoriales al schema del cliente. El RAG es un servicio externo consumido via proxy Edge Function.
```

### 2. buildPrdPart2Prompt — servicesBlock for RAG (line ~660-668)

When `rag.necesario === true` AND `deployment_mode === "SAAS"`, append a stronger prohibition after the existing `- NO crear tablas de RAG en el schema SQL`:

```
PROHIBIDO: No crear tablas pgvector, rag_chunks, embeddings ni ninguna infraestructura vectorial en el schema SQL. El RAG es un servicio externo consumido via rag-proxy. La única tabla relacionada con IA en el schema del cliente es auditoria_ia para logging.
```

This replaces the softer existing line `- NO crear tablas de RAG en el schema SQL`.

### 3. buildPrdPart4Prompt — QA Checklist (lines ~968-975)

Add a conditional exclusion: when `deployment_mode === "SAAS"`, inject a checklist note stating pgvector must NOT be enabled, and ensure no vectorial infrastructure appears in the SQL schema block.

Add after the QA Checklist items:
```
${params.servicesDecision?.deployment_mode === 'SAAS' ? '- [ ] Verificar que NO existe pgvector, rag_chunks ni embeddings en el schema SQL (RAG es servicio externo)\n' : ''}
```

### Files modified

| File | Lines | Change |
|---|---|---|
| `src/config/projectPipelinePrompts.ts` | ~552 | Add SAAS/pgvector exclusion rule to PRD_SYSTEM_PROMPT |
| `src/config/projectPipelinePrompts.ts` | ~660-668 | Strengthen RAG prohibition in Part 2 services block |
| `src/config/projectPipelinePrompts.ts` | ~968-975 | Add conditional QA check excluding pgvector when SAAS |


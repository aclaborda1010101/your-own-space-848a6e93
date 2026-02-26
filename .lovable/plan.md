

## Plan: Limpieza Bosco + Regenerar Alarmas

### Paso 1: Marcar batch huérfano como DONE (SQL via insert tool)

```sql
UPDATE rag_jobs 
SET status = 'DONE', locked_by = NULL, locked_at = NULL
WHERE id = '70830ff9-4653-41d7-a315-7cef002866e5';
```

Job `70830ff9` (batch #10, `POST_BUILD_TAXONOMY_BATCH`) lleva stuck en `RUNNING`. Lo cerramos.

### Paso 2: Normalizar categoría duplicada (SQL via insert tool)

```sql
UPDATE rag_variables 
SET category = 'contexto'
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000' AND category = 'context';
```

1 registro afectado. Bosco queda con 204 variables, categorías limpias.

### Paso 3: Regenerar RAG de Alarmas

El RAG de alarmas (`8dd7011c`, "Regulación y cumplimiento normativo para instalaciones de alarmas", 185 fuentes, 92 chunks, 4 variables) se regenera desde la UI con el botón **Regenerar**. El pipeline completo (domain analysis → research → build → post-build con fan-out de taxonomía) correrá automáticamente.

**No requiere cambios de codigo.** Solo 2 UPDATEs SQL y un clic en la UI.

### Estado actual verificado
- **Bosco**: 204 variables reales en `rag_variables`, `total_variables` en proyecto dice 8 (desincronizado, se puede actualizar opcionalmente)
- **Alarmas**: completed con 4 variables, listo para rebuild


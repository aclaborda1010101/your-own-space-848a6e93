

## Plan: Marcar RAG Bosco como `completed`

El RAG de Bosco (`8edd368f`) está en `post_processing` con todo el pipeline terminado. Solo falta actualizar el status a `completed`.

### Implementación

1. **SQL UPDATE** (via insert tool): Cambiar `status` a `completed` y `current_phase` a 12 en `rag_projects` para el id `8edd368f-31c2-4522-8b47-22a81f4a0000`.

```sql
UPDATE rag_projects 
SET status = 'completed', current_phase = 12, updated_at = now()
WHERE id = '8edd368f-31c2-4522-8b47-22a81f4a0000';
```

No requiere cambios de código ni migraciones.


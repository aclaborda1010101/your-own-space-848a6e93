-- Paso 1: Marcar batch huérfano #10 como DONE
UPDATE rag_jobs 
SET status = 'DONE', locked_by = NULL, locked_at = NULL
WHERE id = '70830ff9-4653-41d7-a315-7cef002866e5';

-- Paso 2: Normalizar categoría duplicada context → contexto
UPDATE rag_variables 
SET category = 'contexto'
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000' AND category = 'context';
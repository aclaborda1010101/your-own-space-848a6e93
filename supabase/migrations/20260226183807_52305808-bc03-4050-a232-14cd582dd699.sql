-- Set Bosco RAG back to building so resume can work
UPDATE rag_projects SET status = 'building', updated_at = now() 
WHERE id = '8edd368f-31c2-4522-8b47-22a81f4a0000';

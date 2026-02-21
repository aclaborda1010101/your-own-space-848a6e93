-- Reset stuck research run
UPDATE public.rag_research_runs 
SET status = 'failed', 
    error_log = 'Timeout: Edge function died during Gemini API call. Auto-recovered.'
WHERE id = 'ea709bbb-27ee-4a8d-8a21-0d75b0cd9122' 
  AND status = 'running';

-- Reset stuck RAG project
UPDATE public.rag_projects 
SET status = 'failed', 
    error_log = 'Build interrupted: LLM timeout en nivel academic. El sistema se ha recuperado automáticamente. Puedes reintentar la construcción.',
    updated_at = now()
WHERE id = '8edd368f-31c2-4522-8b47-22a81f4a0000' 
  AND status = 'building';
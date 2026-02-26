
-- Unstick batch 26: mark all stuck SEL/frontier runs as completed
UPDATE rag_research_runs 
SET status = 'completed', completed_at = now()
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000'
  AND subdomain = 'Social-Emotional Learning (SEL)' 
  AND research_level = 'frontier'
  AND status IN ('running', 'partial');

-- Ensure project is in building status so pipeline can continue
UPDATE rag_projects SET status = 'building', updated_at = now()
WHERE id = '8edd368f-31c2-4522-8b47-22a81f4a0000';

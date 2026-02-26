
-- Step 1: Delete old POST_BUILD jobs for Bosco
DELETE FROM rag_jobs 
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000'
  AND job_type IN ('POST_BUILD_KG','POST_BUILD_TAXONOMY','POST_BUILD_CONTRA','POST_BUILD_QG');

-- Step 2: Delete old KG edges and nodes
DELETE FROM rag_knowledge_graph_edges WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000';
DELETE FROM rag_knowledge_graph_nodes WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000';

-- Step 3: Enqueue POST_BUILD_KG jobs (1 per subdomain with chunks)
INSERT INTO rag_jobs (rag_id, job_type, payload) VALUES
  ('8edd368f-31c2-4522-8b47-22a81f4a0000', 'POST_BUILD_KG', '{"subdomain":"Emotional Regulation in Children"}'::jsonb),
  ('8edd368f-31c2-4522-8b47-22a81f4a0000', 'POST_BUILD_KG', '{"subdomain":"Early Childhood Developmental Psychology"}'::jsonb),
  ('8edd368f-31c2-4522-8b47-22a81f4a0000', 'POST_BUILD_KG', '{"subdomain":"Child Psychopathology and Early Warning Signs"}'::jsonb),
  ('8edd368f-31c2-4522-8b47-22a81f4a0000', 'POST_BUILD_KG', '{"subdomain":"Social-Emotional Learning (SEL)"}'::jsonb);

-- Step 4: Enqueue POST_BUILD_TAXONOMY, CONTRA, QG
INSERT INTO rag_jobs (rag_id, job_type, payload) VALUES
  ('8edd368f-31c2-4522-8b47-22a81f4a0000', 'POST_BUILD_TAXONOMY', '{}'::jsonb),
  ('8edd368f-31c2-4522-8b47-22a81f4a0000', 'POST_BUILD_CONTRA', '{}'::jsonb),
  ('8edd368f-31c2-4522-8b47-22a81f4a0000', 'POST_BUILD_QG', '{}'::jsonb);

-- Step 5: Update project counters to reflect actual chunks
UPDATE rag_projects 
SET total_chunks = (SELECT count(*) FROM rag_chunks WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000'),
    current_phase = 8,
    updated_at = now()
WHERE id = '8edd368f-31c2-4522-8b47-22a81f4a0000';

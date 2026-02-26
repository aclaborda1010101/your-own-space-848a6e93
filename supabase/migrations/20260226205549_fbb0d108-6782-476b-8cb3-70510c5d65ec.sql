-- Execute taxonomy fan-out for Bosco RAG
-- First clear old variables, then enqueue batches
DELETE FROM rag_variables WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000';

-- Enqueue taxonomy batches (100 chunks each = ~14 batches for 1346 chunks)
SELECT enqueue_taxonomy_batches_for_rag('8edd368f-31c2-4522-8b47-22a81f4a0000', 100);

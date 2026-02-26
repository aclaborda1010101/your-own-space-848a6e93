-- Clean old taxonomy jobs so we can re-enqueue
DELETE FROM rag_jobs 
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000'
  AND job_type IN ('POST_BUILD_TAXONOMY_BATCH', 'POST_BUILD_TAXONOMY_MERGE');

-- Re-enqueue with fixed parser
SELECT enqueue_taxonomy_batches_for_rag('8edd368f-31c2-4522-8b47-22a81f4a0000', 100);


UPDATE rag_projects SET total_variables = (
  SELECT count(*) FROM rag_variables WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000'
) WHERE id = '8edd368f-31c2-4522-8b47-22a81f4a0000';

-- Activate auto_patterns for the Test Pipeline E2E project linked to the farmacias RAG
UPDATE business_projects 
SET auto_patterns = true, updated_at = now() 
WHERE id = '13c97278-66a6-4683-b88a-fdc0805e4c60';

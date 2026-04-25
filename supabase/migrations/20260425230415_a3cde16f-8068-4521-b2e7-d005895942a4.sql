-- Limpieza de Steps legacy SOLO para el proyecto AFFLUX.
-- Esto permite que el pipeline v2 escriba un Step 3 limpio sin colisión.
DELETE FROM public.project_wizard_steps
WHERE project_id = '6ef807d1-9c3b-4a9d-b88a-71530c3d7aaf'
  AND step_number IN (3, 5, 10, 11, 12);

-- Add plaud_transcription to allowed resource types
ALTER TABLE public.resource_shares DROP CONSTRAINT resource_shares_type_check;
ALTER TABLE public.resource_shares ADD CONSTRAINT resource_shares_type_check 
  CHECK (resource_type = ANY (ARRAY['business_project','task','rag_project','pattern_detector_run','people_contact','calendar','check_in','data_source','bl_audit','plaud_transcription']));

-- Share all plaud_transcriptions from agustin to alvaro (wildcard share with resource_id NULL)
INSERT INTO public.resource_shares (owner_id, shared_with_id, resource_type, role, resource_id)
VALUES (
  'f103da90-81d4-43a2-ad34-b33db8b9c369',
  '0279125f-3ced-4016-ad38-df2361e98ea6',
  'plaud_transcription',
  'editor',
  NULL
)
ON CONFLICT DO NOTHING;

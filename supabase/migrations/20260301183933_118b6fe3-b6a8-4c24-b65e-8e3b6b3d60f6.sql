ALTER TABLE resource_shares DROP CONSTRAINT resource_shares_type_check;
ALTER TABLE resource_shares ADD CONSTRAINT resource_shares_type_check 
  CHECK (resource_type = ANY(ARRAY[
    'business_project','task','rag_project','pattern_detector_run',
    'people_contact','calendar','check_in','data_source','bl_audit'
  ]));
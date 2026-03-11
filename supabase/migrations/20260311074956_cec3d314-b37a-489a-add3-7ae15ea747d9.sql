
-- Delete wizard steps
DELETE FROM project_wizard_steps WHERE project_id = 'ecba2096-b7ff-4307-8c8a-9a8a9160f292';

-- Delete timeline attachments first (FK dependency)
DELETE FROM business_project_timeline_attachments WHERE project_id = 'ecba2096-b7ff-4307-8c8a-9a8a9160f292';

-- Delete timeline events
DELETE FROM business_project_timeline WHERE project_id = 'ecba2096-b7ff-4307-8c8a-9a8a9160f292';

-- Delete live summary
DELETE FROM business_project_live_summary WHERE project_id = 'ecba2096-b7ff-4307-8c8a-9a8a9160f292';

-- Delete discovery items
DELETE FROM business_project_discovery WHERE project_id = 'ecba2096-b7ff-4307-8c8a-9a8a9160f292';

-- Reset project to step 1 with no content
UPDATE business_projects 
SET current_step = 1, 
    input_content = NULL,
    analysis = NULL,
    updated_at = now()
WHERE id = 'ecba2096-b7ff-4307-8c8a-9a8a9160f292';

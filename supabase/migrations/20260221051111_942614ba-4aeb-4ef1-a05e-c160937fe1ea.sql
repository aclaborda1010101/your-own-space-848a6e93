CREATE POLICY "Authenticated users can insert templates"
ON bl_questionnaire_templates FOR INSERT
TO authenticated
WITH CHECK (true);
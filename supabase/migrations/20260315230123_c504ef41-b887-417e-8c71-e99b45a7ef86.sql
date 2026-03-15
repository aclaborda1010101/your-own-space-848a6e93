-- Delete plaud transcription emails without body to allow re-sync with body fetch
DELETE FROM jarvis_emails_cache 
WHERE email_type = 'plaud_transcription' 
  AND (body_text IS NULL OR length(body_text) < 50);
-- Insert Outlook account with ENV: marker for password resolution
INSERT INTO email_accounts (user_id, provider, email_address, display_name, imap_host, imap_port, credentials_encrypted, is_active)
VALUES (
  'f103da90-81d4-43a2-ad34-b33db8b9c369',
  'outlook',
  'aclaborda@outlook.com',
  'Outlook Agustin',
  'outlook.office365.com', 993,
  '{"password": "ENV:OUTLOOK_APP_PASSWORD"}'::jsonb,
  true
);
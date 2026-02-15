-- Delete misconfigured accounts
DELETE FROM email_accounts WHERE id IN ('1a4234e1-706c-402d-aafc-d3f7d5c73b93', 'a64b6958-5e5f-4d60-b2f8-4b740a8b2059', 'bd7386b1-576c-4dfe-a744-a8f8b027abbd');

-- Insert correct accounts
INSERT INTO email_accounts (user_id, provider, email_address, display_name, is_active)
VALUES 
  ('ef287d8b-7f59-4782-8a5b-54e562e9a149', 'gmail', 'agustin.cifuentes@agustitogrupo.com', 'Agustitogrupo', true),
  ('ef287d8b-7f59-4782-8a5b-54e562e9a149', 'gmail', 'agustin@hustleovertalks.com', 'Hustle Over Talks', true),
  ('ef287d8b-7f59-4782-8a5b-54e562e9a149', 'outlook', 'aclaborda@outlook.com', 'Outlook Personal', true);
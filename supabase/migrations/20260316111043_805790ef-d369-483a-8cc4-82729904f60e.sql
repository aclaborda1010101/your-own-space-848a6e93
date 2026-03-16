-- Delete the failing Outlook account
DELETE FROM email_accounts WHERE id = '702e48a3-057a-4a15-b8a3-8d2d787fb249';

-- Update cron job from */10 to */28 minutes (2 runs = 56 min for both accounts)
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'email-sync-auto'),
  '*/28 * * * *'
);
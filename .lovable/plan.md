

# Fix Email Sync: Outlook + Constraint + Filtering

## Problems Found

### 1. No Outlook account configured
The `email_accounts` table only has Gmail and IONOS accounts. There is no Outlook account at all, so syncing "outlook" does nothing.

### 2. Upsert constraint is broken
The unique index `idx_jarvis_emails_cache_unique_msg` was created with `WHERE (message_id IS NOT NULL)` -- a partial index. PostgREST/Supabase JS cannot use partial indexes for `onConflict`, causing the error:
```
"there is no unique or exclusion constraint matching the ON CONFLICT specification"
```
Every sync logs this error and falls through to a regular insert (risking duplicates).

### 3. Edge function ignores `account` and `limit` params
The function body reads `user_id`, `account_id`, and `action` -- but the new frontend sends `{ account: 'gmail', limit: 50 }`, which is completely ignored. Both parallel calls sync ALL accounts redundantly.

---

## Fix Plan

### Step 1: Fix the unique constraint (migration)
Drop the partial unique index and create a proper UNIQUE CONSTRAINT (not index) so PostgREST can use it for upsert:

```sql
DROP INDEX IF EXISTS idx_jarvis_emails_cache_unique_msg;

-- Set message_id to a fallback for existing NULLs
UPDATE jarvis_emails_cache SET message_id = id::text WHERE message_id IS NULL;

-- Add a proper unique constraint
ALTER TABLE jarvis_emails_cache
  ADD CONSTRAINT uq_jarvis_emails_cache_msg UNIQUE (user_id, account, message_id);
```

### Step 2: Add Outlook account to `email_accounts`
Insert a new row for Outlook using IMAP with the `OUTLOOK_APP_PASSWORD` secret (already configured):

```sql
INSERT INTO email_accounts (user_id, provider, email_address, display_name, 
  imap_host, imap_port, credentials_encrypted, is_active)
VALUES (
  'f103da90-81d4-43a2-ad34-b33db8b9c369',
  'outlook',
  'agustin.cifuentes@outlook.com',  -- confirm email with user
  'Outlook Agustin',
  'outlook.office365.com', 993,
  '{"password": "<OUTLOOK_APP_PASSWORD_VALUE>"}',
  true
);
```
Note: The user will need to confirm their Outlook email and provide the app password value.

### Step 3: Fix edge function to accept `provider` filter
Update the function to accept an optional `provider` field in the request body so the frontend can target specific account types:

```typescript
// In the body destructuring:
const { user_id, account_id, action, provider, provider_token, ... } = body;

// When querying accounts, filter by provider if given:
if (provider) {
  query = query.eq("provider", provider);
}
```

### Step 4: Update handleEmailSync in DataImport.tsx
Fix the frontend to pass `provider` instead of `account`, and include `user_id`:

```typescript
const [gmailRes, outlookRes] = await Promise.all([
  supabase.functions.invoke('email-sync', { 
    body: { user_id: user.id, provider: 'gmail' } 
  }),
  supabase.functions.invoke('email-sync', { 
    body: { user_id: user.id, provider: 'outlook' } 
  }),
]);
```

Also ensure `message_id` is always set (never null) in the edge function before upserting.

### Step 5: Ensure message_id is never null
In the edge function, when building upsert rows, generate a fallback message_id if none exists:

```typescript
message_id: e.message_id || `gen-${account.email_address}-${Date.now()}-${i}`,
```

---

## Files to modify
- `supabase/functions/email-sync/index.ts` -- add provider filter + ensure message_id
- `src/pages/DataImport.tsx` -- fix params sent to edge function
- Database migration -- fix constraint + (optionally) add Outlook account

## Question for user
Before proceeding: what is your Outlook email address? Is it `agustin.cifuentes@outlook.com` or another address? And do you have an app password set up for it?


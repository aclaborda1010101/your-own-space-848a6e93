

## Plan: Update Evolution API Secrets and Verify

### Step 1: Update Supabase secrets
- Set `EVOLUTION_API_URL` to `https://evolution-api-production-9226.up.railway.app`
- Set `EVOLUTION_API_KEY` to `QZPCtQzm4w5vvrBA198QyQrv5YYEKprTZe0evVW9rZI`

### Step 2: Verify connection
- Call the `evolution-manage-v2` edge function with action `status` to confirm the new server responds correctly.

### No code changes needed
The edge functions already read these values from environment variables.


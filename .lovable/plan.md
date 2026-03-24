

## Plan: Update Evolution API Secrets

### What changed
Your Evolution API server moved from `evolution-api-production-b5ef` to `evolution-api-production-9226` on Railway.

### Changes needed

**1. Update Supabase secret `EVOLUTION_API_URL`**
- New value: `https://evolution-api-production-9226.up.railway.app`

**2. Update Supabase secret `EVOLUTION_API_KEY`**
- New value: `QZPCtQzm4w5vvrBA198QyQrv5YYEKprTZe0evVW9rZI`

**3. Verify connection**
- Call the `evolution-manage-v2` edge function with action `status` to confirm the new server responds correctly.

### No code changes needed
The edge functions (`evolution-manage-v2`, `evolution-webhook`, `send-whatsapp`) all read these values from environment variables, so updating the secrets is sufficient.

### Note about QR scanning
The QR scanning for the 3 instances must be done manually through the Evolution API dashboard or from the Settings page in the app after the secrets are updated.


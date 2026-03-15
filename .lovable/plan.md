

## Problem

The `whatsapp-status` Edge Function incorrectly reports "Webhook suscrito: No" because the Facebook Graph API call to get the WABA ID uses an unsupported field alias syntax (`wabaId:whatsapp_business_account`). This causes the API to return an error or empty data, so the webhook subscription check never runs.

Your webhook IS actually working -- the logs show `[WhatsApp] Webhook verified` consistently. The status panel is just reporting it wrong.

## Fix

**File: `supabase/functions/whatsapp-status/index.ts`**

Change line 58 from:
```
fields=wabaId:whatsapp_business_account
```
to:
```
fields=whatsapp_business_account
```

This is a one-line fix. The rest of the code already correctly references `wabaData?.whatsapp_business_account?.id`, so it will work once the field name is corrected.

Also add a `console.log` for the WABA response to aid future debugging.


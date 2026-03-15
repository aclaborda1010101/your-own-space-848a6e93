

# Fix: Test Webhook CORS error

## Problem
The "Test Webhook" button sends a POST from the browser to the Edge Function. The `whatsapp-webhook` function defines `corsHeaders` but never includes them in POST responses -- only in the OPTIONS preflight and GET verification responses. The browser blocks the response due to missing `Access-Control-Allow-Origin`, causing the `catch` block to fire with "No se pudo contactar el webhook".

## Solution
Add `corsHeaders` to all POST response paths in `supabase/functions/whatsapp-webhook/index.ts`.

Every `return new Response("OK", { status: 200 })` in the POST handler needs to include `headers: corsHeaders`. There are approximately 6-7 return statements that need updating:

1. Line where `WHATSAPP_API_TOKEN` or `WHATSAPP_PHONE_ID` missing
2. Line where no message object in payload
3. Line where non-text message skipped
4. Line after handling link code
5. Line after unlinked user response
6. Line after gateway error
7. Line after successful gateway response
8. Final catch block

All need `{ status: 200, headers: corsHeaders }` instead of `{ status: 200 }`.

## Files to modify
- `supabase/functions/whatsapp-webhook/index.ts` -- add `headers: corsHeaders` to all POST `Response` objects


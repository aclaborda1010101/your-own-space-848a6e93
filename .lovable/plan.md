

## Diagnosis

The Evolution API webhook logs confirm that **only `connection.update` events arrive** — zero `MESSAGES_UPSERT` events. The WhatsApp connection is active (state: "open"), but the webhook subscription for message events was lost during a reconnection cycle (close→connecting→open at 07:03).

The root cause: the webhook is only configured during `create_instance`, but when the instance reconnects (without being recreated), the webhook subscription can be lost. There is no mechanism to re-set the webhook after reconnection.

## Plan

### Step 1: Add `set_webhook` action to `evolution-manage-v2`

**File:** `supabase/functions/evolution-manage-v2/index.ts`

Add a new case `"set_webhook"` that calls `POST /webhook/set/{instance}` with the full webhook configuration (url, events: MESSAGES_UPSERT + CONNECTION_UPDATE, enabled: true). This mirrors the webhook config from `create_instance` but works on an already-existing instance.

### Step 2: Auto-set webhook after successful connection

**File:** `src/components/settings/WhatsAppConnectionCard.tsx`

After the polling detects `state === "open"`, automatically call `callManage("set_webhook")` to ensure the webhook subscription is active. This covers the case where the instance reconnects and loses its webhook config.

### Step 3: Add manual "Reconfigure webhook" button

In the connected state UI of `WhatsAppConnectionCard`, add a small "Reconfigure webhook" button that calls `set_webhook` on demand, for manual troubleshooting.

## Technical Details

- Evolution API endpoint: `POST /webhook/set/{instanceName}` with body `{ url, webhook: { url, byEvents: false, base64: false, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] }, enabled: true }`
- The `set_webhook` call is idempotent — safe to call multiple times
- Deploy `evolution-manage-v2` after changes


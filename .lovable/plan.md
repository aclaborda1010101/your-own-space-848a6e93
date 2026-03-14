

## Plan: Cleanup chats + Update Expert Forge API + Decouple OpenClaw

### 1. Remove PotusFloatingChat from layout (keep only AgentChatFloat)

**File: `src/components/layout/AppLayout.tsx`**
- Remove the `PotusFloatingChat` import and its rendering (line 8 and line 55)
- AgentChatFloat stays as the single global chat

### 2. Update Expert Forge API connection

The current `publish-to-forge` edge function calls `{EXPERT_FORGE_URL}/functions/v1/architect-project` with `Authorization: Bearer {EXPERT_FORGE_API_KEY}`.

The correct API is:
- **URL**: `https://nhfocnjtgwuamelovncq.supabase.co/functions/v1/api-gateway`
- **Auth**: `x-api-key` header (not Bearer)
- **Body**: `{ action: "architect", document_text, project_name, project_description, mode: "prd" }`

**File: `supabase/functions/publish-to-forge/index.ts`**
- Change the fetch URL to the api-gateway endpoint
- Change auth header from `Authorization: Bearer` to `x-api-key`
- Wrap body with `action: "architect"` format
- Update `EXPERT_FORGE_URL` secret value to `https://nhfocnjtgwuamelovncq.supabase.co` (or hardcode the full gateway URL since it's a fixed endpoint)

### 3. OpenClaw stays as monitoring panel only

No code changes needed here — OpenClaw is already a separate page (`/openclaw`) with its own `OpenClawChat` component scoped to that page. The decoupling is conceptual: JARVIS will be managed by the AgentChatFloat agent, not by OpenClaw. The OpenClaw page keeps its existing monitoring/control features (restart nodes, change models, view tasks).

### Files touched
- `src/components/layout/AppLayout.tsx` — remove PotusFloatingChat
- `supabase/functions/publish-to-forge/index.ts` — update API call format
- Redeploy `publish-to-forge`


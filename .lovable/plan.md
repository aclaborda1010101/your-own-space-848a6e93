

# Plan: Fix User Data Isolation (Dashboard, Contacts, WhatsApp)

## Problems Identified

**Problem 1: Dashboard shows "Agustín" for all users**
- `useUserProfile` has `DEFAULT_PROFILE` hardcoded with `name: "Agustín"` (line 84). When a new user (Álvaro) has no profile, it creates one with Agustín's name and personal data.
- Fix: Change DEFAULT_PROFILE to use generic defaults, and pull the user's actual name from `user.user_metadata` (Supabase auth stores display name from OAuth).

**Problem 2: Contacts query missing user_id filter**
- `CommandCenterCard.tsx` line 64-69 queries `people_contacts` without `.eq("user_id", user.id)`. RLS should filter, but this is a code smell and could fail if RLS has gaps.
- Fix: Add explicit `.eq("user_id", user.id)` filter.

**Problem 3: WhatsApp shows connected for all users**
- There's a single shared Evolution instance (`jarvis-whatsapp`). The `WhatsAppConnectionCard` checks its status globally — no per-user scoping. When Agustín connects, everyone sees "Conectado".
- Fix: Make the instance name per-user (e.g., `jarvis-wa-{userId-short}`) OR track which user_id owns the connection in a DB table. The simplest approach: store the connected user_id in `user_integrations` and only show "Conectado" if the current user is the one who linked. Each user must connect their own WhatsApp via QR.

## Changes

### 1. Fix DEFAULT_PROFILE in `useUserProfile.tsx`
- Change `name: "Agustín"` to dynamically use `user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Usuario"`
- Remove Agustín-specific family/personal data from defaults (Bosco, etc.) — replace with empty/generic values.

### 2. Fix contacts query in `CommandCenterCard.tsx`
- Add `.eq("user_id", user.id)` to the `people_contacts` query on line 66.

### 3. Fix DaySummaryCard.tsx (if still used)
- Same issue: `userName` comes from `profile?.name` which defaults to "Agustín". Already fixed by change #1.

### 4. Per-user WhatsApp connection
- The Evolution API only supports one phone per instance. Making per-user instances is complex.
- Simpler approach: Track which `user_id` connected the shared instance. In `WhatsAppConnectionCard`:
  - After successful QR scan + connection, store `user_id` in `user_integrations` with `provider = "evolution_whatsapp"`.
  - On load, check if `user.id` matches the stored owner. If not, show "Desconectado" with a note "Conectado por otro usuario".
  - When a new user connects, the old connection is replaced (Evolution only allows one phone per instance).

### Files Modified
1. `src/hooks/useUserProfile.tsx` — generic DEFAULT_PROFILE + dynamic name from auth metadata
2. `src/components/dashboard/CommandCenterCard.tsx` — add user_id filter to contacts query
3. `src/components/settings/WhatsAppConnectionCard.tsx` — per-user connection ownership check

### Technical Detail
- The `user_integrations` table already exists and can store `provider: "evolution_whatsapp"` with `user_id` to track ownership.
- No DB migration needed — just code changes.


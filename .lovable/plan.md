

# Plan: Auto-trigger contact analysis from email and periodic refresh

## Problem
Contact profiles (`personality_profile`) only auto-update when a live WhatsApp message arrives via `evolution-webhook`. Emails, backup imports, and time-based staleness never trigger re-analysis.

## Changes

### 1. Trigger contact-analysis after email-intelligence processes emails
**File**: `supabase/functions/email-intelligence/index.ts`

After successfully analyzing emails and upserting contacts, fire `contact-analysis` for each contact that had emails processed. Add a POST call to `/functions/v1/contact-analysis` (same pattern as evolution-webhook) for contacts with ≥2 new emails analyzed.

### 2. Add staleness check in the frontend profile view
**File**: `src/components/contacts/ContactTabs.tsx` (or the profile detail component)

When loading a contact's profile, check if the last analysis is older than 3 days AND there are newer messages/emails since then. If so, auto-trigger `contact-analysis` in the background and show a subtle "Actualizando perfil..." indicator.

Logic:
- Compare `personality_profile.last_analyzed` (or `updated_at`) with the most recent `contact_messages.message_date`
- If stale (>3 days gap + new messages exist), fire analysis automatically

### 3. Optional: trigger after WhatsApp backup import completes
**File**: `supabase/functions/import-whatsapp-backup/index.ts`

On the last batch (`batch_index === total_batches - 1`), fire `contact-analysis` for the top 10 contacts by message count from the imported chats.

## Summary of triggers after changes

| Source | Current | After |
|--------|---------|-------|
| Live WhatsApp | Auto (>20 chars or 5th msg) | Same |
| Email sync | Never | Auto after email-intelligence |
| Backup import | Never | Auto for top contacts |
| Profile view | Manual button only | Auto if stale >3 days |




# Plan: Show linked Plaud transcriptions in contact profile and use them in analysis

## Problem
Currently, the Plaud tab in a contact's profile only shows recordings matched by speaker name in `plaud_threads`. Plaud transcriptions that were manually linked to a contact via `linked_contact_ids` (from the Data Import screen) are completely ignored -- both in the UI and in the `contact-analysis` intelligence function.

## Changes

### 1. Show linked Plaud transcriptions in the PlaudTab component
**File**: `src/components/contacts/ContactTabs.tsx`

- Add a new query in `PlaudTab` that fetches from `plaud_transcriptions` where `linked_contact_ids` contains the current contact's ID and `processing_status = 'completed'`.
- Render these as cards below the existing speaker-matched recordings, with title, date, context_type badge, duration, and a snippet of `summary_structured` or `transcript_raw`.
- Deduplicate against existing `contactRecordings` to avoid showing the same content twice.

### 2. Also fetch linked transcriptions in StrategicNetwork for the badge count
**File**: `src/pages/StrategicNetwork.tsx`

- When computing `contactRecordings`, also query `plaud_transcriptions` with `linked_contact_ids @> [contact.id]` and merge the count into the Plaud tab badge.

### 3. Include linked Plaud transcriptions in contact-analysis
**File**: `supabase/functions/contact-analysis/index.ts`

- After existing transcription fetching (step 4), add a query to `plaud_transcriptions` filtering by `linked_contact_ids` containing the contact ID.
- Append this content to the `transcriptionsSummary` or as a new section in the prompt so the AI considers it when building the profile.
- Use `transcript_raw` (truncated) and `summary_structured` as source material.

## Technical details

**Supabase query for linked transcriptions** (Postgres array contains):
```sql
-- The linked_contact_ids column is text[], so we use the @> operator
SELECT id, title, recording_date, context_type, duration_minutes, 
       summary_structured, transcript_raw
FROM plaud_transcriptions
WHERE linked_contact_ids @> ARRAY['<contact_id>']::text[]
  AND processing_status = 'completed'
ORDER BY recording_date DESC
```

In the JS client this translates to `.contains('linked_contact_ids', [contactId])`.

No database migrations needed -- the `linked_contact_ids` column and data already exist.


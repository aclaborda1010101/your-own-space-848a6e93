

## Plan: Enhanced Plaud Transcription Classification with Contact/Project Linking

### Summary
When classifying a Plaud transcription, show additional options depending on the chosen category:
- **Familiar**: Choose sub-type "Bosco" or "Juana"
- **Personal / Professional**: Multi-select contacts to link
- **Professional**: Additionally, optionally link a business project

### Database Changes

Add 3 columns to `plaud_transcriptions`:

```sql
ALTER TABLE plaud_transcriptions 
  ADD COLUMN IF NOT EXISTS family_sub_type text,        -- 'bosco' | 'juana' (only for family)
  ADD COLUMN IF NOT EXISTS linked_contact_ids uuid[],   -- array of contact IDs
  ADD COLUMN IF NOT EXISTS linked_project_id uuid;      -- optional business project ID
```

No foreign keys needed (arrays can't FK); the UI will validate existence.

### UI Changes (src/pages/DataImport.tsx)

**1. Replace the simple 3-button context type selector** (lines 2831-2845) with an expanded classification panel:

- Keep the 3 category buttons (Personal / Profesional / Familiar)
- When **Familiar** is selected, show two sub-buttons: "👶 Bosco" and "👩 Juana" — store choice in `family_sub_type`
- When **Personal** or **Professional** is selected, show a multi-select contact picker using the existing `existingContacts` state (Command/Combobox pattern with checkboxes)
- When **Professional** is selected, additionally show a project dropdown fetched from `business_projects`

**2. New state variables**:
- `plaudLinkedContacts: Record<string, string[]>` — transcription ID → selected contact IDs
- `plaudLinkedProject: Record<string, string>` — transcription ID → project ID
- `plaudFamilySubType: Record<string, string>` — transcription ID → "bosco" | "juana"
- Load projects list once (id, name) for the dropdown

**3. Update `updatePlaudContextType`** to also persist `linked_contact_ids`, `linked_project_id`, and `family_sub_type` when changed, and clear irrelevant fields when switching categories.

**4. Update `processPlaudTranscription`** to pass `family_sub_type`, `linked_contact_ids`, and `linked_project_id` in the body to `plaud-intelligence`.

### Technical Details

- Contacts are already loaded in `existingContacts` state — reuse directly
- Projects will be fetched once with a simple query to `business_projects` (id, name)
- The multi-select for contacts will use a Popover + Command pattern (already available in the project's UI components)
- All linking data is persisted to `plaud_transcriptions` immediately on selection, same pattern as `updatePlaudContextType`
- The `plaud-intelligence` edge function will receive these new fields but no changes needed there initially — the data flows through for future use


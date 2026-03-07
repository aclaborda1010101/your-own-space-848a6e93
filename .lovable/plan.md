

## Two Major Features

### Feature 1: Multi-Respondent Questionnaires (Auditoría IA)

**Problem**: Currently, one audit = one questionnaire response. The user wants to send the same questionnaire to 50+ clients (e.g., dental clinics), collect individual responses, and then analyze ALL responses together to generate a consolidated diagnostic.

**Current architecture**: `bl_questionnaire_responses` has one row per audit with a single `responses` JSON. The public questionnaire saves to this same row. `analyze_responses` reads one response record.

**Proposed changes**:

1. **DB: New table `bl_public_responses`** - one row per external respondent:
   - `id`, `audit_id`, `template_id`, `respondent_name`, `respondent_email`, `respondent_company`, `responses` (JSONB), `completed_at`, `created_at`
   - RLS: owner of audit can read; public write via edge function

2. **Edge Function `ai-business-leverage`**:
   - `public_save_response` / `public_complete_questionnaire`: Create a NEW row in `bl_public_responses` per respondent (identified by token + email/name combo or a per-respondent session ID stored in localStorage)
   - `public_load_questionnaire`: Return questions + check if THIS respondent already has responses (via respondent session cookie/localStorage)
   - New action `analyze_all_responses`: Loads ALL `bl_public_responses` for the audit, builds a consolidated summary (N respondents, distribution of answers per question, common themes), and sends to Claude for a multi-perspective diagnostic

3. **Frontend `QuestionnaireTab.tsx`**:
   - Show respondent count badge: "12/50 respuestas recibidas"
   - List of respondents with name/email/completion status
   - "Generar radiografía" now calls `analyze_all_responses` instead of `analyze_responses` when multiple responses exist
   - Option to view individual responses

4. **Frontend `PublicQuestionnaire.tsx`**:
   - Each respondent gets their own response row (no overwriting)
   - Add optional `respondent_company` field for context

### Feature 2: Pre-Project "Needs Detection" Section + Full Interconnection (Projects)

**Problem**: The user wants a "pre-project" area in the wizard where they can dump all discovery material (competitor research, client calls, documents, needs) BEFORE starting the formal pipeline. Plus, everything should be interconnected: new documents or contact interactions should trigger re-analysis of downstream steps.

**Proposed changes**:

1. **DB: New table `business_project_discovery`**:
   - `id`, `project_id`, `title`, `description`, `category` (enum: 'need', 'competitor', 'research', 'client_feedback', 'opportunity', 'document'), `content_text`, `source` (manual/email/call/document), `created_at`, `user_id`
   - Plus reuse existing `business_project_timeline_attachments` for files linked to discovery items

2. **New component `ProjectDiscoveryPanel.tsx`**:
   - Placed in `ProjectWizard.tsx` BEFORE the Live Summary panel
   - Sections: Needs, Competitor Analysis, Research, Client Feedback
   - File upload with text extraction (reuse existing patterns)
   - Each item can be added/edited/deleted
   - AI summary of all discovery material

3. **Reorder ProjectWizard.tsx layout** (below the step content):
   - Live Summary Panel (already exists)
   - Discovery Panel (new)
   - Activity Timeline (already exists)
   - Documents Panel (already exists)

4. **Interconnection / Auto-regeneration**:
   - When new discovery items are added or timeline entries with attachments are created, trigger `refresh_summary` which now also includes discovery context
   - Update `project-activity-intelligence` edge function to include discovery items in the summary
   - The existing `activityContext` injection into steps 3-7 already works; just ensure discovery data flows into the live summary
   - Add a "needs_regeneration" flag concept: when the live summary detects significant new information, show a badge on affected wizard steps suggesting regeneration

### Implementation Order

1. **Multi-respondent questionnaires** (DB + edge function + frontend)
   - Migration: `bl_public_responses` table
   - Edge function: new respondent tracking + `analyze_all_responses` action
   - QuestionnaireTab: respondent list + consolidated analysis
   - PublicQuestionnaire: per-respondent persistence

2. **Discovery panel + interconnection** (DB + component + edge function update)
   - Migration: `business_project_discovery` table
   - New `ProjectDiscoveryPanel` component
   - Update `project-activity-intelligence` to include discovery in summary
   - Reorder wizard layout

### Files to create/edit

**New files:**
- `supabase/migrations/[timestamp]_multi_respondent_questionnaires.sql`
- `supabase/migrations/[timestamp]_project_discovery.sql`
- `src/components/projects/wizard/ProjectDiscoveryPanel.tsx`

**Edited files:**
- `supabase/functions/ai-business-leverage/index.ts` (multi-respondent logic)
- `src/components/projects/QuestionnaireTab.tsx` (respondent list, consolidated analysis)
- `src/pages/PublicQuestionnaire.tsx` (per-respondent persistence)
- `src/hooks/useBusinessLeverage.tsx` (new analyzeAllResponses action, load respondent count)
- `src/pages/ProjectWizard.tsx` (add Discovery panel, reorder sections)
- `supabase/functions/project-activity-intelligence/index.ts` (include discovery in summary)


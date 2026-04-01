

# Plan: Google Drive Integration for Pattern Detector Datasets

## Summary
Replace the placeholder "Datasets" tab with a functional UI that accepts a Google Drive folder URL, crawls all files in it via the Google Drive API, analyzes each file's relevance to pattern detection, and ingests the relevant ones.

## Problem
Currently the Datasets tab is a disabled placeholder. The user wants to paste a Drive folder link and have the system automatically discover, classify, and ingest all documents (PDF, Excel, CSV, etc.) without manual file-by-file uploads.

## Architecture

```text
┌─────────────────────┐
│  PatternDetector UI  │  ← paste Drive folder URL
│  (Datasets tab)      │
└──────────┬──────────┘
           │ supabase.functions.invoke("drive-folder-ingest")
           ▼
┌─────────────────────────┐
│  Edge Function           │
│  drive-folder-ingest     │
│  1. List all files in    │
│     folder (recursive)   │
│  2. Download each file   │
│  3. Extract text         │
│  4. LLM classifies       │
│     relevance            │
│  5. Store results in     │
│     pattern_detector_    │
│     datasets table       │
└─────────────────────────┘
```

## Prerequisites — Google Drive Connector

**No Google Drive connector exists** in the current workspace. Since Lovable's standard connectors don't include Google Drive as a listed option, we need to use a **Google Service Account** approach:

1. User creates a Google Cloud Service Account with Drive API read access
2. User shares the Drive folder with the service account email
3. Service account JSON key is stored as a Supabase secret (`GOOGLE_SERVICE_ACCOUNT_KEY`)

This gives the system read access to any folder shared with the service account — no OAuth flow needed.

## Changes

### 1. New DB table: `pattern_detector_datasets`
Stores files discovered from Drive folders per run.

```sql
CREATE TABLE pattern_detector_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  source_url TEXT NOT NULL,           -- Drive folder URL
  file_name TEXT NOT NULL,
  file_mime_type TEXT,
  file_size_bytes BIGINT,
  drive_file_id TEXT NOT NULL,
  extracted_text TEXT,
  relevance_score NUMERIC(3,2),       -- 0.00 to 1.00
  relevance_reason TEXT,
  classification TEXT,                 -- e.g. "financial_report", "lease_contract", "traffic_study"
  status TEXT DEFAULT 'pending',       -- pending | processing | relevant | irrelevant | error
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pattern_detector_datasets ENABLE ROW LEVEL SECURITY;
-- RLS: users see only their own rows
```

### 2. New Edge Function: `drive-folder-ingest`
Actions:
- **`list_folder`**: Takes a Drive folder URL, extracts folder ID, lists all files recursively via Google Drive API (using service account), returns file manifest with names/types/sizes
- **`classify_files`**: For each file, downloads content, extracts text (PDF via pdf-parse, XLSX via sheet parsing, CSV/JSON directly), sends a sample to LLM to classify relevance (0-1 score + category), inserts into `pattern_detector_datasets`
- **`get_status`**: Returns current ingestion progress for a run

The function processes files in batches of 5 to stay within Edge Function time limits. For large folders (>20 files), it self-invokes to continue processing remaining files.

### 3. Updated UI: `PatternDetector.tsx` — Datasets tab
Replace the placeholder with:
- **Input field** for Drive folder URL (validates Google Drive folder URL format)
- **"Analizar carpeta" button** that triggers the ingestion
- **Progress indicator** showing files found / processed / relevant / irrelevant
- **File table** showing each discovered file with: name, type, size, relevance score, classification, status badge
- Files marked as "relevant" are highlighted; "irrelevant" are greyed out
- Option to manually override classification (mark as relevant/irrelevant)

### 4. Connect datasets to Pattern Detector pipeline
In `pattern-detector-pipeline/index.ts`, modify Phase 5 (signals) to check if `pattern_detector_datasets` has relevant files for the current run. If so, inject extracted text summaries into the LLM prompt so signals are grounded in real project data.

## Files Modified/Created
1. **Migration** — new `pattern_detector_datasets` table + RLS
2. **`supabase/functions/drive-folder-ingest/index.ts`** — new Edge Function
3. **`src/components/projects/PatternDetector.tsx`** — replace Datasets tab placeholder
4. **`supabase/functions/pattern-detector-pipeline/index.ts`** — inject dataset context into Phase 5

## Secret Required
- `GOOGLE_SERVICE_ACCOUNT_KEY` — JSON key for a Google Cloud Service Account with Drive API access. User must share target folders with the service account email.

## What is NOT touched
- Existing phases 1-4b, 6-7 of the pattern detector pipeline
- Other tabs (Sources, Quality Gate, Signals, Credibility, Backtesting)
- No changes to the serve handler structure


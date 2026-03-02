

## Plan: Fix Roadmap section in final audit document

### Problem
In `AuditFinalDocTab.tsx` line 90-93, `roadmap.full_document_md` is appended raw after `# 4. Roadmap`. That markdown already contains its own `#` (H1) headers like "ROADMAP DE TRANSFORMACIÓN DIGITAL", "OPORTUNIDADES DETECTADAS", "QUICK WINS", "PLAN 90 DÍAS", etc. Each of these triggers a page break in the DOCX generator, creating a messy multi-page section with competing top-level headers.

### Fix

**File: `src/components/projects/AuditFinalDocTab.tsx`** (lines 89-93)

Add a helper function `downgradeHeadings(md)` that shifts all heading levels down by 1 (`#` → `##`, `##` → `###`, `###` → `####`) so the roadmap content sits properly under the `# 4. Roadmap` section header without triggering extra page breaks.

```typescript
// Before inserting roadmap content:
const downgraded = roadmap.full_document_md
  .replace(/^#### /gm, "##### ")
  .replace(/^### /gm, "#### ")
  .replace(/^## /gm, "### ")
  .replace(/^# /gm, "## ");
parts.push(downgraded);
```

Order matters: process `####` first, then `###`, then `##`, then `#` — to avoid double-downgrading.

### Files to modify
1. `src/components/projects/AuditFinalDocTab.tsx` — downgrade heading levels in roadmap content before appending




# JARVIS v2 Delta — Final Implementation Plan

## Files to change (4)

| # | File | What |
|---|------|------|
| 1 | `supabase/functions/generate-document/index.ts` | Backend: autoclose, score, draft mode, pipeline order, headers, warnings |
| 2 | `src/components/projects/wizard/ProjectDocumentDownload.tsx` | Pass `allowDraft`; send `auditJson` only for steps 4/5 |
| 3 | `src/components/projects/wizard/ExportValidationPanel.tsx` | Score breakdown, draft toggle with confirmation, 3 export buttons, warnings |
| 4 | `.lovable/plan.md` | Update plan doc |

---

## 1. `generate-document/index.ts`

### 1a. New function: `autocloseInternalOnly()` (insert after `deduplicateText`, ~line 1055)

```ts
function autocloseInternalOnly(content: string): { content: string; fixed: boolean; missing: number } {
  const open = (content.match(/\[\[INTERNAL_ONLY\]\]/g) || []).length;
  const close = (content.match(/\[\[\/INTERNAL_ONLY\]\]/g) || []).length;
  const missing = Math.max(0, open - close);
  if (missing === 0) return { content, fixed: false, missing: 0 };
  return {
    content: content + "\n\n" + Array(missing).fill("[[/INTERNAL_ONLY]]").join("\n"),
    fixed: true, missing
  };
}
```

### 1b. New function: `computeScoreFromAudit()` (insert nearby)

Tolerant field matching for `status/estado/state` and `severidad/severity`. Formula: `score = 100 - (CRIT*20 + IMP*10 + MEN*3)`. Returns `{ score, scoreBreakdown: { CRIT, IMP, MEN, NO_APLICA } }`. Uses the user-provided snippet verbatim.

### 1c. Expand `runExportValidation` (line 1081)

- Add params: `stepNumber: number`, `auditJson?: any`
- Add to return type: `warnings?: { type: string; key: string; message: string }[]`, `score?: number`, `scoreBreakdown?: { CRIT: number; IMP: number; MEN: number; NO_APLICA: number }`
- If `stepNumber in [4,5]` and content doesn't match `/exclusiones\s+expl[ií]citas/i`: push warning (non-blocking)
- If `auditJson` has `hallazgos`/`findings`: compute score via `computeScoreFromAudit()`

### 1d. Parse `allowDraft` from request body (line 1304)

Add `allowDraft` to destructured params.

### 1e. Fix pipeline order (lines 1331-1377) — CRITICAL

Reorder to:

1. `autocloseInternalOnly()` — structure safety first
2. `deduplicateText()` — cleanup
3. `stripChangelog()` — keep it (changelog may exist outside `[[INTERNAL_ONLY]]` in legacy docs; harmless if redundant)
4. `stripInternalOnly()` — removes `[[INTERNAL_ONLY]]` blocks (covers wrapped changelog too)
5. `stripNoAplica()` — client mode
6. PENDING block check — with `allowDraft` bypass
7. `processPendingTags()` / `processNeedsClarification()`
8. `translateForClient()`

### 1f. Draft mode at PENDING check (line 1352)

- If `isClientMode && !allowDraft && pendingTags.length > 0` → block (422) as now
- If `isClientMode && allowDraft && pendingTags.length > 0` → continue (no block)

### 1g. Headers per mode in `convertHtmlToPdf` (line 1240)

Accept `exportMode`, `allowDraft`, `company`, `dateStr` params. Set `headerTemplate`:
- Internal: `BORRADOR INTERNO — NO DISTRIBUIR`
- Client + allowDraft: `BORRADOR PARA REVISIÓN — NO ENVIAR`
- Client final: `CONFIDENCIAL — {company} — {date}`

Also update `buildCoverHtml` and `buildFullHtml` to accept/pass `allowDraft` and show yellow badge for draft.

### 1h. Filename includes BORRADOR (line 1509)

If `allowDraft`: filename = `{title}__CLIENTE_BORRADOR__-{ver}.{ext}`

### 1i. Validate-only mode (line 1323)

Pass `stepNumber` and `auditJson` (from request body, only present for steps 4/5) to `runExportValidation`. Return `warnings` and `scoreBreakdown` in response.

---

## 2. `ProjectDocumentDownload.tsx`

- Add `allowDraft?: boolean` to Props
- In request body: include `allowDraft`
- Include `auditJson: stepNumber === 4 || stepNumber === 5 ? content : undefined` — conditional on step

---

## 3. `ExportValidationPanel.tsx`

### Expanded `ValidationResult`
Add `warnings`, `score`, `scoreBreakdown` fields.

### Draft toggle with AlertDialog
- State: `allowDraft` (default false), `showDraftConfirm` (boolean)
- Visible only in client mode
- Toggle opens AlertDialog: "El documento incluirá watermark BORRADOR PARA REVISIÓN"
- Confirm → `setAllowDraft(true)`. Reset to false on `exportMode` change.

### Warnings display
Render `validation.warnings` as amber info items (non-blocking).

### Score breakdown
Show only when `validation.scoreBreakdown` exists:
- Color-coded score badge (green >=90, yellow >=75, orange >=60, red <60)
- CRIT/IMP/MEN counts + NO_APLICA count (informative)

### Three export buttons (replace current single button)
1. **Exportar Cliente (FINAL)** — disabled if `pendingTags.length > 0`. `exportMode="client"`, no `allowDraft`
2. **Exportar Cliente (BORRADOR)** — visible only if `allowDraft === true`. `exportMode="client"`, `allowDraft=true`
3. **Exportar Interno** — always available. `exportMode="internal"`

---

## Verification tests (post-implementation)

1. Document with `[[INTERNAL_ONLY]]` without closing tag → client export must autoclose at EOF then strip correctly
2. Audit with 2 `[[NO_APLICA]]` + 1 CRIT ABIERTO → score = 80, breakdown shows CRIT=1, NO_APLICA=2
3. Client FINAL with `[[PENDING:nombre_cliente]]` → blocked (422)
4. Client BORRADOR with `allowDraft: true` + PENDING → exports with watermark header + filename `__CLIENTE_BORRADOR__`


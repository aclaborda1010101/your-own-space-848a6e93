

## Plan: Tres barandillas para Data Snapshot

### Cambio 1 — Checkbox de consentimiento (`ProjectDataSnapshot.tsx`)

- Add `consentChecked` boolean state (default `false`)
- Before the action buttons in the upload phase, render a Checkbox + label: "Confirmo que tengo autorización para compartir estos datos y que no contienen información personal sin consentimiento."
- The "Validar análisis" button gets `disabled={analyzing || !consentChecked}`
- Import `Checkbox` from `@/components/ui/checkbox`

### Cambio 2 — Deduplicación por hash

**SQL migration**: Add `file_hash TEXT` column to `client_data_files`.

**Edge function** (`analyze-client-data/index.ts`): Before uploading to Storage, compute SHA-256 hash of the buffer, query `client_data_files` for existing `file_hash` match on same `project_id`. If found, skip upload/analysis and push `{ status: "duplicate", existing_file }` to results. Otherwise, save hash in the insert.

**Frontend** (`ProjectDataSnapshot.tsx`): Handle `status === "duplicate"` in the upload response — show toast warning instead of adding to file list.

### Cambio 3 — `success_definition` en Step 6

In `projectPipelinePrompts.ts`, inside the `services_decision.pattern_detector` JSON example (~line 516-524), add:

```json
"success_definition": {
  "metric": "qué se mide (ej: renovación de contrato, reducción de stock, conversión)",
  "threshold": "cuándo se considera éxito (ej: permanencia >24 meses, roturas <5%)",
  "measurement_source": "de dónde sale el dato (ej: tabla oportunidades.estado, tabla inventario.roturas)"
}
```

This flows downstream automatically since `services_decision` is already passed to PRD and pattern blueprint prompts.

### Nota sobre RAG chunks

In the injection of client data into RAG (point 7 of the main plan), the implementation will NOT inject raw Excel rows as chunks. Instead, the `data_profile` itself (aggregated statistics, detected variables with quality scores, entity groupings, business context summary) will be injected as structured analytical chunks. Raw rows are useless for RAG retrieval.

### Files modified

| File | Change |
|---|---|
| SQL migration | Add `file_hash TEXT` to `client_data_files` |
| `supabase/functions/analyze-client-data/index.ts` | SHA-256 dedup check before upload, save hash |
| `src/components/projects/wizard/ProjectDataSnapshot.tsx` | Consent checkbox + duplicate handling |
| `src/config/projectPipelinePrompts.ts` | Add `success_definition` to pattern_detector output |


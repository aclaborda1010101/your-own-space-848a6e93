

## Plan: Adjuntar archivos del cliente en el Briefing (Paso 2)

Permitir subir archivos del cliente en el paso 2 (Briefing extraído) para que su contenido se incorpore como contexto adicional al generar el Documento de Alcance (Paso 3).

### Cambio 1 — `ProjectWizardStep2.tsx`

Add a file attachment section after the briefing header:
- Dropzone + file input accepting PDF, DOCX, XLSX, CSV, TXT, images
- Files get uploaded to Supabase Storage bucket `project-documents` under path `{projectId}/attachments/`
- File list with name, size, delete button
- Store file metadata in `project_wizard_steps` step 2 `output_data` as an `attachments` array: `[{ name, path, size, type }]`
- New state: `attachments[]`, `uploading` flag
- On approve, include attachments array in the edited briefing passed to `onApprove()`

### Cambio 2 — `ProjectWizardStep2.tsx` props

Add optional `onAttachmentsChange` callback or handle attachments internally via Supabase. The simpler approach: upload directly to storage, persist metadata in the briefing output, and read them back when step 3 generates.

### Cambio 3 — `useProjectWizard.ts` → `generateScope`

When calling `generate_scope`, also pass the attachments content. Before the API call:
- Read each attachment from storage
- Extract text content (for text files) or pass file info
- Include as `attachmentsContent` in `stepData`

### Cambio 4 — Edge Function `project-wizard-step/index.ts` → `generate_scope`

In the `generate_scope` action:
- Read `stepData.attachmentsContent` if present
- Append it to the scope generation prompt as "DOCUMENTOS ADICIONALES DEL CLIENTE" section
- This gives Claude/Gemini the file contents to incorporate into the scope document

### Cambio 5 — Edge Function: file content extraction

For uploaded attachments, add a helper in the edge function that:
- Downloads files from storage
- Extracts text (plain text files directly, PDFs would need basic text extraction)
- Truncates to a safe token limit

### Storage

Use existing `project-documents` bucket. Files stored at `{projectId}/attachments/{filename}`.

### Data flow

```text
Step 2 UI → upload files → Storage bucket
         → save metadata in briefing.attachments
Step 3 generate → read attachments from storage
              → extract text content
              → inject into scope prompt as additional context
              → Claude/Gemini generates scope considering all files
```

### Files

| File | Change |
|---|---|
| `src/components/projects/wizard/ProjectWizardStep2.tsx` | Add file upload UI, attachment list, persist metadata |
| `src/hooks/useProjectWizard.ts` | Update `generateScope` to read and pass attachment contents |
| `supabase/functions/project-wizard-step/index.ts` | Read attachments content in `generate_scope`, inject into prompt |


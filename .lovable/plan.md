

# P0 Fix Plan — 3 Files, Surgical Patches

All line numbers verified against current code.

---

## 1. `supabase/functions/generate-document/index.ts`

### A) `stripInternalOnly` — remove dangerous second regex (lines 1057-1061)

Replace the function with:
```ts
function stripInternalOnly(text: string): string {
  // Solo borramos bloques bien formados. Los no formados se corrigen antes con autocloseInternalOnly().
  return text.replace(/\[\[INTERNAL_ONLY\]\][\s\S]*?\[\[\/INTERNAL_ONLY\]\]/g, '');
}
```

### B) `runExportValidation` — add `allowDraft` param (line 1125)

Change `auditJson?: any` line to:
```ts
  auditJson?: any,
  allowDraft?: boolean
```

### C) `canExport` — respect `allowDraft` (line 1172)

Change to:
```ts
    canExport: isClientMode ? (pendingTags.length === 0 || !!allowDraft) : true,
```

### D) Validate-only call site — pass `allowDraft` (line 1433)

Change to:
```ts
      const validation = runExportValidation(rawContent, isClientMode, stepNumber, auditJson, allowDraft);
```

---

## 2. `src/components/projects/wizard/ExportValidationPanel.tsx`

### A) Remove wrong `auditJson` from `runValidation` (line 90)

Delete this line entirely:
```ts
          auditJson: (stepNumber === 4 || stepNumber === 5) ? content : undefined,
```

### B) Replace export buttons block (lines 257-327)

Replace the entire `{/* Export buttons */}` div with:

```tsx
              {/* Export buttons */}
              <div className="pt-2 space-y-2">
                {exportMode === "client" && (
                  <>
                    <ProjectDocumentDownload
                      projectId={projectId}
                      stepNumber={stepNumber}
                      content={contentType === "markdown"
                        ? (typeof content === "string" ? content : content?.document || JSON.stringify(content, null, 2))
                        : content
                      }
                      contentType={contentType}
                      projectName={projectName}
                      company={company}
                      version={version}
                      exportMode="client"
                      size="default"
                      label="Exportar Cliente (FINAL)"
                      disabled={hasPending}
                    />

                    {hasPending && !allowDraft && (
                      <div className="text-xs text-muted-foreground">
                        Export Cliente FINAL bloqueado: hay campos [[PENDING]] sin resolver. Activa "Permitir borrador" o exporta en modo Interno.
                      </div>
                    )}

                    {hasPending && allowDraft && (
                      <ProjectDocumentDownload
                        projectId={projectId}
                        stepNumber={stepNumber}
                        content={contentType === "markdown"
                          ? (typeof content === "string" ? content : content?.document || JSON.stringify(content, null, 2))
                          : content
                        }
                        contentType={contentType}
                        projectName={projectName}
                        company={company}
                        version={version}
                        exportMode="client"
                        allowDraft={true}
                        size="default"
                        variant="outline"
                        label="Exportar Cliente (BORRADOR)"
                      />
                    )}
                  </>
                )}

                {exportMode === "internal" && (
                  <ProjectDocumentDownload
                    projectId={projectId}
                    stepNumber={stepNumber}
                    content={contentType === "markdown"
                      ? (typeof content === "string" ? content : content?.document || JSON.stringify(content, null, 2))
                      : content
                    }
                    contentType={contentType}
                    projectName={projectName}
                    company={company}
                    version={version}
                    exportMode="internal"
                    size="default"
                    label="Exportar Interno"
                  />
                )}
              </div>
```

Key changes: FINAL button always visible but `disabled={hasPending}`, all `auditJson` props removed from the 3 download instances.

---

## 3. `src/components/projects/wizard/ProjectDocumentDownload.tsx`

### A) Add `disabled` to Props (after line 20)

```ts
interface Props {
  projectId: string;
  stepNumber: number;
  content: any;
  contentType: "markdown" | "json";
  projectName: string;
  company?: string;
  version?: number;
  variant?: "default" | "outline";
  size?: "sm" | "default";
  label?: string;
  exportMode?: "client" | "internal";
  allowDraft?: boolean;
  auditJson?: any;
  disabled?: boolean;
}
```

### B) Destructure `disabled` (line 36, add after `auditJson`)

```ts
  auditJson,
  disabled,
}: Props) => {
```

### C) Guard in `handleDownload` (line 47)

```ts
    if (!content || disabled) return;
```

### D) Button disabled state (line 104)

```ts
      disabled={disabled || downloading || !content}
```




## 3 Bugs de Fontanería — Fix Quirúrgico

### Diagnóstico confirmado en el código actual

| Bug | Líneas | Estado actual |
|-----|--------|--------------|
| **BUG 1**: Scope save sin validación | L836-838 | `update({ status: "review", output_data: { document: scopeResult.text, _internal: true } })` — no llama `runAllValidators` |
| **BUG 2**: Part 4 busca `componentes_validados` (no existe) | L1393-1394 | El audit produce `componentes_auditados`, el campo `componentes_validados` nunca se genera → bloque siempre vacío |
| **BUG 3**: Audit save sin validación | L955-957 | `update({ status: "review", output_data: { ...auditData, _internal: true } })` — no llama `runAllValidators` |

`runAllValidators` ya está importado (L4). Los contratos para steps 10/11 ya existen en `contracts.ts`. Solo falta conectar las tuberías.

---

### Cambios exactos

**Archivo único: `supabase/functions/project-wizard-step/index.ts`**

**Fix 1 — L836-838: Validar scope antes de guardar**

Reemplazar el save directo por:
```typescript
const scopeValidation = runAllValidators(10, null, scopeResult.text);
if (scopeValidation.violations.length > 0) {
  console.warn(`[Chained PRD] Scope validation: ${scopeValidation.violations.length} violations`, 
    scopeValidation.violations.map(v => `${v.type}: ${v.detail}`));
}

await supabase.from("project_wizard_steps").update({
  status: "review", 
  output_data: { document: scopeResult.text, _internal: true, _validation: scopeValidation.flags },
}).eq("project_id", projectId).eq("step_number", 10);
```

**Fix 2 — L955-957: Validar audit antes de guardar**

Reemplazar el save directo por:
```typescript
const auditValidation = runAllValidators(11, auditData, JSON.stringify(auditData || {}));
if (auditValidation.violations.length > 0) {
  console.warn(`[Chained PRD] Audit validation: ${auditValidation.violations.length} violations`,
    auditValidation.violations.map(v => `${v.type}: ${v.detail}`));
}
// Check canonical fields on audited components
const auditedComps = auditData?.componentes_auditados || [];
const missingCanonical = auditedComps.filter((c: any) => !c.layer || !c.module_type);
if (missingCanonical.length > 0) {
  console.warn(`[Chained PRD] Audit: ${missingCanonical.length} components missing layer/module_type:`,
    missingCanonical.map((c: any) => c.nombre || c.name));
}

await supabase.from("project_wizard_steps").update({
  status: "review", 
  output_data: { ...auditData, _internal: true, _validation: auditValidation.flags },
}).eq("project_id", projectId).eq("step_number", 11);
```

**Fix 3 — L1389-1402: Corregir campo del audit en Part 4**

Reemplazar el bloque `auditComponentsBlock` por:
```typescript
let auditComponentsBlock = "";
try {
  const auditObj = typeof sd.aiLeverageJson === 'object' && sd.aiLeverageJson !== null ? sd.aiLeverageJson : {};
  // Primary: componentes_auditados (canonical field name from audit)
  const auditedComponents = (auditObj as any).componentes_auditados || (auditObj as any).componentes_validados || [];
  if (auditedComponents.length > 0) {
    auditComponentsBlock += "\n\nCOMPONENTES AUDITADOS (Auditoría IA — FUENTE PRIMARIA):\n" + 
      JSON.stringify(auditedComponents, null, 2).substring(0, 12000);
    auditComponentsBlock += "\n\nINSTRUCCIÓN: USA estos componentes como fuente primaria para la Sección 15. " +
      "Cada componente tiene layer, module_type, status, phase, evidence_strength, inflation_risk. " +
      "Respeta esos campos. NO reclasifiques salvo contradicción explícita con el canonical_architecture_input.";
  }
  if ((auditObj as any).degradaciones?.length > 0) {
    auditComponentsBlock += "\n\nDEGRADACIONES (Auditoría IA):\n" + 
      JSON.stringify((auditObj as any).degradaciones, null, 2).substring(0, 4000);
  }
  if ((auditObj as any).componentes_faltantes?.length > 0) {
    auditComponentsBlock += "\n\nCOMPONENTES FALTANTES (Auditoría IA):\n" + 
      JSON.stringify((auditObj as any).componentes_faltantes, null, 2).substring(0, 4000);
  }
  if ((auditObj as any).validaciones?.length > 0) {
    auditComponentsBlock += "\n\nVALIDACIONES (Auditoría IA):\n" + 
      JSON.stringify((auditObj as any).validaciones, null, 2).substring(0, 4000);
  }
  if ((auditObj as any).rags_recomendados?.length > 0) {
    auditComponentsBlock += "\n\nRAGs RECOMENDADOS (Auditoría IA):\n" + 
      JSON.stringify((auditObj as any).rags_recomendados, null, 2).substring(0, 4000);
  }
} catch { /* fallback — auditComponentsBlock stays empty */ }
```

---

### Lo que NO se toca

- `contracts.ts` — contratos steps 10/11 ya existen
- `validators.ts` — validadores ya existen y están conectados
- `manifest-schema.ts` — ya acepta `auditJson`
- Frontend, DB, secrets — nada

### Deploy

Solo `project-wizard-step`. Sin migraciones, sin frontend, sin secrets.

### Verificación post-deploy

En logs de Supabase buscar:
1. `[Chained PRD] Scope validation:` — confirma Fix 1
2. `[Chained PRD] Audit validation:` — confirma Fix 2
3. `COMPONENTES AUDITADOS (Auditoría IA — FUENTE PRIMARIA):` — confirma Fix 3


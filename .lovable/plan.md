

## Refactorización Estructural: Contrato Canónico desde Brief + canonical_architecture_input

### Diagnóstico del estado actual

El brief (L157-309) produce `likely_layer` (7 valores legacy) y `candidate_component_type` (8 valores legacy). Scope y Audit ya fueron corregidos a 5 capas A-E, pero siguen recibiendo la taxonomía vieja del brief y "traducen". El Manifest (L1431) compila SOLO desde PRD texto + briefSummary, ignorando el JSON estructurado del audit.

### Cambios exactos

---

**Archivo 1: `supabase/functions/project-wizard-step/index.ts`**

**1A — Brief extraction: Añadir campos canónicos (L259-301)**

Añadir a cada item de `solution_candidates` y `architecture_signals` en el JSON schema:
```
"layer_candidate": "A|B|C|D|E|unknown",
"module_type_candidate": "knowledge_module|action_module|pattern_module|deterministic_engine|router_orchestrator|executive_cognition_module|improvement_module|unknown",
"phase_candidate": "MVP|F2|F3|EXPLORATORY",
"why_not_mvp": "string|null",
"dependencies": [],
"requires_human_design": false,
"normalization_notes": ["razón de la clasificación"]
```

Añadir reglas de mapeo al system prompt (L168-175):
- `knowledge_asset` → `layer_candidate: "A"`, `module_type_candidate: "knowledge_module"`
- `ai_specialist`/`workflow_module` → `"B"`, `"action_module"`
- `deterministic_engine` → `"C"`, `"deterministic_engine"`
- `orchestrator` → `"B"`, `"router_orchestrator"`
- `analytics_module` → `"C"`, `"pattern_module"`
- `certainty: "low"` → `phase_candidate: "EXPLORATORY"`, `why_not_mvp` obligatorio
- `certainty: "medium"` → `phase_candidate: "F2"` por defecto
- Soul solo con evidencia explícita → `"D"`
- Declarar `likely_layer` y `candidate_component_type` como "LEGACY — se mantienen por compatibilidad, NO son autoritativos"

**1B — Scope: Instrucción de consumir campos canónicos y emitir reclasificaciones (~L772)**

Añadir al scope user prompt:
```
FUENTE PRIMARIA: Usa layer_candidate, module_type_candidate, phase_candidate y status 
de los solution_candidates como BASE. NO reinterpretes — solo normaliza y consolida.
Solo reclasifica si detectas error evidente, y anota motivo.
```

Añadir sección obligatoria al output:
```
### Reclasificaciones
| component_id | old_layer | new_layer | old_module_type | new_module_type | reason |
```

**1C — AI Audit: Inyectar brief canónico como referencia cruzada (~L867)**

Construir array de componentes canónicos del brief antes de la llamada. Inyectar en user prompt:
```
BRIEFING ESTRUCTURADO (componentes canónicos):
${JSON.stringify(canonicalComponents)}
USA como referencia cruzada. Justifica si Scope cambió layer o module_type.
```

Separar output del audit añadiendo `audit_findings[]` con `finding_type`, `severity`, `recommended_action`.

**1D — canonical_architecture_input: Nuevo bloque antes del PRD (~L970)**

Después de AI Audit y antes de la llamada recursiva al PRD, ensamblar:
```typescript
const canonicalArchInput = {
  project_summary: briefObj.project_summary || {},
  brief_components: (briefObj.solution_candidates || []).map(c => ({
    id: c.id, name: c.title, layer_candidate: c.layer_candidate,
    module_type_candidate: c.module_type_candidate, phase_candidate: c.phase_candidate,
    confidence: c.certainty, status: c.status, why_not_mvp: c.why_not_mvp
  })),
  validated_components: auditData?.componentes_auditados || [],
  audit_findings: auditData?.degradaciones || [],
  mvp_components: (auditData?.componentes_auditados || []).filter(c => c.phase === "MVP"),
  roadmap_components: (auditData?.componentes_auditados || []).filter(c => c.phase !== "MVP"),
  open_questions: briefObj.open_questions || [],
  source_trace: { brief: true, scope: true, audit: true }
};
```

Pasar `canonicalArchInput` como parte de `prdStepData` para que PRD Parts 4 y 5 lo reciban.

**1E — PRD Part 4: Inyectar canonical_architecture_input con precedencia (~L1300-1328)**

Antes del `auditComponentsBlock`, inyectar:
```
CONTRATO ESTRUCTURADO CANÓNICO (FUENTE PRIORITARIA):
${JSON.stringify(canonicalArchInput).substring(0, 15000)}

INSTRUCCIÓN: Usa este contrato como fuente primaria para clasificar componentes, fases, capas y status.
El texto libre del scope/PRD previo solo enriquece redacción, no contradice la estructura canónica.
Si hay contradicción entre prosa y canonical_architecture_input, manda canonical_architecture_input.
```

**1F — Manifest compilation: Pasar audit JSON completo (~L1431)**

Cambiar:
```typescript
const auditStructuredJson = JSON.stringify({
  validated_components: auditData?.componentes_auditados || [],
  audit_findings: auditData?.degradaciones || [],
  mvp_components: canonicalArchInput?.mvp_components || [],
  roadmap_components: canonicalArchInput?.roadmap_components || [],
}, null, 2).substring(0, 20000);
const manifestPrompt = buildManifestCompilationPrompt(earlyFullPrd, briefSummary, auditStructuredJson);
```

---

**Archivo 2: `supabase/functions/project-wizard-step/manifest-schema.ts`**

Actualizar `buildManifestCompilationPrompt` para aceptar tercer parámetro `auditJson?: string` e inyectar:
```
===AUDIT ESTRUCTURADO===
${auditJson}
===FIN AUDIT===
Si el audit contiene componentes con layer, module_type y status, ÚSALOS como referencia cruzada.
Si hay discrepancia entre Sección 15 y audit, prioriza Sección 15 pero señala la contradicción.
```

---

**Archivo 3: `supabase/functions/project-wizard-step/contracts.ts`**

Actualizar `PHASE_CONTRACTS[2].requiredItemMeta` añadiendo: `"layer_candidate"`, `"module_type_candidate"`, `"phase_candidate"`.

---

**Archivo 4: `supabase/functions/project-wizard-step/validators.ts`**

Añadir en `runAllValidators` para step 2: validar que `solution_candidates` y `architecture_signals` contienen campos canónicos. Warnings si:
- `certainty: "low"` con `phase_candidate: "MVP"` → inflación
- `module_type_candidate: "executive_cognition_module"` sin evidencia en snippets
- `requires_human_design` falta cuando `status: "proposed"` y `certainty: "low"`

---

### Lo que NO se toca
- Scope/Audit system prompts (ya corregidos, solo se añaden instrucciones de consumo)
- PRD Part 4/5 prompt structure (solo se inyecta canonical input como contexto prioritario)
- publish-to-forge, ManifestViewer, frontend, DB

### Backward Compatibility
Campos nuevos del brief son aditivos. Briefs existentes siguen funcionando.

### Deploy
Edge function `project-wizard-step`. No DB migrations, no frontend, no new secrets.


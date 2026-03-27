

## Corrección Estructural: Scope + AI Audit + Contracts + Validators

### Diagnóstico confirmado tras lectura del código

**Scope system prompt (L723-738):** Menciona "RAGs diferenciadas por tipo de fuente" y "Componentes de fases futuras" pero NO clasifica por capas A-E, NO distingue confirmed/candidate/open, NO tiene anti-inflación.

**Scope user prompt (L740):** Tabla de inventario usa literalmente `RAG / AGENTE_IA / MOTOR_DETERMINISTA / ORQUESTADOR / MODULO_APRENDIZAJE` como taxonomía principal. Reglas dicen "es un MOTOR_DETERMINISTA", "es MODULO_APRENDIZAJE" — naming plano legacy.

**AI Audit system prompt (L785-794):** Dice "Asignar el modelo LLM, temperatura y configuración técnica a cada componente" — cierre prematuro. Clasifica por "tipo correcto" sin definir qué tipos.

**AI Audit user prompt (L796):** Schema de salida usa `"tipo": "RAG | AGENTE_IA | MOTOR_DETERMINISTA | ORQUESTADOR | MODULO_APRENDIZAJE"`. Sin campos layer, status, inflation_risk, evidence_strength.

**Standalone scope (L441-576):** No tiene inventario IA con tipos, pero tampoco impone layer-aware. Es un documento ejecutivo — necesita alineación mínima.

**contracts.ts:** No tiene PHASE_CONTRACTS[10] ni PHASE_CONTRACTS[11] con anti-flat-naming.

**validators.ts:** No tiene validador de flat-naming. `runAllValidators` no cubre steps 10/11 para naming.

### Cambios exactos

---

**Archivo 1: `supabase/functions/project-wizard-step/index.ts`**

**1A — Scope system prompt (L723-738)**
Reescribir para añadir:
- Clasificación obligatoria por 5 capas A-E
- Distinción confirmed/candidate/open
- El alcance es puente, no diseño final
- No convertir candidates en confirmed sin evidencia
- Preservar preguntas abiertas del briefing
- MVP = solo evidencia alta; duda = roadmap

**1B — Scope user prompt inventory (dentro de L740)**
Reemplazar la tabla con tipos legacy por:
```
| ID | Nombre | Capa | module_type | Descripción | Status (confirmed/candidate/open) | Fase | Origen en briefing |
```
Con tipos canónicos:
- Capa A → knowledge_module
- Capa B → action_module / router_orchestrator
- Capa C → deterministic_engine / pattern_module
- Capa D → executive_cognition_module (solo con evidencia)
- Capa E → improvement_module

Añadir reglas de status, bloque anti-inflación MVP, sección obligatoria de incertidumbre y dependencias.

**1C — AI Audit system prompt (L785-794)**
Reescribir completamente como auditor-depurador:
- Funciones: verificar cobertura, clasificar A-E, detectar faltantes, DEGRADAR sobreformalización, detectar inflación MVP
- Prohibiciones: inflar MVP, convertir candidate→confirmed sin evidencia, inferir Soul, convertir Pattern→Action, fabricar componentes
- Tipos canónicos por capa
- Regla de incertidumbre: duda → candidate/roadmap/open_question

**1D — AI Audit user prompt schema (L796)**
Reemplazar schema legacy:
- Eliminar `"tipo": "RAG | AGENTE_IA | ..."` 
- Nuevo schema con: `module_type`, `layer`, `status`, `evidence_strength`, `inflation_risk`, `missing_dependencies`, `why_not_mvp`
- Reglas de clasificación por capa canónica
- Validaciones con `inflation_risk` y `degradaciones`

**1E — Standalone scope prompt (L441-509)**
Añadir al system prompt las mismas reglas layer-aware y anti-inflación, sin replicar la tabla de inventario completa (es un doc ejecutivo distinto).

---

**Archivo 2: `supabase/functions/project-wizard-step/contracts.ts`**

**2A — Añadir PHASE_CONTRACTS[10] y actualizar [11]**

```typescript
10: {
  name: "Alcance Interno",
  forbiddenTerms: ["AGENTE_IA", "MOTOR_DETERMINISTA", "MODULO_APRENDIZAJE"],
  requiredFields: ["layer", "module_type", "status"],
  ...
}
```
Actualizar step 11 con los mismos `forbiddenTerms` legacy.

---

**Archivo 3: `supabase/functions/project-wizard-step/validators.ts`**

**3A — Nueva función `validateFlatNamingContamination`**
Detecta naming legacy (`AGENTE_IA`, `MOTOR_DETERMINISTA`, `MODULO_APRENDIZAJE`, `ORQUESTADOR`) como clasificación principal en outputs de scope/audit.

**3B — Conectar en `runAllValidators`**
Añadir llamada para steps 10 y 11.

---

### Lo que NO se toca
- Brief extraction (step 2) — ya correcto
- PRD Part 4/5 prompts — ya tienen 5-layer
- Manifest compilation — ya usa Section 15
- publish-to-forge — ya tiene no-re-inference
- ManifestViewer — ya tiene governance badges

### Deploy
- Edge function `project-wizard-step`
- No DB migrations, no frontend changes, no new secrets


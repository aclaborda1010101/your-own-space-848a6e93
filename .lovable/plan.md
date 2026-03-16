

## PRD Maestro con Triple Capa — Plan de Implementación

### Problema actual

El pipeline genera un PRD monolítico (6 partes concatenadas) y luego un Call 7 post-hoc lo parte en dos documentos separados (Lovable Build PRD + Expert Forge Spec). Esto causa:
- Los dos outputs son "resúmenes empobrecidos" del PRD, no capas de lectura del mismo documento
- Expert Forge reinterpreta componentes (confunde motores con especialistas, no materializa RAGs)
- No hay contrato de interpretación que evite ambigüedades
- No hay matriz canónica de nombres ni clasificación formal de componentes

### Solución: PRD Maestro Único con 3 Capas

Un solo documento con tres capas embebidas, no dos documentos separados.

### Cambios

#### 1. Reescribir `PRD_SYSTEM_PROMPT` y los 6 sub-prompts (projectPipelinePrompts.ts)

El system prompt actual es genérico (13 secciones tipo plantilla). Se reemplaza con una estructura de PRD maestro que incluye las 3 capas:

**Capa B — Machine Interpretation Contract** (va al principio del PRD, antes del contenido):
- Nomenclatura canónica (tabla de nombres normalizados)
- Clasificación de componentes (cada uno tipado como: especialista IA, motor determinista, módulo/orquestador, RAG, conector, módulo UI)
- Bindings RAG ↔ componente (tabla explícita)
- Build scope (qué es Fase 0+1 = buildable now)
- Roadmap scope (qué es Fase 2+ = no ejecutable por defecto)
- 10 reglas anti-reinterpretación (el contrato que defines en tu mensaje)

**Capa A — PRD Maestro** (el cuerpo, lo que ya existe mejorado):
- Las 13 secciones actuales se mantienen pero con la obligación de usar nombres canónicos de la Capa B
- Cada componente mencionado debe llevar su tipo de la clasificación
- Cada RAG debe tener binding explícito

**Capa C — Adapters embebidos** (anexos finales):
- Anexo: Lovable Build Adapter (evolución del Blueprint actual, acotado a Fase 0+1)
- Anexo: Expert Forge Adapter (instanciación, RAGs, especialistas, motores, links, router, validación)

Distribución en los 6 sub-prompts:
- Part 1: Capa B completa + Introducción + Problema + Tesis
- Part 2-4: Capa A (cuerpo del PRD, sin cambios estructurales mayores pero usando nombres canónicos)
- Part 5: Lovable Build Adapter
- Part 6: Expert Forge Adapter + Validación cruzada

#### 2. Reescribir Call 7 — Normalization → Extraction (index.ts ~line 1807)

En vez de "partir el PRD en dos", Call 7 pasa a ser una **extracción estructurada** que:
- Extrae la Capa B (contrato) como JSON parseable → `prdOutputData.interpretation_contract`
- Extrae el Lovable Adapter como markdown limpio → `prdOutputData.lovable_build_prd`
- Extrae el Expert Forge Adapter como markdown limpio → `prdOutputData.expert_forge_spec`
- El `document` sigue siendo el PRD maestro completo (backward compatible)

Se usa un triple split con markers: `===LAYER_B===`, `===LOVABLE_ADAPTER===`, `===FORGE_ADAPTER===`

#### 3. Actualizar `buildPrdNormalizationPrompt` (projectPipelinePrompts.ts ~line 760)

Reescribir para que en vez de "reorganizar", **extraiga** las 3 capas del PRD maestro ya generado. El prompt pide:
- Extraer la sección "Contrato de Interpretación" tal cual
- Extraer el "Lovable Build Adapter" tal cual
- Extraer el "Expert Forge Adapter" tal cual
- Separar con los 3 markers

#### 4. Actualizar tabs del frontend (ProjectWizardGenericStep.tsx)

Actualmente muestra 3 tabs: "PRD Completo", "Lovable Build PRD", "Expert Forge Spec".

Cambiar a 4 tabs:
- **PRD Maestro** — documento completo
- **Contrato** — `interpretation_contract` (vista de la Capa B)
- **Lovable Adapter** — `lovable_build_prd`
- **Forge Adapter** — `expert_forge_spec`

#### 5. Actualizar Publish to Forge (ProjectWizard.tsx ~line 343)

Preferir enviar `expert_forge_spec` + `interpretation_contract` concatenados como payload a Expert Forge, en vez de solo el spec.

#### 6. Actualizar contracts.ts — Step 5

Añadir `interpretation_contract` a `allowedTopLevelKeys` del paso 5. Añadir `requiredSections` para las nuevas secciones obligatorias del contrato.

### Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `src/config/projectPipelinePrompts.ts` | Reescribir `PRD_SYSTEM_PROMPT`, 6 sub-prompts, `buildPrdNormalizationPrompt` |
| `supabase/functions/project-wizard-step/index.ts` | Actualizar Call 7 (triple extraction) |
| `supabase/functions/project-wizard-step/contracts.ts` | Añadir nuevas keys/sections al step 5 |
| `src/components/projects/wizard/ProjectWizardGenericStep.tsx` | 4 tabs en vez de 3 |
| `src/pages/ProjectWizard.tsx` | Forge payload = spec + contract |

### Backward compatibility

- `prdOutputData.document` sigue existiendo = PRD maestro completo
- `lovable_build_prd` y `expert_forge_spec` siguen existiendo como keys
- Se añade `interpretation_contract` como key nueva
- PRDs generados antes del cambio se renderizan igual (fallback a 1 tab si no hay las keys nuevas)


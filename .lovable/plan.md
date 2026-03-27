

## Plan: Módulo de Compliance EU AI Act + Infrastructure Sizing

### Alcance

Implementar un clasificador de riesgo EU AI Act y un motor de dimensionamiento de infraestructura que se ejecuten como parte del pipeline PRD (post-audit, pre-manifest), produciendo una Sección 21 en el PRD y metadata de compliance por módulo en el manifest.

### Arquitectura de cambios

```text
Pipeline actual:
  Brief → Scope → Audit → PRD (Parts 1-5) → Manifest → Forge

Pipeline con compliance:
  Brief → Scope → Audit → PRD (Parts 1-5, Sección 21 en Part 4) → Manifest (con compliance) → Forge
```

La Sección 21 se genera DENTRO de Part 4 (que ya cubre secciones 15-20, se amplía a 15-21). No se añade una llamada LLM adicional — se inyecta en el prompt de Part 4 y en el prompt del manifest compiler.

---

### Cambios por archivo

#### 1. `supabase/functions/project-wizard-step/manifest-schema.ts`
- Añadir `ComplianceMetadata` interface al `ArchitectureModule`
- Añadir `infrastructure_sizing` opcional al `ArchitectureManifest`
- Añadir nuevas constantes: `EU_AI_ACT_RISK_LEVELS`, `ISOLATION_PRIORITIES`, `HUMAN_OVERSIGHT_LEVELS`, `DATA_RESIDENCY_OPTIONS`
- Ampliar `validateManifest` para verificar compliance fields cuando existan
- Ampliar `MANIFEST_COMPILATION_SYSTEM_PROMPT` con instrucciones de compliance extraction
- Ampliar `buildManifestCompilationPrompt` para inyectar contexto de vertical/dominio

Campos nuevos en `ArchitectureModule`:
```typescript
compliance?: {
  eu_ai_act_risk_level: "unacceptable" | "high" | "limited" | "minimal";
  eu_ai_act_annex_iii_domain: string | null;
  requires_isolated_model: boolean;
  isolation_priority: "mandatory" | "recommended" | "optional" | "not_needed";
  data_residency: "eu_only" | "client_premises" | "any" | "air_gapped";
  human_oversight_level: "full_autonomous" | "human_in_the_loop" | "human_on_the_loop" | "human_in_command";
  explainability_required: boolean;
  decision_logging_required: boolean;
}
```

Campo nuevo en `ArchitectureManifest`:
```typescript
infrastructure_sizing?: {
  deployment_phase: "beta" | "production" | "saas_scale";
  requires_isolated_infrastructure: boolean;
  isolation_modules_count: number;
  hardware_recommendation: Array<{
    phase: string; config: string; gpu: string;
    vram_gb: number; models_supported: string;
    concurrent_users: string; estimated_cost_eur: string;
  }>;
  llm_recommendation: Array<{
    model: string; parameters: string; license: string;
    vram_min_gb: number; use_case: string;
  }>;
  embedding_recommendation: Array<{
    model: string; dimensions: number; license: string;
    vram_gb: number; use_case: string;
  }>;
  scale_path_summary: string;
}
```

#### 2. `supabase/functions/project-wizard-step/contracts.ts`
- Añadir contrato `PHASE_CONTRACTS[21]` para la sección de Compliance IA
- Actualizar contrato de step 5 para incluir "Compliance IA" en `requiredSections`

#### 3. `supabase/functions/project-wizard-step/index.ts`
- **Part 4 prompt (L1459)**: Ampliar `userPrompt4` para incluir Sección 21 (Compliance IA y Soberanía de Datos) después de la Sección 20. Inyectar las tablas de referencia EU AI Act (dominios Annex III, criterios de aislamiento, hardware, modelos LLM, embeddings) como contexto condensado
- **Part 4 prompt**: Añadir metadata de compliance por módulo en la Sección 15 (campos `eu_ai_act_risk_level`, `requires_isolated_model`, `isolation_priority`, `data_residency`)
- **Manifest compilation (L1557-1576)**: Pasar vertical/dominio del brief al manifest compiler para que extraiga compliance metadata
- **Linter (L1693)**: Añadir sección 21 al check de secciones core
- **Part 5 prompt (L1483)**: Instrucción de que el Blueprint excluya componentes de sizing (es post-MVP infrastructure)

#### 4. `src/components/projects/wizard/ManifestViewer.tsx`
- Añadir pestaña/sección "Compliance EU AI Act" que muestre:
  - Risk level por módulo (badges coloreados: rojo=high, amarillo=limited, verde=minimal)
  - Módulos que requieren aislamiento (icono shield + isolation_priority)
  - Resumen de infrastructure sizing si existe
  - Data residency requirements

---

### Datos de referencia inyectados en el prompt

Las tablas de hardware, modelos LLM, embeddings y dominios EU AI Act se inyectan como contexto condensado en el prompt de Part 4 (~2000 tokens). No se hardcodean en TypeScript como lógica — el LLM los usa como referencia para generar la Sección 21 adaptada al proyecto.

```text
DOMINIOS_ALTO_RIESGO_ANNEX_III (condensado):
1. Biometría | 2. Infraestructura crítica | 3. Educación | 4. Empleo
5. Servicios esenciales | 6. Law enforcement | 7. Migración | 8. Justicia

CATÁLOGO_HARDWARE (condensado):
RTX 4090 24GB ~1800€ | RTX 5090 32GB ~2200€ | A100 80GB ~12000€ | H100 80GB ~25000€

MODELOS_SELF_HOSTING (condensado):
Qwen3-8B 6GB Q4 | Gemma3-12B 8GB Q4 | Qwen3-30B 20GB Q4 | Llama 3.3 70B 40GB Q4
```

### Lo que NO se toca
- Brief extraction (step 2) — no cambia
- Scope/Audit prompts — no cambian
- publish-to-forge — ya pasa el manifest completo (los campos nuevos van incluidos)
- DB schema — no hay migraciones (todo se guarda en `output_data` JSONB existente)

### Orden de implementación
1. `manifest-schema.ts` — tipos + validación + prompt compiler
2. `contracts.ts` — contrato step 21
3. `index.ts` — Part 4 prompt + linter + manifest compilation
4. `ManifestViewer.tsx` — UI compliance

### Deploy
Edge function `project-wizard-step` + frontend rebuild. Sin migraciones DB, sin nuevos secrets.


# QA Manual — Paso 2 (F0+F1) · Input sintético AFLU/AFFLUX

Este documento es **QA manual**, no se ejecuta automáticamente. Sirve para
validar el output del action `extract` del wizard (Paso 2) tras los cambios
del Pipeline v2 (F0 + F1).

## Cómo usarlo

1. Abrir el wizard de proyectos.
2. Crear/abrir un proyecto de prueba con `project_name = "AFFLUX"` y
   `company_name = "AFLU"`.
3. Pegar el **Input sintético** (abajo) como material principal.
4. Lanzar el action `extract` (Paso 2).
5. Inspeccionar `project_wizard_steps.output_data` en Supabase para
   `step_number = 2` y comparar contra la **Checklist de output esperado**.

## Input sintético

```text
Empresa: AFLU.
Proyecto: AFFLUX.

Tenemos una base de datos de edificios sin división horizontal en Madrid.
Carlos dice que dentro de los edificios lo que más nos mueve son las muertes.
Tenemos 3.000 llamadas grabadas en la centralita y mucho histórico en HubSpot.
Hemos tenido 71 visitas en 9 meses a un edificio y no hemos cerrado porque
no sabíamos qué comprador encajaba.
Queremos catalogar propietarios en 7 roles.
Alejandro dice que es muy rápido generando ideas pero malo haciendo
seguimiento.
Nos gustaría saber a quién vender antes incluso de comprar.
Hay un comprador tipo Benatar que compró un edificio que no sabíamos que
existía.
También queremos una revista emocional por rol para atacar dolores
concretos.
Procesamos datos de propietarios, llamadas, contactos y posiblemente DNI hash.
```

## Checklist de output esperado

### Top-level legacy (compatibilidad UI)

- [ ] `project_summary` (objeto, no vacío).
- [ ] `observed_facts` (array, ≥1 item).
- [ ] `inferred_needs` (array).
- [ ] `solution_candidates` (array, ≥1 item).
- [ ] `constraints_and_risks` (array, ≥1 item).
- [ ] `open_questions` (array).
- [ ] `architecture_signals` (array, ≥1 item).
- [ ] `deep_patterns` (array, puede estar vacío).
- [ ] `extraction_warnings` (array, puede estar vacío).
- [ ] `parallel_projects` (array, puede estar vacío).
- [ ] `brief_version === "2.0.0"`.

### V2 — `business_extraction_v2`

- [ ] Existe `business_extraction_v2` y NO contiene `component_registry`,
      `components` ni `ComponentRegistryItem`.
- [ ] `business_extraction_v2.business_catalysts` (o
      `business_catalyst_candidates`) menciona **fallecimientos / muertes /
      herencias**.
- [ ] `business_extraction_v2.underutilized_data_assets` (o
      `data_assets_mentioned` en F0) menciona **3.000 llamadas grabadas** y
      **histórico de HubSpot**.
- [ ] `business_extraction_v2.quantified_economic_pains` (o equivalente)
      contiene **71 visitas en 9 meses sin cierre**.
- [ ] `business_extraction_v2.client_requested_items` o `inferred_needs`
      contiene **catalogación de propietarios en 7 roles**.
- [ ] `business_extraction_v2.ai_native_opportunity_signals` contiene
      una señal sobre **comprador tipo Benatar** (oportunidades ocultas).
- [ ] `business_extraction_v2.ai_native_opportunity_signals` o
      `decision_points` contiene **matching activo↔inversor antes de
      comprar**.
- [ ] `business_extraction_v2.client_requested_items` o `inferred_needs`
      contiene **revista emocional por rol**.
- [ ] `business_extraction_v2.founder_commitment_signals` (o
      `constraints_and_risks`) refleja el **riesgo de captura del Soul de
      Alejandro** (rápido generando, malo en seguimiento).
- [ ] `business_extraction_v2.initial_compliance_flags` incluye al menos:
  - `personal_data_processing`
  - `profiling`
  - `commercial_prioritization`
  - `gdpr_article_22_risk` (si el sistema infiere decisiones automatizadas)

### F0 — señales preservadas

- [ ] Existe `_f0_signals` (o equivalente inyectado en el contexto F1).
- [ ] `_f0_signals.golden_quotes` contiene al menos:
  - "lo que más nos mueve son las muertes"
  - "3.000 llamadas grabadas"
  - "71 visitas en 9 meses"
  - "catalogar propietarios en 7 roles"
  - "comprador tipo Benatar"
  - "revista emocional por rol"
- [ ] `_f0_signals.named_entities` incluye `Carlos`, `Alejandro`, `Benatar`,
      `AFLU`, `AFFLUX`, `Madrid`, `HubSpot`.
- [ ] `_f0_signals.quantitative_signals` contiene `3.000`, `71`, `9 meses`,
      `7 roles`.
- [ ] `_f0_signals.business_catalyst_candidates` menciona muertes / herencias.
- [ ] `_f0_signals.economic_pain_candidates` menciona pérdida por no haber
      cerrado las 71 visitas.

### Anti-leak — F1 NO crea ComponentRegistry

- [ ] El JSON output **NO** contiene `component_registry`.
- [ ] El JSON output **NO** contiene `components` (top-level ni dentro de
      `business_extraction_v2`).
- [ ] El JSON output **NO** contiene `ComponentRegistryItem`.
- [ ] Si algún item viene con `id` tipo `COMP-XXX`, debe quedar registrado
      en `extraction_warnings` (no borrado del array, pero flagged).

### Trazabilidad

- [ ] Si el LLM truncó el JSON y el sanitizer lo reparó, debe aparecer
      `_truncation_repaired === true` en el output (campo permitido por
      `allowedTopLevelKeys`).
- [ ] La metadata `contract_version` debe ser `"v3.2"` (output schema
      version del contrato F1 actual).

## Notas

- F2/F3/F4/F6/F7 NO deben ejecutarse en este paso. Si aparecen
  `ComponentRegistryItems` reales, es un BUG y hay que abrir incidencia.
- Si el campo `_f0_signals` viene vacío con `_meta.generated === false`,
  significa que F0 falló o no se ejecutó: revisar logs de la edge function
  `project-wizard-step` por errores en `runF0SignalPreservation`.

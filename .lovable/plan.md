

# Plan: Elevar el PRD Técnico al nivel de un Diseño Low-Level completo

## Contexto

El documento de referencia (44 páginas, "Pharma Shortage Low-Level") tiene una profundidad radicalmente superior al PRD actual. El PRD actual genera 15 secciones genéricas (resumen, objetivos, alcance, personas, flujos, módulos, requisitos, NFR, datos, integraciones, IA, telemetría, riesgos, fases, anexos). El documento de referencia incluye secciones de dominio profundo que el PRD actual no contempla: ontología de entidades, catálogo exhaustivo de variables, patrones operativos, diseño del motor de riesgo, severity scoring, grafo terapéutico, inteligencia noticiosa, RAGs especializadas, Signal Object, tiers de frescura, matriz de despliegue Core/Alpha/Experimental, fórmulas de scoring, reglas de convergencia, cascade logic, y un checklist maestro de construcción.

## Cambios necesarios

### 1. Reestructurar las secciones del PRD (de 15 a ~25 secciones)

Nuevo esqueleto de secciones distribuido en **6 calls generativas** (actualmente 4):

| Call | Secciones | Contenido |
|------|-----------|-----------|
| Part 1 | 1-4 | Resumen ejecutivo, Marco del problema y tesis de diseño, Principios de arquitectura, Objetivos y métricas |
| Part 2 | 5-9 | Ontología de entidades, Catálogo de variables (todas, agrupadas por familia), Patrones de alto valor, Alcance cerrado, Personas y roles |
| Part 3 | 10-14 | Flujos principales, Módulos del producto, Requisitos funcionales, Requisitos no funcionales, Diseño de IA |
| Part 4 | 15-19 | Motor de scoring/riesgo, Modelo de datos SQL completo, Edge Functions y orquestación (con cadencias), Integraciones y Signal Object, Seguridad/RLS/gobierno |
| Part 5 | 20-24 | UX y wireframes textuales, Telemetría y analítica, Riesgos y mitigaciones, Plan de fases/sprints, Matriz Core/Alpha/Experimental |
| Part 6 | 25+ Blueprint | Lovable Build Blueprint (copy-paste), Checklist maestro de construcción, Specs RAG + Patterns, Glosario y anexos |

### 2. Archivos a modificar

**`src/config/projectPipelinePrompts.ts`** (cambio mayor):
- Reescribir `PRD_SYSTEM_PROMPT` para incluir instrucciones de profundidad low-level
- Añadir instrucciones explícitas: "No generes un PRD resumen. Genera un diseño low-level operativo con variables concretas, patrones definidos, fórmulas de scoring, Signal Objects y cadencias"
- Reescribir `buildPrdPart1Prompt` → Secciones 1-4 (problema, tesis, principios, métricas)
- Reescribir `buildPrdPart2Prompt` → Secciones 5-9 (ontología, variables, patrones, alcance, personas)
- Reescribir `buildPrdPart3Prompt` → Secciones 10-14 (flujos, módulos, RF, NFR, IA)
- Nuevo `buildPrdPart4Prompt` → Secciones 15-19 (scoring, SQL, Edge Functions, integraciones, seguridad)
- Nuevo `buildPrdPart5Prompt` → Secciones 20-24 (UX, telemetría, riesgos, fases, matriz despliegue)
- Reestructurar antiguo Part 4 como `buildPrdPart6Prompt` → Blueprint + Checklist + Specs
- Actualizar `buildPrdValidationPrompt` para validar 6 partes en vez de 4

**`supabase/functions/project-wizard-step/index.ts`** (cambio moderado):
- Actualizar la acción `generate_prd` para ejecutar 6 calls en lugar de 4
- Mantener paralelismo: Parts 1, 2, 3 en paralelo (comparten `sharedContext`); Parts 4, 5 secuenciales (dependen de anteriores); Part 6 secuencial (depende de todo)
- Actualizar el merge final para concatenar 6 partes
- Actualizar la llamada de validación para pasar 6 partes

### 3. Nuevas instrucciones clave en los prompts

Cada sección nueva tendrá templates explícitos inspirados en el documento de referencia:

- **Ontología de entidades**: Categorías (producto, industrial, geográfica, clínica, narrativa) con campos obligatorios
- **Catálogo de variables**: Tablas con Clave | Descripción | Tipo | Valor analítico, agrupadas por familia (demanda, epidemiología, meteo, regulatorio, oferta, grafo, social, etc.)
- **Patrones**: Tabla con Código | Patrón | Condición resumida | Respuesta sugerida (mínimo 20-30 patrones por proyecto)
- **Motor de scoring**: Fórmula conceptual, variables objetivo, incertidumbre, abstención, reglas de convergencia
- **Signal Object**: Campos estandarizados (signal_id, source_family, freshness_tier, ttl_hours, normalized_score, confidence, affected_entities)
- **Tiers de frescura**: F0-F4 con latencia y uso en score
- **Cadencias**: Tabla componente | frecuencia de actualización
- **Matriz despliegue**: Core MVP | Alpha Edge | Experimental | Descartado
- **Checklist maestro**: Lista P0/P1/P2 de ítems de build

### 4. Incremento de tokens

- `maxOutputTokens` por call: 8192 → 12288 (para acomodar tablas extensas de variables y patrones)
- El PRD resultante pasará de ~15-20 páginas a ~35-45 páginas

## Impacto

- Solo afecta a la generación del Step 7 (PRD)
- El coste de generación aumentará ~50% (6 calls vs 4, tokens mayores)
- No hay cambios en UI, el `ProjectWizardGenericStep` ya renderiza Markdown de cualquier longitud
- La validación cruzada (Claude) se mantiene como call final


// ── Project Pipeline Prompts — V13 SIMPLIFIED 5-STEP PIPELINE ────────────
// Pipeline: Input → Briefing → Scope (fused) → AI Audit → PRD (low-level)
// CHANGES V13:
//   - Simplified from 10 steps to 5 steps
//   - Step 3 fuses draft + audit + final doc internally
//   - Steps 8-10 (Blueprint, RAG, Patterns) removed — specs embedded in PRD
//   - PRD (Step 5) includes RAG specs and pattern specs as sections

export const STEP_NAMES = [
  "Entrada del Proyecto",        // 0 → step 1
  "Extracción Inteligente",      // 1 → step 2
  "Documento de Alcance",        // 2 → step 3 (fused: draft + audit + final)
  "Auditoría IA",                // 3 → step 4
  "PRD Técnico",                 // 4 → step 5 (low-level design, final output)
] as const;

export const STEP_MODELS: Record<number, string> = {
  2: "gemini-flash",       // Extracción → Gemini 2.5 Flash
  3: "claude-sonnet",      // Documento de Alcance (fused) → Claude Sonnet 4
  4: "claude-sonnet",      // AI Leverage → Claude Sonnet 4
  5: "gemini-pro",         // PRD Técnico → Gemini 3.1 Pro (fallback: Claude Sonnet)
};

// ── Helpers ───────────────────────────────────────────────────────────────

const codeBlock = (label: string, content: string) =>
  `### ${label}\n\`\`\`\n${content}\n\`\`\``;

const buildPrompt = (systemPrompt: string, task: string, context?: string, examples?: { input: string; output: string }[]) => {
  let prompt = systemPrompt + "\n\n";
  if (context) prompt += codeBlock("CONTEXTO", context) + "\n\n";
  if (examples && examples.length > 0) {
    prompt += "A continuación, algunos ejemplos de cómo debes responder:\n\n";
    examples.forEach((ex, i) => {
      prompt += codeBlock(`EJEMPLO ${i + 1} - INPUT`, ex.input) + "\n\n";
      prompt += codeBlock(`EJEMPLO ${i + 1} - OUTPUT`, ex.output) + "\n\n";
    });
  }
  prompt += codeBlock("INPUT", task);
  return prompt;
};

// ── FASE 1: Entrada del Proyecto ──────────────────────────────────────────

// No prompts needed. Just input content.

// ── FASE 2: Extracción Inteligente ─────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `Eres un asistente experto en extracción de información. Tu objetivo es analizar un texto y extraer la información clave para entender el proyecto.

Debes devolver un objeto JSON con la siguiente estructura:

\`\`\`json
{
  "projectName": string,          // Nombre del proyecto
  "companyName": string,          // Nombre de la empresa
  "projectType": "mixto" | "app" | "web" | "otro",  // Tipo de proyecto
  "clientNeed": string,         // Resumen de la necesidad del cliente
  "projectDescription": string,   // Descripción detallada del proyecto
  "projectGoal": string,          // Objetivo principal del proyecto
  "targetAudience": string,       // Público objetivo del proyecto
  "suggestedTechStack": string,   // Tech stack sugerido (si lo hay)
  "attachments": [                // Lista de documentos adjuntos (si los hay)
    {
      "name": string,             // Nombre del archivo
      "type": string,             // Tipo de archivo (ej: "application/pdf")
      "size": number,             // Tamaño del archivo en bytes
      "path": string              // Ruta al archivo en el storage
    }
  ],
  "sections": [                  // Lista de secciones del documento (si las hay)
    {
      "title": string,            // Título de la sección
      "content": string           // Contenido de la sección
    }
  ],
  "entities": [                  // Lista de entidades detectadas (si las hay)
    {
      "text": string,             // Texto de la entidad
      "type": string              // Tipo de entidad (ej: "PERSON", "ORG", "GPE")
    }
  ],
  "summary": string               // Resumen del documento
}
\`\`\`

Si no encuentras alguna de las propiedades, déjala vacía. No inventes información.

IMPORTANTE:
- Devuelve SÓLO el objeto JSON. No incluyas texto adicional.
- Si hay documentos adjuntos, incluye su información en la propiedad "attachments".
- Si el texto está estructurado en secciones, incluye su título y contenido en la propiedad "sections".
- Si detectas entidades relevantes, inclúyelas en la propiedad "entities".
- Incluye un resumen del documento en la propiedad "summary".
`;

const buildExtractionPrompt = (inputContent: string, inputType: string) => {
  const task = `Analiza el siguiente ${inputType} y extrae la información clave para entender el proyecto.

${inputType.toUpperCase()}:
${inputContent}
`;
  return buildPrompt(EXTRACTION_SYSTEM_PROMPT, task);
};

// ── FASE 3: Documento de Alcance (FUSED) ───────────────────────────────────

const SCOPE_SYSTEM_PROMPT = `Eres un arquitecto de software experto en diseñar la arquitectura de proyectos digitales. Tu objetivo es generar un documento de alcance detallado basado en el briefing del proyecto.

Debes devolver un documento en formato Markdown con la siguiente estructura:

\`\`\`md
# Alcance del Proyecto

## 1. Introducción
[Breve descripción del proyecto y su objetivo principal.]

## 2. Objetivos
[Lista de objetivos específicos que se deben lograr con el proyecto.]

## 3. Funcionalidades
[Descripción detallada de las funcionalidades que se implementarán en el proyecto.]

## 4. Arquitectura
[Descripción de la arquitectura del sistema, incluyendo los componentes principales y su interacción.]

## 5. Integraciones
[Descripción de las integraciones con otros sistemas o servicios.]

## 6. Entregables
[Lista de los entregables que se proporcionarán al cliente.]

## 7. Cronograma
[Cronograma detallado de las actividades y fechas de entrega.]

## 8. Costos
[Estimación de los costos asociados al desarrollo del proyecto.]

## 9. Riesgos
[Identificación de los riesgos potenciales y las estrategias de mitigación.]

## 10. Aprobación
[Espacio para la firma del cliente y la fecha de aprobación.]
\`\`\`

IMPORTANTE:
- El documento debe ser claro, conciso y fácil de entender.
- Incluye todos los detalles necesarios para que el cliente tenga una visión completa del proyecto.
- Utiliza un lenguaje técnico adecuado para el público objetivo.
- El documento debe estar en formato Markdown.
`;

const buildScopePrompt = (briefingJson: any, contactName: string, pricingMode: string, currentDate: string, attachmentsContent?: { name: string; type: string; content: string }[]) => {
  const task = `Genera un documento de alcance detallado basado en el siguiente briefing del proyecto:

\`\`\`json
${JSON.stringify(briefingJson, null, 2)}
\`\`\`

Datos adicionales:
- Contacto del cliente: ${contactName}
- Fecha actual: ${currentDate}
- Cifras de inversión: ${pricingMode === "none" ? "Sin cifras" : pricingMode === "custom" ? "Rangos personalizados" : "Detalle completo"}
${attachmentsContent && attachmentsContent.length > 0 ? `
Contenido de los adjuntos:
${attachmentsContent.map(att => `
  - ${att.name}:
    \`\`\`
    ${att.content}
    \`\`\`
`).join("\n")}
` : ""}
`;
  return buildPrompt(SCOPE_SYSTEM_PROMPT, task);
};

const AUDIT_SYSTEM_PROMPT = `Eres un auditor de proyectos de software. Tu objetivo es revisar un documento de alcance y detectar posibles contradicciones o inconsistencias con el material original del proyecto.

Debes devolver un objeto JSON con la siguiente estructura:

\`\`\`json
{
  "contradictions": [
    {
      "section": string,         // Sección del documento donde se encuentra la contradicción
      "description": string,    // Descripción detallada de la contradicción
      "severity": "high" | "medium" | "low"  // Severidad de la contradicción
    }
  ],
  "suggestions": [
    {
      "section": string,         // Sección del documento donde se encuentra la sugerencia
      "description": string     // Descripción detallada de la sugerencia
    }
  ]
}
\`\`\`

IMPORTANTE:
- Devuelve SÓLO el objeto JSON. No incluyas texto adicional.
- Si no encuentras contradicciones o sugerencias, devuelve un objeto JSON vacío.
- La severidad de la contradicción debe ser "high", "medium" o "low".
- Las sugerencias deben ser constructivas y ayudar a mejorar el documento de alcance.
`;

const buildAuditPrompt = (scopeDocument: string, originalInput: string) => {
  const task = `Revisa el siguiente documento de alcance y detecta posibles contradicciones o inconsistencias con el material original del proyecto:

\`\`\`md
${scopeDocument}
\`\`\`

Material original del proyecto:
\`\`\`text
${originalInput}
\`\`\`
`;
  return buildPrompt(AUDIT_SYSTEM_PROMPT, task);
};

const FINAL_DOC_SYSTEM_PROMPT = `Eres un arquitecto de software experto en diseñar la arquitectura de proyectos digitales. Tu objetivo es generar un documento de alcance detallado y corregido basado en un borrador inicial y una auditoría del mismo.

Debes devolver un documento en formato Markdown con la siguiente estructura:

\`\`\`md
# Alcance del Proyecto

## 1. Introducción
[Breve descripción del proyecto y su objetivo principal.]

## 2. Objetivos
[Lista de objetivos específicos que se deben lograr con el proyecto.]

## 3. Funcionalidades
[Descripción detallada de las funcionalidades que se implementarán en el proyecto.]

## 4. Arquitectura
[Descripción de la arquitectura del sistema, incluyendo los componentes principales y su interacción.]

## 5. Integraciones
[Descripción de las integraciones con otros sistemas o servicios.]

## 6. Entregables
[Lista de los entregables que se proporcionarán al cliente.]

## 7. Cronograma
[Cronograma detallado de las actividades y fechas de entrega.]

## 8. Costos
[Estimación de los costos asociados al desarrollo del proyecto.]

## 9. Riesgos
[Identificación de los riesgos potenciales y las estrategias de mitigación.]

## 10. Aprobación
[Espacio para la firma del cliente y la fecha de aprobación.]
\`\`\`

IMPORTANTE:
- El documento debe ser claro, conciso y fácil de entender.
- Incluye todos los detalles necesarios para que el cliente tenga una visión completa del proyecto.
- Utiliza un lenguaje técnico adecuado para el público objetivo.
- El documento debe estar en formato Markdown.
- Debes corregir las contradicciones y aplicar las sugerencias de la auditoría.
`;

const buildFinalDocPrompt = (scopeDocument: string, auditJson: any) => {
  const task = `Genera un documento de alcance detallado y corregido basado en el siguiente borrador inicial y la auditoría del mismo:

Borrador inicial:
\`\`\`md
${scopeDocument}
\`\`\`

Auditoría:
\`\`\`json
${JSON.stringify(auditJson, null, 2)}
\`\`\`
`;
  return buildPrompt(FINAL_DOC_SYSTEM_PROMPT, task);
};

// ── FASE 4: AI Leverage ────────────────────────────────────────────────────

const AI_LEVERAGE_SYSTEM_PROMPT = `Eres un consultor experto en identificar oportunidades de aplicar inteligencia artificial en proyectos de software. Tu objetivo es analizar un documento de alcance y proponer funcionalidades que puedan ser mejoradas o automatizadas con el uso de IA.

Debes devolver un objeto JSON con la siguiente estructura:

\`\`\`json
{
  "opportunities": [
    {
      "section": string,         // Sección del documento donde se encuentra la oportunidad
      "description": string,    // Descripción detallada de la oportunidad
      "potentialBenefit": string, // Beneficio potencial de implementar la IA
      "estimatedRoi": number      // Retorno de la inversión estimado (en porcentaje)
    }
  ],
  "risks": [
    {
      "section": string,         // Sección del documento donde se encuentra el riesgo
      "description": string,    // Descripción detallada del riesgo
      "mitigationStrategy": string // Estrategia de mitigación del riesgo
    }
  ]
}
\`\`\`

IMPORTANTE:
- Devuelve SÓLO el objeto JSON. No incluyas texto adicional.
- Si no encuentras oportunidades o riesgos, devuelve un objeto JSON vacío.
- El retorno de la inversión estimado debe ser un número entre 0 y 100.
- Las estrategias de mitigación de riesgos deben ser realistas y viables.
`;

const buildAiLeveragePrompt = (scopeDocument: string, activityContext?: string) => {
  const task = `Analiza el siguiente documento de alcance y propón funcionalidades que puedan ser mejoradas o automatizadas con el uso de IA:

\`\`\`md
${scopeDocument}
\`\`\`

${activityContext ? `
Contexto de actividad reciente del proyecto:
\`\`\`md
${activityContext}
\`\`\`
` : ""}
`;
  return buildPrompt(AI_LEVERAGE_SYSTEM_PROMPT, task);
};

// ── FASE 5: PRD TÉCNICO — LOW-LEVEL DESIGN ──────────────────────────────

const PRD_SYSTEM_PROMPT = `Eres un arquitecto de sistemas experto. Tu objetivo es generar un PRD Maestro con tres BLOQUES y una arquitectura IA de 5 capas (A-E). El documento tiene dos consumidores: herramientas de build (Lovable) y sistemas de orquestación IA (Expert Forge). Además, se compilará un Architecture Manifest JSON (source of truth ejecutable) a partir de este PRD.

REGLA DE PRECEDENCIA: Si hay contradicción entre el PRD narrativo y el Architecture Manifest, MANDA el Manifest. El PRD es la explicación humana; el Manifest es el contrato ejecutable.

ESTRUCTURA OBLIGATORIA DEL PRD MAESTRO:

═══ BLOQUE 1 — CONTRATO DE INTERPRETACIÓN MÁQUINA ═══
(Va AL PRINCIPIO del documento, antes del contenido técnico)

B.1. CONTRATO DE INTERPRETACIÓN DEL PRD
  1. Este documento es una especificación operativa, no conceptual.
  2. Todo componente debe clasificarse con uno de estos 7 module_type: knowledge_module | action_module | pattern_module | executive_cognition_module | improvement_module | deterministic_engine | router_orchestrator
  3. Todo componente debe asignarse a una de las 5 capas de negocio: A (Knowledge) | B (Action) | C (Pattern Intelligence) | D (Executive Cognition) | E (Improvement)
  4. Si un RAG aparece definido operativamente, debe materializarse como recurso real, no como idea.
  5. Si un componente requiere RAG, el binding debe declararse y ejecutarse.
  6. Los motores deterministas NO son especialistas IA — nunca tienen LLM ni temperatura.
  7. El único alcance buildable inmediato es V1 / Fases 0 y 1.
  8. Todo lo marcado como Fase 2+ queda en roadmap y no se implementa por defecto.
  9. Si existe ambigüedad de naming, prevalece el nombre canónico de la matriz B.2.
  10. No se permite inventar módulos, tecnologías o relaciones no descritas explícitamente.

B.2. NOMENCLATURA CANÓNICA
  Tabla con columnas: nombre_canónico | aliases_permitidos | module_type | layer (A-E) | fase

B.3. CLASIFICACIÓN DE COMPONENTES (7 TIPOS + 5 CAPAS)
  Tabla con columnas: componente | module_type | layer | requiere_rag | rags_vinculados | sensitivity_zone | materialization_target | automation_level | requires_human_approval | execution_mode | fase | build_now_o_roadmap

B.4. BINDINGS RAG ↔ COMPONENTE
  Tabla con columnas: rag_id | nombre_rag | componentes_consumidores | fuentes | fase

B.5. BUILD SCOPE (Fase 0+1 = buildable now)
  Lista explícita de todo lo que se construye en V1.

B.6. ROADMAP SCOPE (Fase 2+ = no ejecutable por defecto)
  Lista explícita de todo lo que NO se construye ahora.

═══ BLOQUE 2 — PRD MAESTRO (cuerpo técnico) ═══

1. Resumen Ejecutivo (máx 300 palabras, sin narrativa comercial)
2. Problema y Tesis
3. Arquitectura del Sistema (stack acotado, diagrama de componentes)
4. Diseño de Base de Datos (SQL real, entidades, relaciones)
5. APIs y Edge Functions (endpoints, inputs/outputs, triggers)
6. Integraciones (sistemas externos, conectores)
7. Seguridad y RLS (roles, permisos, políticas)
8. Inventario IA (RAGs, especialistas, motores deterministas — cada uno tipado según BLOQUE 1)
9. Patrones de Diseño
10. Workflows y Flujos Principales
11. Observabilidad y Monitorización
12. Escalabilidad
13. Riesgos y Mitigaciones
14. Diseño de IA (arquitectura IA detallada, prompts, guardrails)
15. Inventario Formal de Componentes IA — ARQUITECTURA 5 CAPAS (A-E) (ver regla S15 abajo)

REGLA: Cada componente mencionado en el BLOQUE 2 DEBE usar su nombre canónico del BLOQUE 1, llevar su module_type entre corchetes y su capa entre paréntesis, ej: "Motor SBA [deterministic_engine] (Capa C)".

═══ BLOQUE 3 — ADAPTERS EMBEBIDOS ═══

C.1. LOVABLE BUILD ADAPTER (acotado a Fase 0+1)
  - Módulos MVP con entidades, pantallas, edge functions
  - Rutas y navegación
  - Modelo de datos SQL real
  - RBAC y RLS
  - QA Checklist
  - Exclusiones explícitas del MVP
  - Matriz de trazabilidad: módulo | pantalla | entidad | edge_function | fase

C.2. EXPERT FORGE ADAPTER
  - Knowledge Domains
  - Core Entities con relaciones
  - RAGs propuestos (nombre, propósito, entidades, fuentes, tipos doc, prioridad, calidad, restricciones)
  - Especialistas propuestos (nombre, misión, inputs, outputs, RAGs vinculados, reglas, criterios, materialization_target)
  - Motores deterministas (nombre, función, inputs, outputs, reglas, execution_mode)
  - Router Logic (tipos consultas, especialista principal, fallback, ambigüedades)
  - Soul Inputs (SOLO si Capa D activa — con scope, authority_level, governance_rules)
  - Hydration Plan
  - Frontera determinista vs probabilístico
  - Validación cruzada contra BLOQUE 1

═══ REGLA DEFINITIVA S15: INVENTARIO FORMAL DE COMPONENTES IA — ARQUITECTURA 5 CAPAS (A-E) ═══

PRINCIPIO ABSOLUTO: La sección 15 es el CONTRATO entre el diseño técnico y el sistema de instanciación (Expert Forge) + el Architecture Manifest. Si un componente no aparece en la sección 15, NO EXISTE para producción.

ESTRUCTURA OBLIGATORIA — exactamente 7 subsecciones, en este orden:

### 15.1 Capa A — Knowledge Layer (RAGs, Bases de Conocimiento)
Para cada RAG: ID (RAG-XX), Nombre, Función, Fuentes, Volumen, Modelo embedding, Chunk strategy, Actualización, Edge Function, Fase, materialization_target.
Detalle: esquema metadatos, query template, fallback, métricas (Precision@K, latencia).
REGLA DE DERIVACIÓN: NO consolidar RAGs. Crear RAGs separados si fuentes, frecuencia, metadatos o consumidores son diferentes.

### 15.2 Capa B — Action Layer (Agentes, Workflows, Orquestadores)
Para cada Agente: ID (AGT-XX), Nombre, Rol, Modelo LLM, Temperatura, Input/Output JSON schema, Métricas, Edge Function, Trigger, Fase, RAGs vinculados, Guardrails, Fallback, sensitivity_zone, automation_level, requires_human_approval, materialization_target.
Para cada Orquestador: ID (ORC-XX), Nombre, Función, Componentes coordinados (IDs), Lógica routing, Edge Function, Fase, materialization_target.
REGLA DE TEMPERATURA: Extracción/OCR: 0.0-0.2; Clasificación/Routing: 0.1-0.3; Evaluación/Auditoría: 0.0-0.2; Análisis: 0.3-0.5; Generación: 0.5-0.7. Si dos agentes misma temperatura, justificar.

### 15.3 Capa C — Pattern Intelligence Layer (Scoring, Ranking, Matching, Forecasting, Anomaly Detection, Segmentación, Causal, Deterministic Engines)
Para cada Motor/Pattern: ID (DET-XX/PAT-XX), Nombre, Tipo, Inputs, Output, Fórmula/Lógica, Variables, Frecuencia, Fase, execution_mode (deterministic|llm_augmented|hybrid), sensitivity_zone, materialization_target.
REGLA CRÍTICA: Si execution_mode="deterministic" → NUNCA tiene modelo LLM ni temperatura. Si usa LLM → execution_mode="llm_augmented" o "hybrid".
Detalle: pseudocódigo, al menos 2 casos prueba, umbrales alertas.

### 15.4 Capa D — Executive Cognition Layer (Soul)
REGLA: Soul NO es por defecto. Solo incluir si el proyecto tiene un stakeholder ejecutivo cuyo estilo cognitivo, tono o criterios de decisión deben influir en las respuestas del sistema.
Si aplica, documentar con campos formales obligatorios:
- enabled: true/false
- subject_type: ceo | founder | manager | worker | mixed
- scope: tone_only | advisory | strategic_assist | decision_style (dónde aplica)
- authority_level: low | medium | high (cuánto pesa — SEPARADO de scope)
- source_types: [transcripciones, emails, decisiones previas, etc.]
- influences_modules: [IDs de módulos donde Soul participa]
- excluded_from_modules: [IDs de módulos donde Soul NO participa]
- governance_rules: texto describiendo límites de influencia
Si D no aplica, incluir subsección con: "Capa D no activa en este proyecto. No se ha identificado necesidad de Executive Cognition."

### 15.5 Capa E — Improvement Layer (Telemetría, Feedback, Evaluación)
Para cada Módulo: ID (IMP-XX/LRN-XX), Nombre, Función, Alimentado por, Outputs, Requisito mínimo datos, Edge Function, Fase, evaluation_policy.
Incluir si aplica: feedback_signals, outcomes_tracked, review_cadence.
REGLA: Si Capa E activa, debe tener al menos UNO de: metrics, feedback_signals, outcomes_tracked. Si no hay ninguno, Capa E es relleno — considerar desactivar.
Existe si: PRD menciona "autoaprendizaje", "KM Graph", "feedback loop", "calibración", "re-entrenamiento", "mejora continua", o patrón "expectativa vs realidad".
Si E no aplica, incluir subsección vacía con "No aplica en este proyecto".

### 15.6 Mapa de Interconexiones
Diagrama Mermaid de TODOS los componentes. Fases futuras en punteado.
Para cada interconexión, especificar:
- from, to, data_type, frequency
- criticality: low | medium | high | critical
- interaction_type: reads_from | writes_to | triggers | evaluates | explains | modulates | none
- approval_required: boolean (¿necesita aprobación humana para ejecutar?)
- review_required: boolean (¿necesita revisión humana del resultado?)
NOTA: La gobernanza (approval/review) es SEPARADA del interaction_type.

### 15.7 Resumen de Infraestructura IA (por fases)
Tabla con columnas por fase (MVP, Fase 2, Fase 3, ..., Total).
Filas: Total RAGs, Total Agentes, Total Motores/Patterns, Total Orquestadores, Total Módulos Improvement, Total componentes, Coste IA mensual estimado, Edge Functions nuevas, Secrets adicionales.

ALGORITMO DE DERIVACIÓN — 8 PREGUNTAS OBLIGATORIAS (ejecutar MENTALMENTE antes de escribir la sección 15):
P1: ¿Qué fuentes de datos necesita el proyecto? → Capa A (RAGs)
P2: ¿Qué acciones ejecuta el sistema? → Capa B (Agentes/Orquestadores)
P3: ¿Qué decisiones basadas en datos toma? → Capa C (Pattern/Deterministic)
P4: ¿Hay un stakeholder ejecutivo cuyo estilo cognitivo importa? → Capa D (Soul) — SOLO si la respuesta es SÍ con evidencia
P5: ¿El sistema aprende y mejora con el tiempo? → Capa E (Improvement)
P6: ¿Qué zonas son sensibles (financiera, legal, compliance)? → sensitivity_zone por módulo
P7: ¿Qué módulos pueden ser automáticos sin riesgo? → automation_level
P8: ¿Cómo se materializa cada módulo en Expert Forge? → materialization_target

CAMPOS OBLIGATORIOS POR MÓDULO (además de los específicos por tipo):
- sensitivity_zone: low | business | financial | legal | compliance | people_ops | executive
- materialization_target: expertforge_rag | expertforge_specialist | expertforge_deterministic_engine | expertforge_soul | expertforge_moe | runtime_only | roadmap_only | manual_design
- execution_mode: deterministic | llm_augmented | hybrid
- automation_level: advisory | semi_automatic | automatic
- requires_human_approval: boolean

VALIDACIONES POST-GENERACIÓN (OBLIGATORIAS):
V01-V10: (mismas validaciones de antes)
V11: ¿Cada módulo tiene sensitivity_zone? → Si falta: AÑADIR como "low".
V12: ¿Cada módulo tiene materialization_target? → Si falta: inferir del tipo.
V13: ¿Cada módulo tiene execution_mode? → Si falta: inferir (LLM→llm_augmented, cálculo→deterministic).
V14: ¿Soul activa sin governance_rules? → ERROR.
V15: ¿Pattern module con purpose conversacional? → Posible misclasificación.

IMPORTANTE:
- El documento debe ser técnico, preciso y sin narrativa comercial.
- Usa formato Markdown con los markers ═══BLOQUE_1═══, ═══BLOQUE_2═══, ═══BLOQUE_3═══ para delimitar los bloques.
- NO inventes componentes, tecnologías ni relaciones que no estén en los inputs.
- Cada RAG debe tener binding explícito a componentes.
- "Capa A-E" se refiere SIEMPRE a la arquitectura IA de negocio, NO a las capas del documento (que son BLOQUES).
`;

const buildPrdPart1Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera el BLOQUE 1 completo (Contrato de Interpretación Máquina con 7 module_type + 5 capas A-E) + Introducción (Resumen Ejecutivo + Problema + Tesis) del PRD Maestro.

Documento de alcance:
\`\`\`md
${scopeDocument}
\`\`\`

Oportunidades de IA:
\`\`\`json
${JSON.stringify(aiLeverageJson, null, 2)}
\`\`\`

Instrucciones:
- Empieza con ═══BLOQUE_1═══
- Genera la tabla de nomenclatura canónica analizando TODOS los componentes del proyecto.
- Clasifica cada componente con uno de los 7 module_type y asigna capa A-E.
- Incluye por componente: sensitivity_zone, materialization_target, automation_level, requires_human_approval, execution_mode.
- Genera los bindings RAG ↔ componente explícitos.
- Define el Build Scope (Fase 0+1) y Roadmap Scope (Fase 2+).
- Incluye las 10 reglas anti-reinterpretación del contrato.
- Después, empieza ═══BLOQUE_2═══ con Resumen Ejecutivo, Problema y Tesis.
`;
  return buildPrompt(PRD_SYSTEM_PROMPT, task);
};

const buildPrdPart2Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera las secciones 3-6 de la CAPA A del PRD Maestro: Arquitectura, Base de Datos, APIs/Edge Functions e Integraciones.

Documento de alcance:
\`\`\`md
${scopeDocument}
\`\`\`

Oportunidades de IA:
\`\`\`json
${JSON.stringify(aiLeverageJson, null, 2)}
\`\`\`

Instrucciones:
- Usa nombres canónicos de la Capa B. Cada componente lleva su tipo entre corchetes.
- SQL real para el modelo de datos (CREATE TABLE con tipos, FK, índices).
- Edge Functions con nombre, trigger, input/output.
- Cada RAG mencionado debe tener su binding explícito.
`;
  return buildPrompt(PRD_SYSTEM_PROMPT, task);
};

const buildPrdPart3Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera las secciones 7-9 y 14-15 del BLOQUE 2 del PRD Maestro: Seguridad/RLS, Inventario IA, Patrones de Diseño, Diseño de IA detallado e Inventario Formal de Componentes IA con Arquitectura 5 Capas A-E (Sección 15).

Documento de alcance:
\`\`\`md
${scopeDocument}
\`\`\`

Oportunidades de IA:
\`\`\`json
${JSON.stringify(aiLeverageJson, null, 2)}
\`\`\`

Instrucciones:
- Seguridad: roles, permisos, políticas RLS concretas.
- Inventario IA (sección 8): tabla completa de RAGs (con bindings), especialistas IA, motores deterministas. Cada uno tipado según BLOQUE 1 con module_type y capa A-E.
- Patrones de diseño aplicados al proyecto, separando MVP de roadmap.
- Diseño de IA (sección 14): arquitectura IA detallada, prompts, guardrails, lógica de routing.

═══ INSTRUCCIONES DEFINITIVAS PARA SECCIÓN 15 — ARQUITECTURA 5 CAPAS (A-E) ═══

Aplica la REGLA DEFINITIVA S15 del system prompt AL COMPLETO. La sección 15 es el CONTRATO con Expert Forge y el Architecture Manifest.

ALGORITMO DE DERIVACIÓN — ejecutar las 8 PREGUNTAS OBLIGATORIAS:
P1: ¿Qué fuentes de datos? → Capa A (RAGs) — 15.1
P2: ¿Qué acciones ejecuta? → Capa B (Agentes/Orquestadores) — 15.2
P3: ¿Qué decisiones basadas en datos? → Capa C (Pattern/Deterministic) — 15.3
P4: ¿Hay stakeholder ejecutivo cuyo estilo importa? → Capa D (Soul) — 15.4 — SOLO si hay evidencia
P5: ¿El sistema aprende/mejora? → Capa E (Improvement) — 15.5
P6: ¿Qué zonas sensibles? → sensitivity_zone por módulo
P7: ¿Qué módulos automáticos sin riesgo? → automation_level
P8: ¿Cómo materializar en Expert Forge? → materialization_target

Generar las 7 subsecciones obligatorias EN ESTE ORDEN:
- 15.1 Capa A — Knowledge Layer (RAGs) — TODOS de TODAS las fases. Incluir detalle: esquema metadatos, query template, fallback, métricas, materialization_target.
- 15.2 Capa B — Action Layer (Agentes + Orquestadores) — TODOS. Incluir: system prompt COMPLETO, temperatura diferenciada, RAGs vinculados, guardrails, sensitivity_zone, automation_level, requires_human_approval, materialization_target.
- 15.3 Capa C — Pattern Intelligence (Motores + Patterns) — TODOS. execution_mode OBLIGATORIO (deterministic|llm_augmented|hybrid). Sin LLM si deterministic. Pseudocódigo + 2 casos prueba.
- 15.4 Capa D — Executive Cognition (Soul) — SOLO si hay evidencia. Campos formales: enabled, subject_type, scope, authority_level (SEPARADO de scope), source_types, influences_modules, excluded_from_modules, governance_rules. Si no aplica → "No aplica en este proyecto".
- 15.5 Capa E — Improvement — Si hay feedback loops/aprendizaje. feedback_signals, outcomes_tracked, evaluation_policy. Si no aplica → vacía.
- 15.6 Mapa Interconexiones — Mermaid. interaction_type SIN human_gate. approval_required y review_required como campos separados de gobernanza.
- 15.7 Resumen Infraestructura — tabla con columnas por fase.

CAMPOS OBLIGATORIOS POR MÓDULO: sensitivity_zone, materialization_target, execution_mode, automation_level, requires_human_approval.

Al FINAL, ejecutar validaciones V01-V15 y CORREGIR cualquier gap.
`;
  return buildPrompt(PRD_SYSTEM_PROMPT, task);
};

const buildPrdPart4Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera las secciones 10-13 del BLOQUE 2 del PRD Maestro: Workflows, Observabilidad, Escalabilidad y Riesgos.

Documento de alcance:
\`\`\`md
${scopeDocument}
\`\`\`

Oportunidades de IA:
\`\`\`json
${JSON.stringify(aiLeverageJson, null, 2)}
\`\`\`

Instrucciones:
- Workflows con diagramas Mermaid si aplica.
- Observabilidad alineada con Capa E (Improvement): si hay feedback_signals o outcomes_tracked definidos en sección 15.5, referenciarlos aquí. Incluir métricas de rendimiento IA, alertas por degradación, logging por módulo.
- Escalabilidad: estrategias concretas.
- Riesgos con plan de mitigación, incluyendo riesgos específicos por sensitivity_zone.
- Usa nombres canónicos del BLOQUE 1 con [module_type] (Capa X).
`;
  return buildPrompt(PRD_SYSTEM_PROMPT, task);
};

const buildPrdPart5Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera el BLOQUE 3, sección C.1 — LOVABLE BUILD ADAPTER del PRD Maestro.

Documento de alcance:
\`\`\`md
${scopeDocument}
\`\`\`

Oportunidades de IA:
\`\`\`json
${JSON.stringify(aiLeverageJson, null, 2)}
\`\`\`

Instrucciones:
- Empieza con ═══BLOQUE_3═══ y luego ## C.1. LOVABLE BUILD ADAPTER
- Acotado ESTRICTAMENTE a Fase 0+1 (Build Scope de BLOQUE 1).
- Módulos MVP con: objetivo, entidades, pantallas, edge functions, dependencias.
- Rutas y navegación completas.
- Modelo de datos SQL real (solo tablas del MVP).
- RBAC y RLS concretos.
- QA Checklist.
- Exclusiones explícitas del MVP.
- Matriz de trazabilidad: módulo | pantalla | entidad | edge_function | fase.
- NO incluir: router MoE, Soul, hidratación, fases futuras detalladas.

═══ TABLA INVENTARIO IA (RESUMEN MVP) — OBLIGATORIO ═══
Incluir una tabla con TODOS los componentes de la sección 15 que tienen fase MVP.
Formato:
| ID | Nombre | module_type | Capa | Rol | Modelo LLM | execution_mode | sensitivity_zone | automation_level | Fase |
Para motores deterministas, poner "— (deterministic)" en Modelo LLM.
`;
  return buildPrompt(PRD_SYSTEM_PROMPT, task);
};

const buildPrdPart6Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera la CAPA C.2 — EXPERT FORGE ADAPTER + Validación Cruzada del PRD Maestro.

Documento de alcance:
\`\`\`md
${scopeDocument}
\`\`\`

Oportunidades de IA:
\`\`\`json
${JSON.stringify(aiLeverageJson, null, 2)}
\`\`\`

Instrucciones:
- Sección ## C.2. EXPERT FORGE ADAPTER con:
  1. Knowledge Domains — lista explícita de dominios de conocimiento
  2. Core Entities con relaciones
  3. RAGs propuestos — nombre, propósito, entidades cubiertas, fuentes, tipos documentales, prioridad, calidad, restricciones
  4. Especialistas propuestos — nombre, misión, inputs, outputs, RAGs vinculados, reglas comportamiento, abstención, criterios éxito
  5. Motores deterministas — nombre, función, inputs, outputs, reglas (NO confundir con especialistas IA)
  6. Router Logic — tipos consultas, especialista principal, fallback, ambigüedades
  7. Soul Inputs
  8. Hydration Plan — para cada RAG: fuentes públicas/privadas, frescura, exclusión, aprobación humana
  9. Frontera determinista vs probabilístico
- Al final: VALIDACIÓN CRUZADA contra Capa B (verificar que todo componente tiene tipo, todo RAG tiene binding, todo lo buildable está en Fase 0+1).
- NO incluir: SQL schemas, wireframes UI, rutas pantalla, edge functions CRUD, QA checklist.
`;
  return buildPrompt(PRD_SYSTEM_PROMPT, task);
};

const PRD_VALIDATION_SYSTEM_PROMPT = `Eres un auditor experto en validar PRDs (Product Requirements Documents) técnicos. Tu objetivo es revisar un PRD y detectar posibles errores, omisiones o inconsistencias.

Debes devolver un objeto JSON con la siguiente estructura:

\`\`\`json
{
  "errors": [
    {
      "section": string,         // Sección del documento donde se encuentra el error
      "description": string,    // Descripción detallada del error
      "severity": "high" | "medium" | "low"  // Severidad del error
    }
  ],
  "omissions": [
    {
      "section": string,         // Sección del documento donde se encuentra la omisión
      "description": string     // Descripción detallada de la omisión
    }
  ],
  "inconsistencies": [
    {
      "section": string,         // Sección del documento donde se encuentra la inconsistencia
      "description": string     // Descripción detallada de la inconsistencia
    }
  ]
}
\`\`\`

IMPORTANTE:
- Devuelve SÓLO el objeto JSON. No incluyas texto adicional.
- Si no encuentras errores, omisiones o inconsistencias, devuelve un objeto JSON vacío.
- La severidad del error debe ser "high", "medium" o "low".
`;

const buildPrdValidationPrompt = (prdDocument: string) => {
  const task = `Revisa el siguiente PRD técnico y detecta posibles errores, omisiones o inconsistencias:

\`\`\`md
${prdDocument}
\`\`\`
`;
  return buildPrompt(PRD_VALIDATION_SYSTEM_PROMPT, task);
};

// ── Legacy prompts (kept for reference, no longer used in pipeline) ──────

const RAG_GEN_SYSTEM_PROMPT = `Eres un experto en generar especificaciones RAG (Retrieval-Augmented Generation) para proyectos de software. Tu objetivo es analizar un documento de alcance y proponer una arquitectura RAG detallada.

Debes devolver un objeto JSON con la siguiente estructura:

\`\`\`json
{
  "models": [
    {
      "name": string,             // Nombre del modelo
      "description": string      // Descripción del modelo
    }
  ],
  "embeddings": [
    {
      "name": string,             // Nombre del embedding
      "description": string      // Descripción del embedding
    }
  ],
  "dataSources": [
    {
      "name": string,             // Nombre de la fuente de datos
      "description": string      // Descripción de la fuente de datos
    }
  ],
  "indexes": [
    {
      "name": string,             // Nombre del índice
      "description": string      // Descripción del índice
    }
  ],
  "queries": [
    {
      "name": string,             // Nombre de la query
      "description": string      // Descripción de la query
    }
  ]
}
\`\`\`

IMPORTANTE:
- Devuelve SÓLO el objeto JSON. No incluyas texto adicional.
- Si no encuentras modelos, embeddings, fuentes de datos, índices o queries, devuelve un objeto JSON vacío.
`;

const buildRagGenPrompt = (scopeDocument: string) => {
  const task = `Analiza el siguiente documento de alcance y propón una arquitectura RAG detallada:

\`\`\`md
${scopeDocument}
\`\`\`
`;
  return buildPrompt(RAG_GEN_SYSTEM_PROMPT, task);
};

const PATTERNS_SYSTEM_PROMPT = `Eres un experto en identificar patrones de diseño en proyectos de software. Tu objetivo es analizar un documento de alcance y proponer patrones de diseño que puedan ser aplicados.

Debes devolver un objeto JSON con la siguiente estructura:

\`\`\`json
{
  "patterns": [
    {
      "name": string,             // Nombre del patrón
      "description": string      // Descripción del patrón
    }
  ]
}
\`\`\`

IMPORTANTE:
- Devuelve SÓLO el objeto JSON. No incluyas texto adicional.
- Si no encuentras patrones de diseño, devuelve un objeto JSON vacío.
`;

const buildPatternsPrompt = (scopeDocument: string) => {
  const task = `Analiza el siguiente documento de alcance y propón patrones de diseño que puedan ser aplicados:

\`\`\`md
${scopeDocument}
\`\`\`
`;
  return buildPrompt(PATTERNS_SYSTEM_PROMPT, task);
};

// ── BUDGET ESTIMATION (Internal — Step 6) ──────────────────────────────

export const BUDGET_ESTIMATION_SYSTEM_PROMPT = `Eres un consultor financiero experto en proyectos de software con IA. Tu trabajo es estimar presupuestos REALISTAS y proponer modelos de monetización para proyectos tecnológicos.

REGLAS CRÍTICAS:
- Estima horas de desarrollo REALES considerando el uso de herramientas de IA (Lovable, Cursor, Claude) que aceleran x3-5 el desarrollo.
- NO infles las estimaciones. Un MVP con IA se puede construir en 60-120 horas, no 500.
- Coste por hora de referencia: €60-100/hora para desarrollo con IA (España/LATAM).
- Los costes recurrentes deben ser EXACTOS: precio real de Supabase, APIs de IA (Claude, Gemini), hosting (Vercel/Netlify), dominios.
- Usa el escenario CONSERVADOR (50% del optimista) para estimaciones de ahorro/ROI.
- Los modelos de monetización deben ser ESPECÍFICOS para el tipo de proyecto, no genéricos.
- Incluye siempre el margen del consultor (30-50% sobre coste de desarrollo).
- Distingue entre coste TUYO (lo que te cuesta producirlo) y precio de VENTA al cliente.

COSTES DE REFERENCIA (2025):
- Supabase Pro: €25/mes
- Vercel Pro: €20/mes  
- Dominio: €12-15/año
- Claude API (Sonnet): €3/M input tokens, €15/M output tokens
- Gemini Flash: €0.075/M input, €0.30/M output
- OpenAI GPT-4o: €2.50/M input, €10/M output
- Almacenamiento S3/Supabase Storage: €0.02/GB/mes

Responde SOLO con JSON válido.`;

export const buildBudgetEstimationPrompt = (
  scopeDocument: string,
  aiLeverageJson: any,
  prdDocument: string
) => {
  const scopeTrunc = truncateBudget(scopeDocument, 8000);
  const aiJson = JSON.stringify(aiLeverageJson, null, 2).substring(0, 4000);
  const prdTrunc = truncateBudget(prdDocument, 8000);

  const task = `Analiza el siguiente proyecto completo y genera una estimación de presupuesto realista con modelos de monetización.

DOCUMENTO DE ALCANCE:
${scopeTrunc}

AUDITORÍA IA (oportunidades detectadas):
${aiJson}

PRD TÉCNICO (resumen de arquitectura):
${prdTrunc}

Genera un JSON con esta estructura EXACTA:
{
  "development": {
    "phases": [
      { "name": "Fase 0 - Setup & Config", "description": "...", "hours": 20, "cost_eur": 1600 }
    ],
    "total_hours": 100,
    "hourly_rate_eur": 80,
    "total_development_eur": 8000,
    "your_cost_eur": 5000,
    "margin_pct": 37.5
  },
  "recurring_monthly": {
    "items": [
      { "name": "Supabase Pro", "cost_eur": 25, "notes": "Base de datos + auth + storage" }
    ],
    "hosting": 25,
    "ai_apis": 45,
    "maintenance_hours": 4,
    "maintenance_eur": 320,
    "total_monthly_eur": 415
  },
  "monetization_models": [
    {
      "name": "Proyecto cerrado + mantenimiento",
      "description": "Desarrollo completo con entrega y mantenimiento mensual",
      "setup_price_eur": "8.000-12.000",
      "monthly_price_eur": "300-500",
      "your_margin_pct": 40,
      "pros": ["Ingreso inicial fuerte", "Relación a largo plazo"],
      "cons": ["Mayor riesgo de scope creep", "Cash flow irregular"],
      "best_for": "Clientes con presupuesto definido"
    }
  ],
  "pricing_notes": "Notas adicionales sobre la estrategia de precios",
  "risk_factors": ["Factor 1", "Factor 2"],
  "recommended_model": "nombre del modelo recomendado"
}`;
  return buildPrompt(BUDGET_ESTIMATION_SYSTEM_PROMPT, task);
};

function truncateBudget(s: string, max: number): string {
  if (!s || s.length <= max) return s || "";
  return s.substring(0, max) + "\n[...truncado]";
}

// ── PRD NORMALIZATION — DUAL OUTPUT ────────────────────────────────────────

const PRD_NORMALIZATION_SYSTEM_PROMPT = `Eres un arquitecto de sistemas experto en extracción estructurada de documentos técnicos. Tu misión es EXTRAER las tres capas embebidas de un PRD Maestro con Triple Capa, sin inventar contenido nuevo.

REGLAS ESTRICTAS:
- NO inventes información. Solo extrae lo que existe en el documento.
- Busca los markers ═══CAPA_B═══, ═══CAPA_A═══, ═══CAPA_C═══ o secciones equivalentes.
- Si no hay markers explícitos, identifica las secciones por contenido (contrato de interpretación, nomenclatura canónica, lovable adapter, forge adapter).
- Extrae las tres capas y sepáralas con los delimitadores indicados.

FORMATO DE SALIDA:
Devuelve TRES documentos separados por delimitadores exactos:
===LAYER_B=== (Contrato de Interpretación)
===LOVABLE_ADAPTER=== (Lovable Build Adapter)
===FORGE_ADAPTER=== (Expert Forge Adapter)`;

export const buildPrdNormalizationPrompt = (fullPrd: string): { system: string; user: string } => {
  const user = `Extrae las tres capas del siguiente PRD Maestro con Triple Capa.

===PRD COMPLETO===
${fullPrd}
===FIN PRD===

EXTRACCIÓN A — CONTRATO DE INTERPRETACIÓN (Capa B)
Extrae TODO el contenido de la Capa B: reglas anti-reinterpretación, nomenclatura canónica, clasificación de componentes, bindings RAG, build scope, roadmap scope.

EXTRACCIÓN B — LOVABLE BUILD ADAPTER (Capa C.1)
Extrae TODO el contenido del Lovable Build Adapter: módulos MVP, rutas, SQL, RBAC, QA checklist, exclusiones, matriz de trazabilidad.

EXTRACCIÓN C — EXPERT FORGE ADAPTER (Capa C.2)
Extrae TODO el contenido del Expert Forge Adapter: knowledge domains, core entities, RAGs propuestos, especialistas, motores deterministas, router logic, soul inputs, hydration plan, frontera determinista vs probabilístico, validación cruzada.

Separa las tres extracciones con los delimitadores EXACTOS:
===LAYER_B===
(contenido del contrato)
===LOVABLE_ADAPTER===
(contenido del lovable adapter)
===FORGE_ADAPTER===
(contenido del forge adapter)

No incluyas los delimitadores dentro del contenido de ninguna sección.`;

  return { system: PRD_NORMALIZATION_SYSTEM_PROMPT, user };
};


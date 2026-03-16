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

const PRD_SYSTEM_PROMPT = `Eres un arquitecto de sistemas experto. Tu objetivo es generar un PRD Maestro con Triple Capa: un documento único con tres capas embebidas diseñado para ser consumido tanto por herramientas de build (Lovable) como por sistemas de orquestación IA (Expert Forge).

ESTRUCTURA OBLIGATORIA DEL PRD MAESTRO:

═══ CAPA B — CONTRATO DE INTERPRETACIÓN MÁQUINA ═══
(Va AL PRINCIPIO del documento, antes del contenido técnico)

B.1. CONTRATO DE INTERPRETACIÓN DEL PRD
  1. Este documento es una especificación operativa, no conceptual.
  2. Todo componente debe clasificarse como: especialista_ia | motor_determinista | modulo_orquestador | rag | conector | modulo_ui
  3. Si un RAG aparece definido operativamente, debe materializarse como recurso real, no como idea.
  4. Si un componente requiere RAG, el binding debe declararse y ejecutarse.
  5. Los motores deterministas (ej: Forge 7) NO son especialistas IA.
  6. El único alcance buildable inmediato es V1 / Fases 0 y 1.
  7. Todo lo marcado como Fase 2+ queda en roadmap y no se implementa por defecto.
  8. Si existe ambigüedad de naming, prevalece el nombre canónico de la matriz B.2.
  9. No se permite inventar módulos, tecnologías o relaciones no descritas explícitamente.
  10. La salida de cualquier sistema que procese este PRD debe incluir: componentes detectados, tipo asignado, RAGs creados, bindings creados, alcance construido, contradicciones resueltas.

B.2. NOMENCLATURA CANÓNICA
  Tabla con columnas: nombre_canónico | aliases_permitidos | tipo_componente | fase

B.3. CLASIFICACIÓN DE COMPONENTES
  Tabla con columnas: componente | tipo_real | requiere_rag | rags_vinculados | fase | build_now_o_roadmap

B.4. BINDINGS RAG ↔ COMPONENTE
  Tabla con columnas: rag_id | nombre_rag | componentes_consumidores | fuentes | fase

B.5. BUILD SCOPE (Fase 0+1 = buildable now)
  Lista explícita de todo lo que se construye en V1.

B.6. ROADMAP SCOPE (Fase 2+ = no ejecutable por defecto)
  Lista explícita de todo lo que NO se construye ahora.

═══ CAPA A — PRD MAESTRO (cuerpo técnico) ═══

1. Resumen Ejecutivo (máx 300 palabras, sin narrativa comercial)
2. Problema y Tesis
3. Arquitectura del Sistema (stack acotado, diagrama de componentes)
4. Diseño de Base de Datos (SQL real, entidades, relaciones)
5. APIs y Edge Functions (endpoints, inputs/outputs, triggers)
6. Integraciones (sistemas externos, conectores)
7. Seguridad y RLS (roles, permisos, políticas)
8. Inventario IA (RAGs, especialistas, motores deterministas — cada uno tipado según Capa B)
9. Patrones de Diseño
10. Workflows y Flujos Principales
11. Observabilidad y Monitorización
12. Escalabilidad
13. Riesgos y Mitigaciones

REGLA: Cada componente mencionado en la Capa A DEBE usar su nombre canónico de la Capa B y llevar su tipo entre corchetes, ej: "Motor SBA [motor_determinista]".

═══ CAPA C — ADAPTERS EMBEBIDOS ═══

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
  - Especialistas propuestos (nombre, misión, inputs, outputs, RAGs vinculados, reglas, criterios)
  - Motores deterministas (nombre, función, inputs, outputs, reglas)
  - Router Logic (tipos consultas, especialista principal, fallback, ambigüedades)
  - Soul Inputs
  - Hydration Plan
  - Frontera determinista vs probabilístico
  - Validación cruzada contra Capa B

IMPORTANTE:
- El documento debe ser técnico, preciso y sin narrativa comercial.
- Usa formato Markdown con las secciones marcadas por ═══ CAPA X ═══.
- NO inventes componentes, tecnologías ni relaciones que no estén en los inputs.
- Cada RAG debe tener binding explícito a componentes.
- Usa los markers ═══CAPA_B═══, ═══CAPA_A═══, ═══CAPA_C═══ para delimitar las capas.
`;

const buildPrdPart1Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera la CAPA B completa (Contrato de Interpretación Máquina) + Introducción (Resumen Ejecutivo + Problema + Tesis) del PRD Maestro.

Documento de alcance:
\`\`\`md
${scopeDocument}
\`\`\`

Oportunidades de IA:
\`\`\`json
${JSON.stringify(aiLeverageJson, null, 2)}
\`\`\`

Instrucciones:
- Empieza con ═══CAPA_B═══
- Genera la tabla de nomenclatura canónica analizando TODOS los componentes del proyecto.
- Clasifica cada componente como: especialista_ia | motor_determinista | modulo_orquestador | rag | conector | modulo_ui.
- Genera los bindings RAG ↔ componente explícitos.
- Define el Build Scope (Fase 0+1) y Roadmap Scope (Fase 2+).
- Incluye las 10 reglas anti-reinterpretación del contrato.
- Después, empieza ═══CAPA_A═══ con Resumen Ejecutivo, Problema y Tesis.
`;
  return buildPrompt(PRD_SYSTEM_PROMPT, task);
};

const buildPrdPart2Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera la segunda parte del PRD técnico basado en el siguiente documento de alcance y las oportunidades de IA identificadas:

Documento de alcance:
\`\`\`md
${scopeDocument}
\`\`\`

Oportunidades de IA:
\`\`\`json
${JSON.stringify(aiLeverageJson, null, 2)}
\`\`\`

Instrucciones:
- Incluye el diseño de la base de datos, las APIs y las integraciones del proyecto.
- Describe detalladamente el diagrama de la base de datos y las tablas y relaciones.
- Describe detalladamente las APIs que se utilizarán en el proyecto, incluyendo los endpoints, parámetros y respuestas.
- Describe detalladamente las integraciones con otros sistemas o servicios.
`;
  return buildPrompt(PRD_SYSTEM_PROMPT, task);
};

const buildPrdPart3Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera la tercera parte del PRD técnico basado en el siguiente documento de alcance y las oportunidades de IA identificadas:

Documento de alcance:
\`\`\`md
${scopeDocument}
\`\`\`

Oportunidades de IA:
\`\`\`json
${JSON.stringify(aiLeverageJson, null, 2)}
\`\`\`

Instrucciones:
- Incluye la seguridad, el despliegue y la monitorización del proyecto.
- Describe detalladamente las medidas de seguridad que se implementarán en el proyecto.
- Describe detalladamente el proceso de despliegue del proyecto.
- Describe detalladamente las herramientas y métricas que se utilizarán para monitorizar el proyecto.
`;
  return buildPrompt(PRD_SYSTEM_PROMPT, task);
};

const buildPrdPart4Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera la cuarta parte del PRD técnico basado en el siguiente documento de alcance y las oportunidades de IA identificadas:

Documento de alcance:
\`\`\`md
${scopeDocument}
\`\`\`

Oportunidades de IA:
\`\`\`json
${JSON.stringify(aiLeverageJson, null, 2)}
\`\`\`

Instrucciones:
- Incluye la escalabilidad, la arquitectura RAG y los patrones de diseño del proyecto.
- Describe detalladamente las estrategias de escalabilidad que se implementarán en el proyecto.
- Describe detalladamente la arquitectura RAG, incluyendo los modelos, embeddings y fuentes de datos.
- Describe detalladamente los patrones de diseño que se utilizarán en el proyecto.
`;
  return buildPrompt(PRD_SYSTEM_PROMPT, task);
};

const buildPrdPart5Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera la quinta parte del PRD técnico basado en el siguiente documento de alcance y las oportunidades de IA identificadas:

Documento de alcance:
\`\`\`md
${scopeDocument}
\`\`\`

Oportunidades de IA:
\`\`\`json
${JSON.stringify(aiLeverageJson, null, 2)}
\`\`\`

Instrucciones:
- Incluye el blueprint Lovable del proyecto.
- Describe detalladamente las instrucciones para construir el proyecto en Lovable, incluyendo los componentes, variables y relaciones.
- Utiliza las oportunidades de IA identificadas para mejorar el blueprint Lovable.
`;
  return buildPrompt(PRD_SYSTEM_PROMPT, task);
};

const buildPrdPart6Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera la sexta parte del PRD técnico basado en el siguiente documento de alcance y las oportunidades de IA identificadas:

Documento de alcance:
\`\`\`md
${scopeDocument}
\`\`\`

Oportunidades de IA:
\`\`\`json
${JSON.stringify(aiLeverageJson, null, 2)}
\`\`\`

Instrucciones:
- Revisa y corrige el PRD técnico completo.
- Asegúrate de que el documento sea claro, conciso y fácil de entender.
- Asegúrate de que el documento incluya todos los detalles necesarios para que los desarrolladores puedan construir el proyecto.
- Asegúrate de que el documento utilice un lenguaje técnico adecuado para el público objetivo.
- Asegúrate de que el documento incluya secciones específicas para RAG, patrones de diseño y blueprint Lovable.
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

const PRD_NORMALIZATION_SYSTEM_PROMPT = `Eres un arquitecto de sistemas experto en normalización de documentos técnicos. Tu misión es reestructurar un PRD monolítico en DOS documentos separados y limpios, sin inventar contenido nuevo.

REGLAS ESTRICTAS:
- NO inventes información. Solo reorganiza lo que existe.
- NO repitas contenido entre los dos documentos.
- Separa claramente lo que es MVP (P0/P1) de lo que es post-MVP.
- Las entidades/variables deben quedar en formato machine-readable.
- Los patrones se dividen en "MVP rules" y "Future rules".
- Cualquier dato que requiera fuentes externas no garantizadas debe etiquetarse con: requires_external_source, not_available_in_mvp, manual_input_fallback.
- Si algo está fuera del MVP, NO debe aparecer como core del build actual.

FORMATO DE SALIDA:
Devuelve DOS documentos separados por el delimitador exacto ===DOCUMENT_SPLIT===

El PRIMER documento es el "LOVABLE BUILD PRD" y el SEGUNDO es el "EXPERT FORGE INPUT SPEC".`;

export const buildPrdNormalizationPrompt = (fullPrd: string): { system: string; user: string } => {
  const user = `Reestructura el siguiente PRD técnico en dos documentos normalizados.

===PRD COMPLETO===
${fullPrd}
===FIN PRD===

DOCUMENTO A — LOVABLE BUILD PRD
Incluye SOLO estas secciones (en este orden):
1. Resumen Ejecutivo (máx 300 palabras)
2. Problema
3. Objetivos
4. Alcance MVP cerrado (P0 y P1 explícitos)
5. Módulos MVP — para cada uno indicar:
   - Objetivo
   - Entidades
   - Pantallas
   - Edge Functions
   - Dependencias
6. Pantallas y Rutas
7. Flujos Principales
8. Requisitos Funcionales — cada uno mapeado a: entidad, pantalla, función backend
9. Requisitos No Funcionales
10. Modelo de Datos MVP (SQL real)
11. Edge Functions MVP (lista con nombre, trigger, input/output)
12. RBAC (roles, permisos, políticas RLS)
13. QA Checklist
14. Exclusiones del MVP
15. Matriz de Trazabilidad (tabla: módulo | pantalla | entidad | edge function | fase)

ELIMINAR de este documento: Soul, RAGs, especialistas IA, router MoE, hidratación, fases futuras detalladas, especulación.

DOCUMENTO B — EXPERT FORGE INPUT SPEC
Incluye SOLO estas secciones (en este orden):
1. Knowledge Domains — lista explícita de dominios de conocimiento
2. Core Entities — entidades núcleo con relaciones
3. Proposed RAGs — para cada uno:
   - Nombre, propósito, entidades cubiertas, fuentes esperadas, tipos documentales, prioridad, criterios de calidad, restricciones
4. Proposed Specialists — para cada uno:
   - Nombre, misión, inputs, outputs, RAGs vinculados, reglas de comportamiento, reglas de abstención, criterios de éxito, cuándo NO debe responder
5. Proposed Router Logic — tipos de consultas, especialista principal, fallback, ambigüedades, casos de triaje
6. Soul Inputs — qué del PRD aporta identidad de empresa, qué documentación adicional hará falta
7. Hydration Plan — para cada RAG: fuentes públicas, fuentes privadas, criterios de frescura, criterios de exclusión, qué requiere aprobación humana
8. Deterministic vs Probabilistic Boundary — qué resuelve IA, qué resuelve motor determinista, qué requiere validación humana

ELIMINAR de este documento: SQL schemas, wireframes UI, rutas de pantalla, edge functions de CRUD, QA checklist.

Separa los dos documentos con el delimitador exacto: ===DOCUMENT_SPLIT===
No incluyas el delimitador dentro del contenido de ningún documento.`;

  return { system: PRD_NORMALIZATION_SYSTEM_PROMPT, user };
};


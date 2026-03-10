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

const PRD_SYSTEM_PROMPT = `Eres un arquitecto de software experto en diseñar la arquitectura de proyectos digitales. Tu objetivo es generar un PRD (Product Requirements Document) técnico detallado basado en el documento de alcance del proyecto y las oportunidades de IA identificadas.

Debes devolver un documento en formato Markdown con la siguiente estructura:

\`\`\`md
# PRD Técnico

## 1. Introducción
[Breve descripción del proyecto y su objetivo principal.]

## 2. Requisitos
[Lista de requisitos funcionales y no funcionales del proyecto.]

## 3. Arquitectura
[Descripción detallada de la arquitectura del sistema, incluyendo los componentes principales y su interacción.]

## 4. Diseño de la Base de Datos
[Diagrama de la base de datos y descripción de las tablas y relaciones.]

## 5. APIs
[Descripción de las APIs que se utilizarán en el proyecto, incluyendo los endpoints, parámetros y respuestas.]

## 6. Integraciones
[Descripción de las integraciones con otros sistemas o servicios.]

## 7. Seguridad
[Descripción de las medidas de seguridad que se implementarán en el proyecto.]

## 8. Despliegue
[Descripción del proceso de despliegue del proyecto.]

## 9. Monitorización
[Descripción de las herramientas y métricas que se utilizarán para monitorizar el proyecto.]

## 10. Escalabilidad
[Descripción de las estrategias de escalabilidad que se implementarán en el proyecto.]

## 11. RAG (Retrieval-Augmented Generation)
[Descripción de la arquitectura RAG, incluyendo los modelos, embeddings y fuentes de datos.]

## 12. Patrones de Diseño
[Descripción de los patrones de diseño que se utilizarán en el proyecto.]

## 13. Blueprint Lovable
[Instrucciones detalladas para construir el proyecto en Lovable, incluyendo los componentes, variables y relaciones.]
\`\`\`

IMPORTANTE:
- El documento debe ser claro, conciso y fácil de entender.
- Incluye todos los detalles necesarios para que los desarrolladores puedan construir el proyecto.
- Utiliza un lenguaje técnico adecuado para el público objetivo.
- El documento debe estar en formato Markdown.
- Incluye secciones específicas para RAG, patrones de diseño y blueprint Lovable.
`;

const buildPrdPart1Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera la primera parte del PRD técnico basado en el siguiente documento de alcance y las oportunidades de IA identificadas:

Documento de alcance:
\`\`\`md
${scopeDocument}
\`\`\`

Oportunidades de IA:
\`\`\`json
${JSON.stringify(aiLeverageJson, null, 2)}
\`\`\`

Instrucciones:
- Incluye una introducción, los requisitos y la arquitectura del proyecto.
- Describe detalladamente la arquitectura del sistema, incluyendo los componentes principales y su interacción.
- Utiliza las oportunidades de IA identificadas para mejorar la arquitectura del sistema.
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

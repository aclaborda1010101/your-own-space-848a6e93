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
14. Diseño de IA (arquitectura IA detallada, prompts, guardrails)
15. Inventario Formal de Componentes IA (COMPLETO, TODAS LAS FASES — ver regla S15)

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

═══ REGLA S15: INVENTARIO FORMAL DE COMPONENTES IA (SECCIÓN 15) ═══

PRINCIPIO: La sección 15 es el INVENTARIO COMPLETO de todos los componentes IA, motores deterministas y bases de conocimiento del proyecto EN TODAS SUS FASES, no solo los del MVP. Si un componente aparece en cualquier sección del PRD (8.1, 8.2, 10, 11, 14), DEBE estar formalizado en la sección 15.

CAMPO OBLIGATORIO — fase_implementacion:
- MVP — Se implementa en Fase 0 o 1. Tiene Edge Function definida.
- FASE_2 / FASE_3 / FASE_4 — Se implementa en fase posterior. Specs básicas pero puede no tener Edge Function definida.
- EXPLORATORIA — Mencionado en transcripciones/brief pero no confirmado. Placeholder.

REGLA DE COMPLETITUD POR FASES (CRÍTICA):
Si el Documento de Alcance o el Briefing definen funcionalidades para Fase 2, 3 o 4 que implican IA (agentes, RAGs, motores, orquestadores, módulos de aprendizaje), la sección 15 DEBE contener componentes con esas fases.
Un inventario que SOLO tiene componentes MVP cuando el proyecto tiene roadmap de fases futuras con IA es INCOMPLETO y debe corregirse.
Revisa sistemáticamente cada fase del roadmap y genera los componentes correspondientes.

REGLA DE DIFERENCIACIÓN DE AGENTES COMPLEMENTARIOS:
Si dos agentes operan sobre el mismo tipo de input (ej. emails) pero con funciones diferentes (clasificación de intención vs clasificación documental), ambos deben existir como componentes SEPARADOS con nota explicativa de por qué no son redundantes.

REGLA DE CONSISTENCIA DE MODELOS LLM:
Si el modelo LLM de un componente difiere entre secciones del PRD (ej. sección 14 dice gpt-4o-mini pero sección 15 dice gpt-4o), UNIFICAR al valor técnicamente correcto según los requisitos del componente (visión, razonamiento complejo → gpt-4o; clasificación simple → gpt-4o-mini) y documentar la decisión.

REGLA DE DERIVACIÓN DE COMPONENTES:
1. PRIMERO: Listar todos los componentes explícitos de la sección 14 (Diseño de IA).
2. SEGUNDO: Revisar sección 11 (Módulos). Cada módulo con Edge Function = al menos un componente. Lógica IA (LLM, embeddings, clasificación) = ESPECIALISTA IA. Cálculo puro (fórmulas, reglas booleanas) = MOTOR DETERMINISTA. Coordina otros = ORQUESTADOR.
3. TERCERO: Revisar sección 8.2 (Excluido de MVP). Todo con componente IA implícito → formalizar con fase_implementacion correcta.
4. CUARTO: Revisar sección 7 (Patrones de Alto Valor). Si un patrón requiere capacidades no cubiertas → componente faltante.
5. QUINTO: Revisar briefing (SOLUTION_CANDIDATES, ARCHITECTURE_SIGNALS). Candidatos no cubiertos → evaluar como EXPLORATORIA.

REGLA DE DERIVACIÓN DE RAGs:
Los RAGs se derivan de: ¿Qué TIPOS DE CONOCIMIENTO distintos necesitan los especialistas? Si dos conjuntos tienen esquemas de metadatos diferentes O frecuencias de actualización diferentes → RAGs separados.

FORMATO OBLIGATORIO DE LA SECCIÓN 15:

### 15.1 RAGs (Bases de Conocimiento)
Tabla: | ID | Nombre | Función | Fuentes | Volumen | Embedding | Chunks | Update | Edge Function | Fase |
Para CADA RAG, los siguientes campos son OBLIGATORIOS (no opcionales):
- Función: qué conocimiento provee y a quién
- Fuentes: origen exacto de los documentos
- Volumen estimado: docs y tokens
- Modelo embedding: text-embedding-3-large / text-embedding-3-small (justificar elección)
- Chunk strategy: tamaño, solapamiento, metadatos obligatorios por chunk
- Actualización: frecuencia y trigger (evento, CRON, manual)
- Edge Function: nombre de la función que vectoriza
- RAGs vinculados: IDs de especialistas/motores que lo consultan
- Fallback: qué hacer si similitud < umbral (especificar umbral)
- Métricas target: Precision@K, Latencia máxima

### 15.2 Agentes / Especialistas IA
Tabla: | ID | Nombre | Rol | Modelo LLM | Temperatura | Input | Output | Métricas | Edge Function | Trigger | Fase |
Para CADA especialista, los siguientes campos son OBLIGATORIOS:
- Rol: descripción precisa de su función
- Modelo LLM: modelo específico (justificar si requiere visión, razonamiento complejo, etc.)
- Temperatura: valor exacto con justificación
- Input: schema JSON del input esperado
- Output: schema JSON del output esperado
- Prompt base: system prompt completo o resumen sustancial
- Edge Function: nombre de la función
- Trigger: qué evento lo dispara
- RAGs vinculados: IDs explícitos de RAGs que consulta
- Guardrails: reglas de seguridad y límites
- Fallback: qué hacer si falla el LLM
- Métricas target: Precisión, Latencia, Coste por llamada

### 15.3 Motores Deterministas
Tabla: | ID | Nombre | Tipo | Inputs | Output | Fórmula/Lógica | Variables | Frecuencia | Fase |
Para CADA motor: pseudocódigo/fórmula, casos de prueba, umbrales de alertas.

### 15.4 Orquestadores (si aplica)
Tabla: | ID | Nombre | Función | Componentes coordinados | Lógica de routing | Edge Function | Trigger | Fase |
Para CADA orquestador:
- Función: qué ciclo o proceso coordina
- Componentes coordinados: IDs de todos los componentes que invoca
- Lógica de routing: máquina de estados o reglas de decisión
- Implementación: nota explícita "No requiere LLM" si es routing puro en TypeScript

### 15.5 Módulos de Aprendizaje (si aplica)
Tabla: | ID | Nombre | Función | Alimentado por | Outputs | Edge Function | Trigger | Fase |
Para CADA módulo de aprendizaje:
- Función: qué aprende y qué calibra
- Alimentado por: RAGs e IDs de datos que lo nutren
- Outputs: métricas o insights que genera
- Dependencias: volumen mínimo de datos para generar insights significativos
- Implementación: combinación de SQL agregado + LLM (especificar modelo y temperatura)

### 15.6 Mapa de Interconexiones
Diagrama Mermaid de TODOS los componentes (15.1-15.5) y sus dependencias. Fases futuras en gris/punteado.

### 15.7 Resumen de Infraestructura IA
Tabla resumen con columnas por fase:
| Métrica | MVP (Fase 0-1) | Fase 2 | Fase 3 | Fase 4 | Total |
Filas obligatorias: Total RAGs, Total Agentes IA, Total Motores Deterministas, Total Orquestadores, Total Módulos Aprendizaje, Total componentes, Coste IA mensual estimado, Edge Functions nuevas, Secrets adicionales.

VALIDACIONES POST-GENERACIÓN DE SECCIÓN 15:
V-S15-01: ¿Cada módulo de sección 11 con Edge Function tiene componente en sección 15? Si no → AÑADIR.
V-S15-02: ¿Cada item de sección 8.2 que implica IA aparece en sección 15 con fase correcta? Si no → AÑADIR.
V-S15-03: ¿Cada patrón de sección 7 que requiere datos IA tiene componente en sección 15? Si no → WARNING.
V-S15-04: ¿La suma de 15.7 coincide con conteo real de 15.1-15.5? Si no → CORREGIR.
V-S15-05: ¿Algún especialista tiene mismo modelo Y temperatura que otro? Si sí → VERIFICAR y justificar.
V-S15-06: ¿Algún motor determinista tiene modelo LLM? Si sí → ERROR. Motores deterministas NO usan LLM.
V-S15-07: ¿Cada especialista lista qué RAGs consulta? Si no → AÑADIR RAGs vinculados con IDs.
V-S15-08: ¿Hay fases futuras en el Documento de Alcance con componentes IA implícitos que NO aparecen en la sección 15? Si sí → ERROR. Añadir con fase correcta. Un inventario solo-MVP en un proyecto multi-fase es incompleto.

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
  const task = `Genera las secciones 7-9 y 14-15 de la CAPA A del PRD Maestro: Seguridad/RLS, Inventario IA, Patrones de Diseño, Diseño de IA detallado e Inventario Formal de Componentes IA (Sección 15).

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
- Inventario IA (sección 8): tabla completa de RAGs (con bindings), especialistas IA, motores deterministas. Cada uno tipado según Capa B.
- Patrones de diseño aplicados al proyecto, separando MVP de roadmap.
- Diseño de IA (sección 14): arquitectura IA detallada, prompts, guardrails, lógica de routing.

CRÍTICO — SECCIÓN 15 (Inventario Formal de Componentes IA):
Aplica la REGLA S15 del system prompt. La sección 15 es el INVENTARIO COMPLETO de TODAS las fases, no solo MVP.

Proceso de derivación obligatorio:
1. Listar TODOS los componentes de la sección 14 (Diseño de IA).
2. Revisar TODOS los módulos de la sección 11 — cada Edge Function implica un componente.
3. Revisar TODOS los items excluidos del MVP (sección 8.2) — formalizar con fase correcta.
4. Revisar patrones de alto valor (sección 7) — si un patrón requiere IA no cubierta, añadir componente.
5. Revisar briefing (SOLUTION_CANDIDATES, ARCHITECTURE_SIGNALS) — candidatos no cubiertos como EXPLORATORIA.

Cada componente DEBE incluir campo fase_implementacion: MVP | FASE_2 | FASE_3 | FASE_4 | EXPLORATORIA.

Generar las 6 subsecciones obligatorias: 15.1 RAGs, 15.2 Especialistas IA, 15.3 Motores Deterministas, 15.4 Orquestadores, 15.5 Mapa Interconexiones (Mermaid), 15.6 Resumen Infraestructura IA.

Al final, ejecutar las 7 validaciones V-S15-01 a V-S15-07 y corregir cualquier gap detectado.
`;
  return buildPrompt(PRD_SYSTEM_PROMPT, task);
};

const buildPrdPart4Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera las secciones 10-13 de la CAPA A del PRD Maestro: Workflows, Observabilidad, Escalabilidad y Riesgos.

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
- Observabilidad: métricas, alertas, logging.
- Escalabilidad: estrategias concretas.
- Riesgos con plan de mitigación.
- Usa nombres canónicos de la Capa B.
`;
  return buildPrompt(PRD_SYSTEM_PROMPT, task);
};

const buildPrdPart5Prompt = (scopeDocument: string, aiLeverageJson: any) => {
  const task = `Genera la CAPA C.1 — LOVABLE BUILD ADAPTER del PRD Maestro.

Documento de alcance:
\`\`\`md
${scopeDocument}
\`\`\`

Oportunidades de IA:
\`\`\`json
${JSON.stringify(aiLeverageJson, null, 2)}
\`\`\`

Instrucciones:
- Empieza con ═══CAPA_C═══ y luego ## C.1. LOVABLE BUILD ADAPTER
- Acotado ESTRICTAMENTE a Fase 0+1 (Build Scope de Capa B).
- Módulos MVP con: objetivo, entidades, pantallas, edge functions, dependencias.
- Rutas y navegación completas.
- Modelo de datos SQL real (solo tablas del MVP).
- RBAC y RLS concretos.
- QA Checklist.
- Exclusiones explícitas del MVP.
- Matriz de trazabilidad: módulo | pantalla | entidad | edge_function | fase.
- NO incluir: router MoE, Soul, hidratación, fases futuras detalladas.

═══ TABLA INVENTARIO IA (RESUMEN MVP) — OBLIGATORIO ═══
Incluir una tabla "Inventario IA (Resumen MVP)" con TODOS los componentes de la sección 15 que tienen fase MVP.
Columnas: | ID | Nombre | Tipo | Rol | Modelo LLM | Fase |
Tipo puede ser: RAG, Especialista IA, Motor Determinista, Orquestador.
Para motores deterministas sin LLM, poner "— (TypeScript puro)" o "— (SQL + reglas)" en la columna Modelo LLM.

Al final de la tabla, añadir nota: "Los componentes de fases posteriores (Fase 2-4) están documentados en la sección 15 del PRD completo pero NO se implementan en este Blueprint del MVP."
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


// ── Project Pipeline Prompts — Afinados V10 ─────────────────────────────────
// Todas las fases (2-9) con system prompts, user prompts y configuración

export const STEP_NAMES = [
  "Entrada del Proyecto",        // 0 → step 1
  "Extracción Inteligente",      // 1 → step 2
  "Documento de Alcance",        // 2 → step 3
  "Auditoría Cruzada",           // 3 → step 4
  "Documento Final",             // 4 → step 5
  "AI Leverage",                 // 5 → step 6
  "PRD Técnico",                 // 6 → step 7
  "Generación de RAGs",          // 7 → step 8
  "Detección de Patrones",       // 8 → step 9
] as const;

export const STEP_MODELS: Record<number, string> = {
  2: "gemini-flash",       // Extracción → Gemini 2.5 Flash
  3: "claude-sonnet",      // Documento de Alcance → Claude Sonnet 4
  4: "gemini-flash",       // Auditoría Cruzada → Gemini 2.5 Flash
  5: "claude-sonnet",      // Documento Final → Claude Sonnet 4
  6: "gemini-flash",       // AI Leverage → Gemini 2.5 Flash
  7: "claude-sonnet",      // PRD Técnico → Claude Sonnet 4
  8: "claude-sonnet",      // Generación de RAGs → Claude Sonnet 4
  9: "claude-sonnet",      // Detección de Patrones → Claude Sonnet 4
};

// ── FASE 2: Extracción Inteligente ─────────────────────────────────────────
// Modelo: Gemini 2.5 Flash
// Config: temperature: 0.2, maxOutputTokens: 16384, responseMimeType: "application/json"

export const EXTRACTION_SYSTEM_PROMPT = `Eres un analista senior de proyectos tecnológicos con 15 años de experiencia en consultoría. Tu trabajo es extraer TODA la información relevante de una transcripción, reunión o documento y convertirla en un briefing estructurado que permita a un equipo de desarrollo comenzar a trabajar sin necesidad de leer el material original.

REGLAS CRÍTICAS:
- NUNCA inventes información que no esté en el input. Si algo no está claro, márcalo como "[PENDIENTE DE CONFIRMAR]".
- EXTRAE TODOS los datos cuantitativos: cifras, porcentajes, cantidades, plazos, precios, dimensiones de equipo, número de usuarios/vehículos/empleados.
- PRIORIZA usando P0 (crítico para MVP), P1 (importante post-MVP), P2 (deseable futuro).
- IDENTIFICA decisiones ya tomadas vs. opciones abiertas. Las decisiones confirmadas son hechos, no sugerencias.
- CAPTURA el contexto comercial: expectativas de precio del cliente, señales de urgencia, riesgos de relación.
- Los stakeholders no son solo nombres y roles — incluye qué dolor específico sufre cada uno y qué poder de decisión tiene.
- Usa el idioma del input.
- Responde SOLO con JSON válido. Sin explicaciones, sin markdown, sin backticks.`;

export const buildExtractionPrompt = (params: {
  projectName: string;
  companyName: string;
  projectType: string;
  clientNeed: string | null;
  inputContent: string;
}) => `INPUT DEL USUARIO:
Nombre del proyecto: ${params.projectName}
Empresa cliente: ${params.companyName}
Tipo de proyecto: ${params.projectType}
Necesidad declarada por el cliente: ${params.clientNeed || "No proporcionada — extraer del material"}

Material de entrada:
${params.inputContent}

GENERA UN BRIEFING CON ESTA ESTRUCTURA EXACTA (JSON):
{
  "resumen_ejecutivo": "3-5 frases que capturan: qué empresa es, qué problema tiene, qué solución se plantea, y cuál es la magnitud (usuarios, vehículos, sedes, etc.)",
  "cliente": {
    "empresa": "nombre legal si aparece",
    "nombre_comercial": "nombre de uso si difiere",
    "sector": "sector específico",
    "tamaño": "nº empleados/vehículos/sedes u otro indicador",
    "ubicaciones": ["sede 1", "sede 2"],
    "contexto_operativo": "cómo opera actualmente en 2-3 frases",
    "contexto_comercial": "expectativas de precio, urgencia percibida, señales de compromiso o duda"
  },
  "necesidad_principal": "la necesidad core en 2-3 frases, con datos cuantitativos si existen",
  "objetivos": [
    {
      "objetivo": "descripción",
      "prioridad": "P0/P1/P2",
      "métrica_éxito": "cómo se mide si aplica"
    }
  ],
  "problemas_detectados": [
    {
      "problema": "descripción con datos concretos",
      "gravedad": "alta/media/baja",
      "impacto": "a quién afecta y cómo"
    }
  ],
  "decisiones_confirmadas": [
    {
      "decisión": "qué se decidió",
      "contexto": "por qué",
      "implicación_técnica": "qué significa para el desarrollo"
    }
  ],
  "decisiones_pendientes": [
    {
      "tema": "qué hay que decidir",
      "opciones": ["opción A", "opción B"],
      "dependencia": "qué bloquea"
    }
  ],
  "alcance_preliminar": {
    "incluido": [
      {
        "funcionalidad": "descripción",
        "prioridad": "P0/P1/P2",
        "módulo": "nombre del módulo al que pertenece"
      }
    ],
    "excluido": [
      {
        "funcionalidad": "descripción",
        "motivo": "por qué se excluye"
      }
    ],
    "supuestos": ["supuesto 1 con contexto"]
  },
  "stakeholders": [
    {
      "nombre": "nombre completo o identificador",
      "rol": "rol en la empresa",
      "tipo": "decisor/usuario_clave/técnico/financiero",
      "dolor_principal": "qué problema específico sufre esta persona",
      "poder_decisión": "alto/medio/bajo",
      "notas": "cualquier detalle relevante sobre esta persona"
    }
  ],
  "datos_cuantitativos": {
    "cifras_clave": [
      {"descripción": "dato", "valor": "número/rango", "fuente": "quién lo dijo o de dónde sale"}
    ],
    "presupuesto_cliente": "lo que el cliente ha mencionado o se intuye",
    "estimación_proveedor": "lo que se ha estimado por parte del ejecutor"
  },
  "restricciones": ["restricción técnica, temporal o presupuestaria con detalle"],
  "datos_faltantes": [
    {"qué_falta": "dato", "impacto": "qué bloquea si no se obtiene", "responsable": "quién debe proporcionarlo"}
  ],
  "alertas": [
    {"descripción": "alerta", "gravedad": "alta/media/baja", "acción_sugerida": "qué hacer"}
  ],
  "integraciones_identificadas": [
    {"nombre": "sistema", "tipo": "API/manual/por definir", "estado": "confirmado/por evaluar", "notas": "detalles"}
  ],
  "nivel_complejidad": "bajo/medio/alto/muy alto",
  "urgencia": "baja/media/alta/crítica",
  "confianza_extracción": "alta/media/baja — indica cuánto del input era claro vs ambiguo"
}`;

// ── FASE 3: Documento de Alcance ───────────────────────────────────────────
// Modelo: Claude Sonnet 4
// Config: max_tokens: 16384, temperature: 0.4

export const SCOPE_SYSTEM_PROMPT = `Eres un director de proyectos senior de una consultora tecnológica premium. Generas documentos de alcance que se presentan directamente a comités de dirección y que sirven como base contractual.

ESTILO Y FORMATO:
- Profesional, preciso y accionable. Cada sección debe aportar valor, no relleno.
- Cuantifica SIEMPRE: plazos en semanas, costes en rangos, recursos necesarios, métricas de éxito.
- Las recomendaciones deben ser concretas y justificadas, nunca genéricas.
- Vincula SIEMPRE el cronograma con los costes: cada fase tiene tiempo Y coste asociado.
- Prioriza usando P0/P1/P2 heredados del briefing.
- Si detectas inconsistencias o riesgos no mencionados en el briefing, señálalos en la sección de riesgos.
- Idioma: español (España).
- Formato: Markdown con estructura clara.
- NO uses frases vacías tipo "se estudiará", "se analizará oportunamente". Sé específico.

REGLA DE ORO: Un lector debe poder entender el proyecto completo, su coste, sus fases y sus riesgos leyendo SOLO este documento.`;

export const buildScopePrompt = (params: {
  briefingJson: string;
  contactName: string;
  currentDate: string;
}) => `BRIEFING APROBADO DEL PROYECTO:
${params.briefingJson}

DATOS DE CONTEXTO:
- Empresa ejecutora: Agustito (consultora tecnológica y marketing digital)
- Responsable del proyecto: Agustín Cifuentes
- Contacto cliente: ${params.contactName}
- Fecha: ${params.currentDate}

GENERA UN DOCUMENTO DE ALCANCE COMPLETO EN MARKDOWN con estas secciones:

# 1. PORTADA
Nombre del proyecto, cliente, ejecutor, fecha, versión, confidencialidad.

# 2. RESUMEN EJECUTIVO
3-5 párrafos: contexto del cliente, problema, solución propuesta, magnitud y beneficio esperado. Un directivo debe entender todo el proyecto leyendo solo esto.

# 3. OBJETIVOS DEL PROYECTO
| Objetivo | Prioridad (P0/P1/P2) | Métrica de éxito | Plazo estimado |

# 4. STAKEHOLDERS Y RESPONSABILIDADES
| Nombre | Rol | Responsabilidad en el proyecto | Poder de decisión |

# 5. ALCANCE DETALLADO
## 5.1 Módulos y funcionalidades
| Módulo | Funcionalidades clave | Prioridad | Fase |
## 5.2 Arquitectura técnica
Descripción de capas: frontend, backend, integraciones, IA
## 5.3 Integraciones
| Sistema | Tipo | Estado | Riesgo |
## 5.4 Exclusiones explícitas
Con motivo de cada exclusión
## 5.5 Supuestos y dependencias

# 6. PLAN DE IMPLEMENTACIÓN POR FASES
Para CADA fase:
- Nombre y descripción
- Duración estimada en semanas
- Módulos/entregables incluidos
- Dependencias de fases anteriores
- Criterios de aceptación
Incluir diagrama de fases (en texto/ASCII si es necesario).

# 7. INVERSIÓN Y ESTRUCTURA DE COSTES
## 7.1 Inversión por fase
| Fase | Alcance | Duración | Rango de inversión |
## 7.2 Costes recurrentes mensuales
hosting, APIs, licencias, mantenimiento
## 7.3 Comparativa con alternativas de mercado (si aplica)
## 7.4 Nota: Los rangos se concretarán tras validación de variables pendientes.

# 8. ANÁLISIS DE RIESGOS
| Riesgo | Probabilidad | Impacto | Mitigación | Responsable |

# 9. DATOS PENDIENTES Y BLOQUEOS
| Dato faltante | Impacto si no se obtiene | Responsable | Fecha límite sugerida |

# 10. DECISIONES TÉCNICAS CONFIRMADAS
Lista de decisiones ya tomadas que condicionan el desarrollo (heredadas del briefing).

# 11. PRÓXIMOS PASOS
| Acción | Responsable | Fecha Límite |

# 12. CONDICIONES Y ACEPTACIÓN
Validez de la propuesta, condiciones de cambio de alcance, firma.`;

// ── FASE 4: Auditoría Cruzada ──────────────────────────────────────────────
// Modelo: Gemini 2.5 Flash
// Config: temperature: 0.2, maxOutputTokens: 16384, responseMimeType: "application/json"

export const AUDIT_SYSTEM_PROMPT = `Eres un auditor de calidad de proyectos tecnológicos. Tu trabajo es comparar un documento de alcance generado contra el material fuente original y detectar TODAS las discrepancias, omisiones o inconsistencias.

REGLAS:
- Sé exhaustivo y metódico. Revisa sección por sección.
- Distingue entre: OMISIÓN (dato del original que falta en el alcance), INCONSISTENCIA (dato que contradice el original), RIESGO NO CUBIERTO (situación del original sin mitigación en el alcance), MEJORA (sugerencia de mejora que no es un error).
- Prioriza los hallazgos: CRÍTICO (bloquea el proyecto), IMPORTANTE (afecta calidad), MENOR (mejora deseable).
- No generes falsos positivos. Si algo se simplificó correctamente, no lo marques como omisión.
- Responde SOLO con JSON válido.`;

export const buildAuditPrompt = (params: {
  originalInput: string;
  briefingJson: string;
  scopeDocument: string;
}) => `MATERIAL FUENTE ORIGINAL:
${params.originalInput}

BRIEFING EXTRAÍDO (Fase 2):
${params.briefingJson}

DOCUMENTO DE ALCANCE GENERADO (Fase 3):
${params.scopeDocument}

Realiza una auditoría cruzada y genera el siguiente JSON:
{
  "puntuación_global": 0-100,
  "resumen_auditoría": "2-3 frases con la evaluación general",
  "hallazgos": [
    {
      "tipo": "OMISIÓN/INCONSISTENCIA/RIESGO_NO_CUBIERTO/MEJORA",
      "severidad": "CRÍTICO/IMPORTANTE/MENOR",
      "sección_afectada": "sección del documento de alcance",
      "descripción": "qué se encontró",
      "dato_original": "la referencia exacta del material fuente",
      "acción_requerida": "qué hay que corregir o añadir",
      "impacto_si_no_se_corrige": "qué pasa si se ignora"
    }
  ],
  "secciones_evaluadas": [
    {"sección": "nombre", "puntuación": 0-100, "notas": "comentario breve"}
  ],
  "datos_original_no_usados": ["dato o detalle del material fuente que no aparece en ninguna parte del documento de alcance"],
  "recomendación": "APROBAR / APROBAR CON CORRECCIONES / RECHAZAR Y REGENERAR"
}`;

// ── FASE 5: Documento Final ────────────────────────────────────────────────
// Modelo: Claude Sonnet 4
// Config: max_tokens: 16384, temperature: 0.4

export const FINAL_DOC_SYSTEM_PROMPT = `Eres un director de proyectos senior. Se te proporciona un documento de alcance y el resultado de una auditoría de calidad. Tu trabajo es generar la VERSIÓN FINAL del documento incorporando TODAS las correcciones marcadas como CRÍTICO e IMPORTANTE, y las MENOR cuando sea fácil.

REGLAS:
- Mantén la estructura y estilo del documento original.
- Incorpora CADA hallazgo de la auditoría de forma natural en el documento.
- No añadas una sección de "correcciones aplicadas" — el documento final debe leerse como si siempre hubiera sido correcto.
- Si un hallazgo requiere información que no tienes, marca como [PENDIENTE: descripción].
- Al final, añade un changelog interno (solo para uso del equipo, no para el cliente) listando qué se cambió.`;

export const buildFinalDocPrompt = (params: {
  scopeDocument: string;
  auditJson: string;
  briefingJson: string;
}) => `DOCUMENTO DE ALCANCE (versión anterior):
${params.scopeDocument}

RESULTADO DE AUDITORÍA:
${params.auditJson}

BRIEFING ORIGINAL:
${params.briefingJson}

Genera la VERSIÓN FINAL del documento de alcance en Markdown, incorporando todas las correcciones de la auditoría.

Al final del documento, después de una línea separadora (---), incluye:

## CHANGELOG INTERNO (no incluir en entrega al cliente)
| Hallazgo | Severidad | Acción tomada |
| --- | --- | --- |
| ... | ... | ... |`;

// ── FASE 6: AI Leverage ────────────────────────────────────────────────────
// Modelo: Gemini 2.5 Flash
// Config: temperature: 0.3, maxOutputTokens: 16384, responseMimeType: "application/json"

export const AI_LEVERAGE_SYSTEM_PROMPT = `Eres un arquitecto de soluciones de IA con experiencia en implementaciones prácticas (no teóricas). Tu trabajo es analizar un proyecto y proponer EXACTAMENTE dónde y cómo la IA aporta valor real, con estimaciones concretas.

REGLAS:
- Solo propón IA donde realmente aporte valor sobre una solución no-IA. Si una regla de negocio simple resuelve el problema, di eso.
- Para cada oportunidad: modelo recomendado, coste estimado de API, precisión esperada, datos necesarios para entrenar/ajustar.
- Distingue entre: IA que puedes implementar HOY con APIs existentes vs. IA que requiere desarrollo/entrenamiento custom.
- Incluye Quick Wins (impacto alto, esfuerzo bajo) y marca cuáles son candidatas a MVP.
- Estima el ROI cuando sea posible: "esto ahorra X horas/semana que cuestan Y€".`;

export const buildAiLeveragePrompt = (params: {
  finalDocument: string;
  briefingJson: string;
}) => `DOCUMENTO DE ALCANCE FINAL:
${params.finalDocument}

BRIEFING DEL PROYECTO:
${params.briefingJson}

Genera un análisis de oportunidades de IA con esta estructura JSON:
{
  "resumen": "valoración general del potencial de IA en este proyecto en 2-3 frases",
  "oportunidades": [
    {
      "id": "AI-001",
      "nombre": "nombre descriptivo corto",
      "módulo_afectado": "módulo del proyecto",
      "descripción": "qué hace y por qué aporta valor",
      "tipo": "API_EXISTENTE / MODELO_CUSTOM / REGLA_NEGOCIO_MEJOR",
      "modelo_recomendado": "GPT-4o-mini / Claude Haiku / Tesseract+custom / etc.",
      "coste_api_estimado": "€/mes basado en volumen estimado",
      "precisión_esperada": "% con justificación",
      "datos_necesarios": "qué datos hacen falta para funcionar",
      "esfuerzo_implementación": "bajo/medio/alto con horas estimadas",
      "impacto_negocio": "qué resuelve cuantitativamente",
      "roi_estimado": "ahorro o ganancia vs coste",
      "es_mvp": true,
      "dependencias": "qué necesita estar listo antes"
    }
  ],
  "quick_wins": ["AI-001", "AI-003"],
  "requiere_datos_previos": ["AI-005"],
  "stack_ia_recomendado": {
    "ocr": "solución recomendada y por qué",
    "nlp": "si aplica",
    "visión": "si aplica",
    "analytics": "si aplica"
  },
  "coste_ia_total_mensual_estimado": "rango €/mes",
  "nota_implementación": "consideraciones prácticas en 2-3 frases"
}`;

// ── FASE 7: PRD Técnico ────────────────────────────────────────────────────
// Modelo: Claude Sonnet 4
// Config: max_tokens: 16384, temperature: 0.4

export const PRD_SYSTEM_PROMPT = `Eres un Product Manager técnico senior. Generas PRDs que los equipos de desarrollo usan directamente como fuente de verdad para implementar. Tu PRD debe ser suficiente para que un desarrollador que no asistió a ninguna reunión pueda construir el sistema.

ESTILO:
- Técnicamente preciso pero no innecesariamente verboso.
- Cada funcionalidad tiene criterios de aceptación claros y testeables.
- Los flujos de usuario son paso a paso, sin ambigüedad.
- La arquitectura es concreta: tecnologías, endpoints, esquemas de datos.
- Priorización P0/P1/P2 en CADA feature.
- Incluye edge cases y manejo de errores.
- Idioma: español (España).`;

export const buildPrdPrompt = (params: {
  finalDocument: string;
  aiLeverageJson: string;
  briefingJson: string;
}) => `DOCUMENTO DE ALCANCE FINAL:
${params.finalDocument}

ANÁLISIS DE AI LEVERAGE:
${params.aiLeverageJson}

BRIEFING:
${params.briefingJson}

GENERA UN PRD TÉCNICO COMPLETO EN MARKDOWN:

# 1. VISIÓN DEL PRODUCTO
Resumen en 1 párrafo. Problema → Solución → Impacto.

# 2. USUARIOS Y PERSONAS
Para cada tipo de usuario: perfil, contexto de uso, nivel técnico, dispositivos, frecuencia de uso, dolor principal.

# 3. ARQUITECTURA TÉCNICA
## 3.1 Stack tecnológico (frontend, backend, DB, hosting, APIs)
## 3.2 Diagrama de arquitectura (ASCII o Mermaid)
## 3.3 Modelo de datos (entidades principales con campos clave)
## 3.4 Integraciones (endpoint, auth, rate limits, fallbacks)

# 4. FUNCIONALIDADES POR MÓDULO
Para CADA módulo:
## Módulo X: [Nombre]
- Prioridad: P0/P1/P2
- Fase: en qué fase se implementa
- Descripción: qué hace
- Flujo de usuario: paso a paso numerado
- Criterios de aceptación: lista verificable (DADO/CUANDO/ENTONCES)
- Campos de datos: | Campo | Tipo | Obligatorio | Validación |
- Edge cases: qué pasa si falla X, si el usuario hace Y
- Dependencias: qué módulos necesita

# 5. DISEÑO DE IA
Para cada componente de IA (del AI Leverage):
- Modelo y proveedor
- Input esperado y output
- Prompt base o lógica de procesamiento
- Fallback si la IA falla
- Métricas de calidad
- Coste por operación

# 6. API DESIGN
Endpoints principales: método, ruta, params, body, response, auth, errores.

# 7. PLAN DE TESTING
Tipos de test por módulo, criterios de calidad, escenarios de aceptación del cliente.

# 8. MÉTRICAS DE ÉXITO
KPIs técnicos (uptime, latencia, precisión IA) y de negocio (adopción, reducción de tiempo manual).

# 9. ROADMAP DE IMPLEMENTACIÓN
| Sprint/Fase | Módulos | Duración | Entregable | Criterio de aceptación |`;

// ── FASE 8: Generación de RAGs ─────────────────────────────────────────────
// Modelo: Claude Sonnet 4
// Config: max_tokens: 8192, temperature: 0.3

export const RAG_GEN_SYSTEM_PROMPT = `Eres un ingeniero de RAG (Retrieval Augmented Generation) especializado en construir bases de conocimiento para asistentes de IA de proyectos. Tu trabajo es tomar toda la documentación de un proyecto y organizarla en chunks semánticos óptimos para retrieval.

REGLAS:
- Cada chunk debe ser autocontenido: un desarrollador que lea SOLO ese chunk debe entender lo que describe sin necesidad de contexto adicional.
- Tamaño óptimo: 200-500 tokens por chunk.
- Metadata rica: tags, módulo, fase, tipo de información, prioridad.
- Incluye chunks de FAQ anticipadas: preguntas que el equipo probablemente hará.
- Incluye chunks de decisiones técnicas con su contexto (por qué se decidió X y no Y).
- Responde SOLO con JSON válido.`;

export const buildRagGenPrompt = (params: {
  projectName: string;
  prdDocument: string;
  finalDocument: string;
  briefingJson: string;
  aiLeverageJson: string;
}) => `DOCUMENTACIÓN COMPLETA DEL PROYECTO:

PRD Técnico:
${params.prdDocument}

Documento de Alcance:
${params.finalDocument}

Briefing:
${params.briefingJson}

AI Leverage:
${params.aiLeverageJson}

Genera la estructura RAG con este formato JSON:
{
  "proyecto": "${params.projectName}",
  "total_chunks": número,
  "categorías": ["arquitectura", "funcionalidad", "decisión", "integración", "faq", "proceso", "dato_clave"],
  "chunks": [
    {
      "id": "CHK-001",
      "categoría": "funcionalidad",
      "módulo": "nombre del módulo",
      "fase": "Fase X",
      "prioridad": "P0/P1/P2",
      "título": "título descriptivo corto",
      "contenido": "texto autocontenido de 200-500 tokens que describe completamente este aspecto",
      "tags": ["tag1", "tag2", "tag3"],
      "preguntas_relacionadas": ["¿cómo funciona X?", "¿qué pasa si Y?"],
      "dependencias": ["CHK-003", "CHK-015"],
      "fuente": "PRD sección 4.2 / Briefing / Reunión original"
    }
  ],
  "faqs_generadas": [
    {
      "pregunta": "pregunta anticipada",
      "respuesta": "respuesta basada en la documentación",
      "chunks_relacionados": ["CHK-001", "CHK-005"]
    }
  ],
  "embeddings_config": {
    "modelo_recomendado": "text-embedding-3-small / voyage-3-lite / etc.",
    "dimensiones": número,
    "chunk_overlap": número_tokens,
    "separador_recomendado": "descripción de estrategia de splitting"
  }
}`;

// ── FASE 9: Detección de Patrones ──────────────────────────────────────────
// Modelo: Claude Sonnet 4
// Config: max_tokens: 8192, temperature: 0.5

export const PATTERNS_SYSTEM_PROMPT = `Eres un analista de negocio senior especializado en detectar patrones recurrentes en proyectos tecnológicos. Tu análisis tiene dos objetivos: (1) identificar componentes reutilizables que aceleren futuros proyectos similares, y (2) detectar oportunidades comerciales (upselling, cross-selling, servicios recurrentes) que surgen naturalmente del proyecto.

REGLAS:
- Los patrones deben ser CONCRETOS y ACCIONABLES, no observaciones genéricas.
- Las oportunidades comerciales deben tener una estimación de valor.
- Identifica qué partes del proyecto pueden convertirse en producto/plantilla reutilizable.
- Detecta señales de necesidades futuras del cliente que aún no ha expresado.
- Responde SOLO con JSON válido.`;

export const buildPatternsPrompt = (params: {
  briefingJson: string;
  finalDocument: string;
  prdDocument: string;
  aiLeverageJson: string;
  previousProjectsSummary?: string;
}) => `DOCUMENTACIÓN COMPLETA:
Briefing: ${params.briefingJson}
Documento de Alcance: ${params.finalDocument}
PRD Técnico: ${params.prdDocument}
AI Leverage: ${params.aiLeverageJson}

CONTEXTO DE LA AGENCIA:
- Nombre: Agustito
- Servicios: Desarrollo tecnológico, marketing digital, consultoría IA
- Proyectos previos relevantes: ${params.previousProjectsSummary || "No disponible"}

Genera análisis de patrones con este formato JSON:
{
  "resumen": "valoración general en 2-3 frases",
  "patrones_técnicos": [
    {
      "id": "PAT-001",
      "patrón": "nombre descriptivo",
      "descripción": "qué patrón se detecta",
      "reutilizable": true,
      "componente_extraíble": "qué se puede convertir en plantilla/módulo",
      "proyectos_aplicables": "tipos de proyectos donde aplica",
      "ahorro_estimado": "horas/€ que ahorraría en futuros proyectos"
    }
  ],
  "oportunidades_comerciales": [
    {
      "id": "OPP-001",
      "oportunidad": "descripción",
      "tipo": "UPSELL / CROSS_SELL / SERVICIO_RECURRENTE / NUEVO_PROYECTO",
      "timing": "cuándo proponerlo (qué fase o evento lo activa)",
      "valor_estimado": "€/mes o €/proyecto",
      "probabilidad": "alta/media/baja",
      "pitch_sugerido": "cómo proponerlo al cliente en 1-2 frases"
    }
  ],
  "señales_necesidades_futuras": [
    {
      "señal": "qué dijo o hizo el cliente que indica necesidad futura",
      "necesidad_inferida": "qué necesitará",
      "cuándo": "estimación temporal",
      "acción": "qué hacer ahora para posicionarse"
    }
  ],
  "aprendizajes_proceso": [
    {
      "aprendizaje": "qué se aprendió de este proyecto",
      "aplicable_a": "procesos internos / futuros proyectos / pipeline",
      "acción_sugerida": "qué cambiar o documentar"
    }
  ],
  "score_cliente": {
    "potencial_recurrencia": "alto/medio/bajo",
    "potencial_referidos": "alto/medio/bajo",
    "complejidad_relación": "alta/media/baja",
    "lifetime_value_estimado": "rango €",
    "siguiente_contacto_recomendado": "fecha y motivo"
  }
}`;

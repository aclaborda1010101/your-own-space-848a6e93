// ── Project Pipeline Prompts — V11 LOVABLE-READY ────────────────────────────
// Todas las fases (2-9) con system prompts, user prompts y configuración
// CAMBIOS V11:
//   - Fase 7 (PRD): Reescrito completo → 15 secciones + Blueprint Lovable + Specs D1/D2
//   - Modelo PRD: Gemini 3.1 Pro (principal) / Claude Sonnet (fallback)
//   - PRD split: 4 calls generativas + 1 call de validación cruzada
//   - Stack forzado: React + Vite + Supabase (sin Next.js/Express/AWS)
//   - Output: Markdown plano, no JSON anidado

export const STEP_NAMES = [
  "Entrada del Proyecto",        // 0 → step 1
  "Extracción Inteligente",      // 1 → step 2
  "Documento de Alcance",        // 2 → step 3
  "Auditoría Cruzada",           // 3 → step 4
  "Documento Final",             // 4 → step 5
  "Auditoría IA",                // 5 → step 6
  "PRD Técnico",                 // 6 → step 7
  "Blueprint de Patrones",       // 7 → step 8
  "RAG Dirigido",                // 8 → step 9
  "Ejecución de Patrones",       // 9 → step 10
] as const;

export const STEP_MODELS: Record<number, string> = {
  2: "gemini-flash",       // Extracción → Gemini 2.5 Flash
  3: "claude-sonnet",      // Documento de Alcance → Claude Sonnet 4
  4: "claude-sonnet",      // Auditoría Cruzada → Claude Sonnet 4
  5: "claude-sonnet",      // Documento Final → Claude Sonnet 4
  6: "claude-sonnet",      // AI Leverage → Claude Sonnet 4
  7: "gemini-pro",         // PRD Técnico → Gemini 3.1 Pro (fallback: Claude Sonnet)
  8: "claude-sonnet",      // Blueprint de Patrones → Claude Sonnet 4
  9: "claude-sonnet",      // RAG Dirigido → Claude Sonnet 4
  10: "claude-sonnet",     // Ejecución de Patrones → Claude Sonnet 4
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
- Empresa ejecutora: ManIAS Lab. (consultora tecnológica, IA y marketing digital)
- Responsable del proyecto: Agustín Cifuentes
- Contacto cliente: ${params.contactName}
- Fecha: ${params.currentDate}

IMPORTANTE — BLOQUE JSON DE RESUMEN EJECUTIVO:
Antes de empezar el markdown, genera un bloque JSON envuelto en comentarios HTML con los KPIs clave del proyecto. Este bloque será parseado automáticamente por el generador DOCX para crear una página visual de resumen ejecutivo con KPIs destacados.

Formato EXACTO (respeta los comentarios HTML):
<!--EXEC_SUMMARY_JSON-->
{
  "kpis": [
    {"value": "VALOR_NUMERICO", "label": "descripción corta"},
    {"value": "VALOR_NUMERICO", "label": "descripción corta"},
    {"value": "VALOR_NUMERICO", "label": "descripción corta"},
    {"value": "VALOR_NUMERICO", "label": "descripción corta"}
  ],
  "total_investment": "RANGO_INVERSION",
  "roi_estimate": "ESTIMACION_ROI",
  "phases": [
    {"name": "Fase 0 (PoC)", "cost": "RANGO", "duration": "X sem", "weight": 0.2},
    {"name": "Fase 1 (MVP)", "cost": "RANGO", "duration": "X sem", "weight": 0.6}
  ]
}
<!--/EXEC_SUMMARY_JSON-->

Extrae los KPIs del contexto del cliente: métricas de negocio relevantes (operaciones, volumen, margen, etc.). Las fases deben coincidir con las del plan de implementación. El weight es proporcional al coste relativo (0-1).

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
// Modelo: Claude Sonnet 4
// Config: max_tokens: 16384, temperature: 0.2

export const AUDIT_SYSTEM_PROMPT = `Eres un auditor de calidad de proyectos tecnológicos con 15 años de experiencia en consultoras Big Four. Tu trabajo es comparar un documento de alcance generado contra el material fuente original y detectar TODAS las discrepancias, omisiones o inconsistencias.

REGLAS:
- Sé exhaustivo y metódico. Revisa sección por sección del documento contra el material original.
- Asigna códigos secuenciales a cada hallazgo: [H-01], [H-02], etc.
- Clasifica por severidad con indicador visual:
  - 🔴 CRÍTICO: Bloquea el proyecto o la presentación al cliente. Requiere acción inmediata.
  - 🟠 IMPORTANTE: Afecta calidad o completitud. Debe corregirse antes de entregar.
  - 🟢 MENOR: Mejora deseable. Puede incorporarse sin urgencia.
- Distingue entre tipos: OMISIÓN (dato del original que falta), INCONSISTENCIA (dato que contradice el original), RIESGO_NO_CUBIERTO (situación sin mitigación), MEJORA (sugerencia que no es error).
- Para CADA hallazgo incluye obligatoriamente:
  1. Sección afectada del documento de alcance
  2. Problema concreto (no vago)
  3. Dato original textual: cita EXACTA del material fuente (con minuto si es transcripción o referencia si es documento)
  4. Acción requerida: qué hacer exactamente para corregirlo
  5. Consecuencia de no corregir: qué pasa si se ignora este hallazgo
- No generes falsos positivos. Si algo se simplificó correctamente, no lo marques como omisión.
- La tabla de puntuación por sección debe incluir notas breves que justifiquen la puntuación (como "Falta control horario, multi-sede, stack").
- La recomendación final debe ser UNA de: APROBAR / APROBAR CON CORRECCIONES / RECHAZAR Y REGENERAR.
- COMPARA SIEMPRE el orden de implementación del documento con lo acordado en la reunión original. Si el cliente o proveedor propuso demostrar X primero, eso debe reflejarse en Fase 1 del cronograma. Si no coincide, generar hallazgo de tipo INCONSISTENCIA.
- VERIFICA que todos los temas discutidos en la reunión tienen módulo asignado. Si se habló de control horario, pausas, horas extra u otra funcionalidad, debe existir un módulo para ello. Si falta, generar hallazgo de tipo OMISIÓN.
- NO permitas que el documento de alcance baje presupuestos a rangos irrealistas solo para alinear con expectativas del cliente. Si el presupuesto propuesto es insuficiente para el alcance definido, señálalo como hallazgo CRÍTICO de tipo RIESGO_NO_CUBIERTO.
- REGLA ESPECÍFICA MVP: Si en el material fuente el proveedor propuso una funcionalidad como PRIMERA DEMOSTRACIÓN DE VALOR (ej: 'validar reconocimiento de fotos', 'demo de OCR', 'probar la IA con datos reales'), esa funcionalidad DEBE estar en la Fase 1 del documento de alcance. Si el documento dice 'sin OCR' o excluye esa funcionalidad de la Fase 1 pero el proveedor ofreció demostrarla primero, márcalo como hallazgo de tipo INCONSISTENCIA con severidad CRÍTICO. Este es un error grave porque contradice la estrategia comercial acordada.
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

Realiza una auditoría cruzada exhaustiva. Compara cada dato del material fuente contra lo que aparece en el documento de alcance. Genera el siguiente JSON:
{
  "puntuación_global": 0-100,
  "resumen_auditoría": "2-3 frases con la evaluación general. Ejemplo: 'El documento captura correctamente la mayoría de funcionalidades con estructura profesional. Requiere X correcciones (Y CRÍTICAS, Z IMPORTANTES) antes de presentar al cliente.'",
  "hallazgos": [
    {
      "codigo": "H-01",
      "tipo": "OMISIÓN/INCONSISTENCIA/RIESGO_NO_CUBIERTO/MEJORA",
      "severidad": "CRÍTICO/IMPORTANTE/MENOR",
      "indicador_visual": "🔴/🟠/🟢",
      "sección_afectada": "sección exacta del documento de alcance (ej: '6. Inversión y Estructura de Costes')",
      "descripción": "descripción concreta del problema encontrado",
      "dato_original_textual": "cita EXACTA del material fuente. Si es transcripción incluir minuto aproximado (ej: 'Minuto 41:19: Agustín propone validar reconocimiento de fotos como primer entregable'). Si es documento, citar el texto literal.",
      "acción_requerida": "acción específica y concreta (ej: 'Añadir Fase 0 / PoC de 2-3 semanas, 3.000-5.000€ como punto de entrada')",
      "consecuencia_si_no_se_corrige": "impacto concreto (ej: 'El cliente rechaza la propuesta al ver un presupuesto 5-8x superior a su expectativa')"
    }
  ],
  "puntuación_por_sección": [
    {
      "sección": "nombre de la sección",
      "puntuación": 0-100,
      "notas": "justificación breve de la puntuación (ej: 'Sólido, ROI cuantificado pero conservador' o 'Falta control horario, multi-sede, stack')"
    }
  ],
  "datos_original_no_usados": ["dato o detalle del material fuente que no aparece en ninguna parte del documento — con referencia a dónde aparece en el original"],
  "recomendación": "APROBAR / APROBAR CON CORRECCIONES / RECHAZAR Y REGENERAR",
  "resumen_hallazgos": {
    "total": número,
    "críticos": número,
    "importantes": número,
    "menores": número
  }
}`;

// ── FASE 5: Documento Final ────────────────────────────────────────────────
// Modelo: Claude Sonnet 4
// Config: max_tokens: 16384, temperature: 0.4

export const FINAL_DOC_SYSTEM_PROMPT = `Eres un director de proyectos senior de una consultora premium. Se te proporciona un documento de alcance y el resultado de una auditoría de calidad con hallazgos codificados [H-XX]. Tu trabajo es generar la VERSIÓN FINAL del documento incorporando TODAS las correcciones.

REGLAS:
- Para CADA hallazgo [H-XX] de la auditoría, genera la corrección EXACTA:
  - Muestra QUÉ texto se añade o modifica y EN QUÉ sección.
  - Las correcciones deben ser texto listo para insertar, no descripciones vagas.
  - Si un hallazgo requiere una nueva sección completa (ej: Fase 0, módulo nuevo, riesgo nuevo), escríbela completa con el mismo estilo del documento.
- Si un hallazgo queda cubierto por la corrección de otro, márcalo: "[H-XX] → Ya cubierto con [H-YY]".
- Si un hallazgo requiere información que no tienes, marca como [PENDIENTE: descripción].
- El documento final debe leerse como si siempre hubiera sido correcto — NO añadas una sección visible de "correcciones aplicadas".
- Mantén la estructura, estilo y nivel de detalle del documento original.
- Al final, incluye un CHANGELOG INTERNO (separado por ---) con formato tabla.
- NUNCA bajes un presupuesto sin reducir alcance proporcionalmente. Si la auditoría indica que el presupuesto es excesivo para el cliente, la solución NO es poner un precio inferior por el mismo trabajo — es añadir una Fase 0/PoC de bajo coste como punto de entrada y mantener el presupuesto real para el proyecto completo.
- Verifica que TODAS las funcionalidades discutidas en el material original tienen módulo asignado en el documento final. Si alguna falta, añádela al módulo correspondiente o crea uno nuevo.
- REGLA OBLIGATORIA DE FASE 0/PoC: Si existe un gap >50% entre la expectativa del cliente (presupuesto mencionado o intuido) y el presupuesto real del proyecto, DEBES añadir obligatoriamente una "Fase 0 — Proof of Concept" como PRIMERA fase del plan de implementación, con estos 4 campos exactos:
  1. Duración: 2-3 semanas
  2. Coste: entre la expectativa del cliente y 5.000€ (ej: si el cliente espera 3.000€, la Fase 0 cuesta 3.000-5.000€)
  3. Entregables: demo funcional de la funcionalidad core (la que más valor demuestra) + maquetas/wireframes del resto
  4. Criterio de continuidad: si el cliente valida la demo y acepta el alcance completo, se procede con Fases 1-3 a presupuesto real
  NO es suficiente con un párrafo de justificación de precio. DEBE existir una Fase 0 como sección completa del cronograma con duración, coste, entregables y criterio.
- Idioma: español (España).`;

export const buildFinalDocPrompt = (params: {
  scopeDocument: string;
  auditJson: string;
  briefingJson: string;
}) => `DOCUMENTO DE ALCANCE (versión anterior):
${params.scopeDocument}

RESULTADO DE AUDITORÍA (con hallazgos codificados):
${params.auditJson}

BRIEFING ORIGINAL:
${params.briefingJson}

INSTRUCCIONES:
1. Lee cada hallazgo [H-XX] de la auditoría.
2. Para cada uno, genera la corrección concreta como texto listo para insertar en la sección correspondiente.
3. Si un hallazgo implica una sección nueva (ej: Fase 0, módulo nuevo), escríbela completa.
4. Regenera el DOCUMENTO COMPLETO con todas las correcciones integradas de forma natural.
5. Si varios hallazgos se resuelven con una misma corrección, indícalo en el changelog.
6. IMPORTANTE: Si detectas un gap >50% entre expectativa del cliente y presupuesto real (revisa el briefing), incluye obligatoriamente una Fase 0/PoC al inicio del plan con: duración 2-3 semanas, coste entre expectativa cliente y 5.000€, entregables (demo core + maquetas), y criterio de continuidad.

Al final del documento, después de una línea separadora (---), incluye:

## CHANGELOG INTERNO (no incluir en entrega al cliente)
| Hallazgo | Severidad | Acción tomada |
| --- | --- | --- |
| H-01: [descripción corta] | CRÍTICO/IMPORTANTE/MENOR | [qué se hizo exactamente] |
| H-07: Fase 0 | IMPORTANTE | Cubierto con H-01 |
| ... | ... | ... |`;

// ── FASE 6: AI Leverage ────────────────────────────────────────────────────
// Modelo: Claude Sonnet 4
// Config: max_tokens: 16384, temperature: 0.3

export const AI_LEVERAGE_SYSTEM_PROMPT = `Eres un arquitecto de soluciones de IA con experiencia práctica implementando sistemas en producción (no teóricos). Tu trabajo es analizar un proyecto y proponer EXACTAMENTE dónde y cómo la IA aporta valor real, con estimaciones concretas basadas en volúmenes reales del proyecto.

REGLAS CRÍTICAS:
- Solo propón IA donde REALMENTE aporte valor sobre una solución no-IA. Si una regla de negocio simple resuelve el problema, marca el tipo como "REGLA_NEGOCIO_MEJOR" y explica por qué NO se necesita IA. La honestidad genera confianza.
- Para cada oportunidad, incluye TODOS estos campos en formato tabla:
  - Módulo afectado
  - Tipo: API_EXISTENTE / API_EXISTENTE + ajuste custom / MODELO_CUSTOM / REGLA_NEGOCIO_MEJOR
  - Modelo recomendado (nombre exacto: "Google Vision API + Claude Haiku 4.5", no genérico)
  - Cómo funciona: explicación técnica concreta del flujo (ej: "Vision API extrae texto → Claude Haiku recibe texto + schema → devuelve JSON estructurado")
  - Coste API: cálculo explícito con volumen (ej: "~40-80€/mes estimando 30 albaranes/día × 22 días = 660/mes")
  - Precisión esperada: % con justificación (ej: "92-97% con mejora continua")
  - Esfuerzo: horas concretas (ej: "Medio, 40-60h")
  - ROI: cálculo explícito (ej: "Ahorra ~2h/día = 440h/año = ~5.500€/año vs coste IA ~960€/año")
  - Es MVP: ✅ Sí / ❌ No (con prioridad P0/P1/P2)
  - Dependencias: qué necesita estar listo antes
- Quick Wins: identifica las oportunidades de impacto alto y esfuerzo bajo que son demostrables en fases tempranas.
- Stack IA: justifica CADA componente (ej: "OCR: Google Vision API — mejor precio/rendimiento para documentos en español").
- IMPLEMENTACIÓN EN LOVABLE: Cada oportunidad IA se implementará como Supabase Edge Function (Deno). Indica el nombre de la función, el trigger (ej: "INSERT en tabla farmacias") y los secrets necesarios (ej: "ANTHROPIC_API_KEY en Supabase Vault").
- REGLA DE ESTIMACIÓN CONSERVADORA: Todos los cálculos de ROI y ahorro deben usar el ESCENARIO BAJO, no el alto. Si hay incertidumbre en volumen o ahorro, usa el 50% del valor optimista. Es mejor sorprender al cliente con resultados mejores que decepcionar con proyecciones infladas. Ejemplo: si el ahorro podría ser 2-4h/día, calcula con 1-2h/día.
- REGLA DE FRAUDE/ANOMALÍAS: Para oportunidades relacionadas con detección de fraude, anomalías, o irregularidades, NO estimes valor monetario a menos que existan datos históricos reales de incidencia. En su lugar, usa "potencial de detección sin cuantificar — requiere datos históricos para estimar impacto". La credibilidad es más importante que impresionar con cifras inventadas.

## DECISIÓN DE SERVICIOS AUXILIARES
Evalúa si el proyecto necesita RAG y/o Detector de Patrones:

### RAG — marcar como NECESARIO si:
- El proyecto maneja documentación técnica, normativa, o catálogos que los usuarios consultarán
- Hay FAQs, procesos documentados, o bases de conocimiento que la app debe poder responder
- Alguna funcionalidad IA necesita contexto de dominio para funcionar (chatbot, asistente, buscador inteligente)
- El cliente mencionó necesidad de "buscar información" o "consultar datos" en el briefing

### RAG — marcar como NO NECESARIO si:
- La app es puramente transaccional (CRUD sin consultas de conocimiento)
- No hay corpus de texto que indexar
- Toda la información está estructurada en tablas SQL sin necesidad de búsqueda semántica

### Nivel del RAG — determinar si BÁSICO, NORMAL, o PRO:
BÁSICO (basic):
- La app es principalmente CRUD con un componente de consulta/FAQ
- Las fuentes son los propios documentos del proyecto
- No hay dominio técnico profundo que investigar
- Ejemplo: app de gestión con buscador de procedimientos internos

NORMAL (normal):
- La app necesita conocimiento de dominio externo (normativa, mercado, técnico)
- Hay 3-8 áreas temáticas claras que investigar
- El RAG complementa la funcionalidad pero NO es el producto principal
- Ejemplo: plataforma inmobiliaria con datos de mercado y normativa

PRO (pro):
- El RAG ES el producto o es core para la propuesta de valor
- Requiere fuentes no convencionales, datos gubernamentales, investigación académica
- El cliente pagará por la exhaustividad del conocimiento
- Hay más de 8 áreas temáticas interrelacionadas
- Ejemplo: motor de scoring con datos cruzados de múltiples fuentes públicas

### Detector de Patrones — marcar como NECESARIO si:
- El proyecto necesita scoring, ranking, o evaluación basada en múltiples variables
- Hay decisiones de inversión, ubicación, selección, o priorización
- El briefing menciona "análisis", "predicción", "tendencias", "señales", "scoring"
- El sector tiene variables no convencionales que aportan ventaja competitiva

### Detector de Patrones — marcar como NO NECESARIO si:
- No hay componente analítico o de scoring
- Las decisiones del usuario son binarias y no requieren variables cruzadas
- El proyecto es informativo o de gestión sin componente predictivo

### deployment_mode:
- SAAS (por defecto): servicios en infraestructura centralizada
- SELF_HOSTED: solo si data_sensitivity es "high" (datos médicos, financieros regulados, gobierno)

### data_sensitivity:
- low: datos comerciales públicos o semi-públicos
- medium: datos de negocio con PII básica
- high: datos médicos, financieros regulados, o gobierno → recomendar SELF_HOSTED

- Responde SOLO con JSON válido.`;

export const buildAiLeveragePrompt = (params: {
  finalDocument: string;
  briefingJson: string;
}) => `DOCUMENTO DE ALCANCE FINAL:
${params.finalDocument}

BRIEFING DEL PROYECTO:
${params.briefingJson}

Genera un análisis exhaustivo de oportunidades de IA. Para cada oportunidad, calcula el ROI con los datos reales del proyecto (volúmenes, usuarios, frecuencias mencionados en el briefing/documento). Estructura JSON:
{
  "resumen": "valoración general del potencial de IA en 2-3 frases, incluyendo número de oportunidades, coste total estimado y ROI global",
  "oportunidades": [
    {
      "id": "AI-001",
      "nombre": "nombre descriptivo (ej: 'OCR Inteligente de Albaranes')",
      "módulo_afectado": "módulo exacto del proyecto",
      "descripción": "qué hace y por qué aporta valor en 1-2 frases",
      "tipo": "API_EXISTENTE / API_EXISTENTE + ajuste custom / MODELO_CUSTOM / REGLA_NEGOCIO_MEJOR",
      "modelo_recomendado": "nombre exacto del modelo/API (ej: 'Google Vision API + Claude Haiku para validación contextual'). Si es REGLA_NEGOCIO_MEJOR: 'No requiere IA — motor de reglas con X parámetros'",
      "como_funciona": "explicación técnica del flujo paso a paso (ej: 'Foto del ticket → Vision API → regex/parser para extraer litros, precio, total, fecha, matrícula'). Si es REGLA_NEGOCIO_MEJOR: explicar la lógica de reglas.",
      "coste_api_estimado": "€/mes con cálculo de volumen explícito (ej: '~15-25€/mes (40 camiones × 2-3 repostajes/semana = 320-480/mes)'). Si REGLA_NEGOCIO: '0€'",
      "calculo_volumen": "desglose: unidades/día × días/mes = total/mes",
      "precisión_esperada": "% con justificación (ej: '95-98% — tickets tienen formato limpio y tipificado')",
      "datos_necesarios": "qué datos hacen falta para funcionar o calibrar",
      "esfuerzo_implementación": "nivel + horas (ej: 'Bajo (15-20h). Formato estándar, parser simple.')",
      "impacto_negocio": "qué resuelve cuantitativamente",
      "roi_estimado": "cálculo explícito: ahorro anual vs coste IA anual (ej: 'Ahorra ~2h/día de transcripción = 440h/año = ~5.500€/año vs coste IA ~960€/año')",
      "es_mvp": true,
      "prioridad": "P0/P1/P2",
      "dependencias": "qué necesita estar listo antes (ej: 'Muestras de albaranes reales para calibrar prompts')",
      "fase_implementación": "en qué fase del proyecto se implementa",
      "edge_function_name": "nombre de la Supabase Edge Function (ej: 'score-farmacia')",
      "trigger": "qué dispara la ejecución (ej: 'Database webhook en INSERT farmacias')",
      "secrets_requeridos": "qué API keys necesita en Supabase Vault"
    }
  ],
  "quick_wins": ["AI-001", "AI-002 — justificación breve de por qué son quick wins"],
  "requiere_datos_previos": ["AI-005 — qué datos y cuánto tiempo de recolección"],
  "stack_ia_recomendado": {
    "ocr": "solución + justificación (ej: 'Google Vision API — mejor precio/rendimiento para documentos en español')",
    "nlp": "solución + justificación, o 'No aplica' con razón",
    "visión": "solución + justificación, o 'No aplica'",
    "mapas": "solución + justificación, o 'No aplica'",
    "analytics": "solución + justificación, o 'No requiere IA dedicada — Supabase + queries SQL + dashboard React'"
  },
  "coste_ia_total_mensual_estimado": "rango €/mes con nota (ej: '80-200€/mes — depende del volumen real de X, Y y Z')",
  "nota_implementación": "consideraciones prácticas en 2-3 frases",
  "services_decision": {
    "rag": {
      "necesario": true,
      "confianza": 0.85,
      "nivel": "basic | normal | pro",
      "nivel_justificación": "motivo concreto de por qué este nivel y no otro",
      "justificación": "motivo concreto basado en el análisis del proyecto",
      "dominio_sugerido": "dominio de conocimiento del proyecto",
      "fuentes_esperadas": ["fuente1", "fuente2"],
      "tipo_consultas": ["consulta tipo 1", "consulta tipo 2"]
    },
    "pattern_detector": {
      "necesario": true,
      "confianza": 0.90,
      "justificación": "motivo concreto basado en el análisis del proyecto",
      "sector_sugerido": "sector del proyecto",
      "geografia_sugerida": "geografía del proyecto",
      "objetivo_sugerido": "objetivo del análisis de patrones",
      "variables_clave_sugeridas": ["variable1", "variable2"],
      "success_definition": {
        "metric": "qué se mide (ej: renovación de contrato, reducción de stock, conversión)",
        "threshold": "cuándo se considera éxito (ej: permanencia >24 meses, roturas <5%)",
        "measurement_source": "de dónde sale el dato (ej: tabla oportunidades.estado, tabla inventario.roturas)"
      }
    },
    "deployment_mode": "SAAS",
    "data_sensitivity": "low/medium/high"
  }
}`;


// ═══════════════════════════════════════════════════════════════════════════
// ── FASE 7: PRD TÉCNICO — LOW-LEVEL DESIGN — LOVABLE-READY ──────────────
// ═══════════════════════════════════════════════════════════════════════════
// Modelo principal: Gemini Pro 2.5 | Fallback: Claude Sonnet 4
// Config: temperature: 0.3, maxOutputTokens: 12288 por call
// Estructura: 6 calls generativas + 1 call de validación cruzada
// Output: Markdown plano (no JSON)
// ═══════════════════════════════════════════════════════════════════════════

export const PRD_SYSTEM_PROMPT = `Eres un Product Manager técnico senior + Arquitecto de Soluciones. Generas PRDs de nivel LOW-LEVEL DESIGN que se convierten directamente en aplicaciones funcionales via Lovable.

## NIVEL DE DETALLE REQUERIDO
NO generes un PRD resumen ni un documento de alto nivel. Genera un DISEÑO OPERATIVO LOW-LEVEL con:
- Ontología de entidades con campos obligatorios y relaciones
- Catálogo exhaustivo de variables agrupadas por familia (mínimo 50-100 variables)
- Patrones operativos con código, condición y respuesta (mínimo 20-30 patrones)
- Motor de scoring con fórmula conceptual, variables, incertidumbre y reglas de convergencia
- Signal Objects estandarizados con freshness tiers
- Modelo de datos SQL completo con RLS
- Edge Functions con cadencias de actualización
- Matriz de despliegue Core/Alpha/Experimental
- Checklist maestro de construcción P0/P1/P2

## STACK OBLIGATORIO
Todo lo que generes DEBE usar exclusivamente este stack:
- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Supabase (Auth, PostgreSQL, Storage, Edge Functions con Deno, Realtime)
- Routing: react-router-dom
- Iconos: lucide-react
- Charts: recharts (si aplica)
- Estado: React hooks (useState, useEffect, useContext) — NO Redux, NO Zustand
- Pagos: Stripe via Supabase Edge Function (si aplica)

PROHIBIDO mencionar: Next.js, Express, NestJS, microservicios, JWT custom, AWS, Azure, Docker, Kubernetes, MongoDB, Firebase.
Si el documento de alcance o la auditoría IA mencionan estas tecnologías, TRADÚCELAS al stack Lovable equivalente.

EXCEPCIÓN RAG EXTERNO: Si el proyecto consume RAG como servicio externo (deployment_mode SAAS), la regla de traducción Qdrant→pgvector NO aplica. El RAG es un servicio externo consumido via proxy Edge Function.

## REGLAS DE ESCRITURA
1. FORMATO: Markdown plano con tablas Markdown, bloques de código y listas. NUNCA JSON anidado.
2. MEDIBLE: Cada requisito debe ser testeable. "El sistema debe ser rápido" → "Tiempo de carga <2s en 3G".
3. TRAZABLE: Cada módulo mapea a pantallas + entidades + endpoints concretos.
4. IA CON GUARDRAILS: Toda funcionalidad de IA DEBE tener: fallback, logging, coste por operación, precisión esperada.
5. NÚMEROS HONESTOS: Si un ROI o métrica es hipotético, márcalo como "[HIPÓTESIS — requiere validación]".
6. LOVABLE-ESPECÍFICO: CREATE TABLE SQL ejecutable, RLS incluidas, componentes IA como Edge Functions con triggers.
7. POR FASE: Marca cada pantalla, tabla, componente y función con la fase (Fase 0, 1, 2...).
8. IDIOMA: español (España).
9. EXHAUSTIVIDAD: Cada tabla de variables/patrones debe ser COMPLETA, no "etc." ni "y otros similares". Lista TODOS.
10. PROFUNDIDAD DOMINIO: Investiga las particularidades del sector/dominio del proyecto para generar variables y patrones específicos, no genéricos.

## REGLAS DE NOMBRES PROPIOS
Verifica que los nombres de empresas, stakeholders y productos estén escritos correctamente según el briefing original.`;

// ── PRD PART 1: Secciones 1-4 (Resumen, Marco problema, Principios, Métricas) ──
export const buildPrdPart1Prompt = (params: {
  finalDocument: string;
  aiLeverageJson: string;
  briefingJson: string;
  targetPhase?: string;
  dataProfile?: any;
}) => {
  let dataBlock = "";
  if (params.dataProfile?.has_client_data) {
    const vars = (params.dataProfile.detected_variables || []).map((v: any) =>
      `  - ${v.name} (${v.type}): ${v.records} reg., calidad ${v.quality}% — ${v.description}`
    ).join("\n");
    dataBlock = `\nDATOS REALES DEL CLIENTE:\n${vars}\n- Calidad global: ${params.dataProfile.data_quality_score}/100\n- Contexto: ${params.dataProfile.business_context}\n\nUSA estos datos reales para calibrar métricas y rangos. NO marcar como [HIPÓTESIS] lo derivable de datos reales.\n`;
  }

  return `CONTEXTO DEL PROYECTO:

DOCUMENTO FINAL APROBADO:
${params.finalDocument}

AI LEVERAGE (oportunidades IA):
${params.aiLeverageJson}

BRIEFING ORIGINAL:
${params.briefingJson}
${dataBlock}
FASE OBJETIVO: ${params.targetPhase || "Todas — PRD global"}

GENERA LAS SECCIONES 1 A 4 DEL PRD LOW-LEVEL EN MARKDOWN:

# 1. RESUMEN EJECUTIVO
Un párrafo denso: empresa, problema cuantificado, solución, stack (React+Vite+Supabase), resultado esperado.
Incluir: "Este PRD es Lovable-ready: cada sección se traduce directamente en código ejecutable."
Segundo párrafo: Magnitud del proyecto — número de entidades, variables, patrones, Edge Functions, pantallas que se van a definir en este documento.

# 2. MARCO DEL PROBLEMA Y TESIS DE DISEÑO
## 2.1 Problema
Descripción detallada del problema de negocio con datos cuantitativos. NO genérico — usar cifras del briefing.
## 2.2 Hipótesis central
"Si construimos [X] con [Y variables/patrones/modelos], entonces [Z resultado medible] porque [evidencia/razonamiento]."
## 2.3 Tesis de diseño
3-5 principios que guían TODAS las decisiones técnicas del proyecto. Cada uno con:
- Enunciado
- Implicación técnica concreta
- Ejemplo de cómo afecta al diseño
Ejemplo: "Datos primero, UI después → El dashboard consume vistas materializadas, no queries directos. La calidad de la señal es más importante que la velocidad de la interfaz."

# 3. PRINCIPIOS DE ARQUITECTURA
Para cada principio (mínimo 5):
### P-XX: [Nombre del principio]
- **Enunciado**: Frase concisa
- **Motivación**: Por qué este principio y no otro
- **Implementación**: Cómo se materializa en código/infra
- **Violación**: Ejemplo de qué NO hacer
- **Métricas de cumplimiento**: Cómo medir si se está siguiendo

Ejemplos de principios recomendados:
- Separación de capas (ingestión / procesamiento / presentación)
- Idempotencia de Edge Functions
- Degradación graceful (nunca pantalla vacía)
- Score explicable (no cajas negras)
- Frescura sobre completitud

# 4. OBJETIVOS Y MÉTRICAS
| ID | Objetivo | Prioridad | Métrica de éxito | Baseline | Target 6m | Fase | Fuente del dato |
Incluir objetivos P0, P1 y P2 con métricas cuantificadas. Marcar hipótesis con [HIPÓTESIS].
Para cada métrica, indicar exactamente QUÉ query SQL o endpoint la mide.

IMPORTANTE: Genera SOLO secciones 1-4. Sé exhaustivo. Termina con: ---END_PART_1---`;
};

// ── PRD PART 2: Secciones 5-9 (Ontología, Variables, Patrones, Alcance, Personas) ──
export const buildPrdPart2Prompt = (params: {
  finalDocument: string;
  aiLeverageJson: string;
  briefingJson: string;
  servicesDecision?: {
    rag?: { necesario: boolean; dominio_sugerido?: string; tipo_consultas?: string[] };
    pattern_detector?: { necesario: boolean; sector_sugerido?: string; objetivo_sugerido?: string; variables_clave_sugeridas?: string[] };
    deployment_mode?: string;
  };
}) => {
  let servicesBlock = "";
  if (params.servicesDecision?.rag?.necesario) {
    servicesBlock += `\nSERVICIO EXTERNO: RAG — Dominio: ${params.servicesDecision.rag.dominio_sugerido || "del proyecto"}`;
  }
  if (params.servicesDecision?.pattern_detector?.necesario) {
    servicesBlock += `\nSERVICIO EXTERNO: Detector de Patrones — Variables clave: ${(params.servicesDecision.pattern_detector.variables_clave_sugeridas || []).join(", ")}`;
  }

  return `CONTEXTO:
DOCUMENTO FINAL: ${params.finalDocument}
AI LEVERAGE: ${params.aiLeverageJson}
BRIEFING: ${params.briefingJson}
${servicesBlock}

GENERA LAS SECCIONES 5 A 9 DEL PRD LOW-LEVEL EN MARKDOWN:

# 5. ONTOLOGÍA DE ENTIDADES

Para CADA entidad del dominio (no solo tablas SQL — todas las entidades conceptuales):

## 5.X [Nombre de la entidad]
- **Categoría**: producto | industrial | geográfica | temporal | persona | evento | documento | métrica
- **Descripción**: Qué representa en el dominio del negocio
- **Campos obligatorios**: Lista de atributos con tipo, descripción y ejemplo
- **Relaciones**: Con qué otras entidades se conecta (1:N, N:M, 1:1)
- **Ciclo de vida**: Estados posibles y transiciones (ej: borrador → publicado → archivado)
- **Fuente de verdad**: De dónde viene el dato (input usuario, API externa, cálculo, inferencia IA)
- **Frecuencia de actualización**: Tiempo real, diaria, semanal, bajo demanda
- **Ejemplo concreto**: Un registro real o realista con todos sus campos

Diagrama Mermaid de relaciones entre entidades:
\`\`\`mermaid
erDiagram
  [Entidad1] ||--o{ [Entidad2] : "relación"
\`\`\`

# 6. CATÁLOGO DE VARIABLES

Agrupa TODAS las variables del proyecto por familia. Cada proyecto debe tener entre 50-150 variables dependiendo de su complejidad.

## 6.1 Familia: [Nombre de la familia] (ej: Demanda, Operativa, Financiera, Geográfica, Temporal, Social, Regulatoria, etc.)

| Clave | Descripción | Tipo | Unidad | Rango esperado | Fuente | Frecuencia actualización | Valor analítico |
|-------|-------------|------|--------|----------------|--------|--------------------------|-----------------|
| var_001 | Descripción clara | numeric/text/boolean/timestamp/json | unidad | min-max o enum | fuente concreta | real-time/daily/weekly | Para qué sirve analíticamente |

REGLAS DEL CATÁLOGO:
- NO uses "etc." ni "y similares". Lista TODAS las variables.
- Cada variable debe tener un nombre de clave snake_case único.
- Agrupa por familia temática, no por tabla SQL.
- Incluye variables derivadas (calculadas a partir de otras) con la fórmula.
- Incluye variables de contexto (temporales, geográficas, de mercado) que enriquecen el análisis.
- Para variables que vienen de APIs externas, indica el endpoint y el campo específico.

Familias mínimas recomendadas (adaptar al dominio):
- **Core del negocio**: Variables directamente del CRUD principal
- **Operativas**: Tiempos, frecuencias, cadencias, estados
- **Financieras**: Costes, ingresos, márgenes, ROI
- **Geográficas**: Ubicaciones, zonas, coberturas, distancias
- **Temporales**: Estacionalidad, tendencias, plazos, vencimientos
- **De usuario/persona**: Comportamiento, preferencias, historial
- **Externas/mercado**: Competencia, regulación, tendencias del sector
- **De calidad/rendimiento**: Métricas internas del sistema, latencia, precisión IA

# 7. PATRONES DE ALTO VALOR

Para CADA patrón (mínimo 20-30 por proyecto):

| Código | Patrón | Condición resumida | Variables involucradas | Severidad/Valor | Respuesta sugerida | Categoría |
|--------|--------|--------------------|-----------------------|-----------------|--------------------|-----------| 
| PAT-001 | Nombre descriptivo | IF condición_A AND condición_B THEN | var_001, var_015, var_042 | ALTO/MEDIO/BAJO | Acción concreta | operativo/financiero/riesgo/oportunidad |

Categorías de patrones:
- **Operativo**: Patrones del día a día del negocio
- **Financiero**: Patrones de coste, ingreso, rentabilidad
- **Riesgo**: Señales de alerta temprana
- **Oportunidad**: Ventanas de acción (timing)
- **Anomalía**: Desviaciones del comportamiento normal
- **Estacional**: Patrones temporales recurrentes
- **Competitivo**: Patrones del mercado/competencia

Para CADA patrón, incluye:
- Condición en pseudocódigo legible
- Las variables exactas del catálogo (sección 6) que usa
- Umbral de activación con justificación
- Falso positivo esperado y cómo minimizarlo
- Acción que desencadena en el sistema (notificación, alerta, recalcular score, etc.)

# 8. ALCANCE V1 CERRADO
## 8.1 Incluido
| Módulo | Funcionalidad | Prioridad | Fase | Pantalla(s) | Entidad(es) | Variables involucradas |
Cada fila mapea a pantallas, entidades Y variables concretas del catálogo.
## 8.2 Excluido
| Funcionalidad | Motivo exclusión | Fase futura |
## 8.3 Supuestos
Lista numerada de supuestos con impacto si fallan.

# 9. PERSONAS Y ROLES
Para cada tipo de usuario (mínimo 3):
### Persona: [Nombre ficticio], [Rol]
- **Perfil**: edad, ubicación, contexto profesional
- **Dispositivos**: principales y secundarios
- **Frecuencia uso**: diaria/semanal/mensual
- **Nivel técnico**: bajo/medio/alto
- **Dolor principal**: cuantificado si posible
- **Rol en el sistema**: qué puede ver/hacer/no hacer
- **Pantallas principales**: lista de las 3-5 pantallas que más usa
- **Variables que le importan**: del catálogo, cuáles consulta habitualmente
- **Patrones que le alertan**: del catálogo de patrones, cuáles son relevantes para este rol

## 9.1 Matriz de permisos
| Recurso/Acción | [Rol 1] | [Rol 2] | [Rol 3] |

IMPORTANTE: Genera SOLO secciones 5-9. Termina con: ---END_PART_2---`;
};

// ── PRD PART 3: Secciones 10-14 (Flujos, Módulos, RF, NFR, IA) ──
export const buildPrdPart3Prompt = (params: {
  finalDocument: string;
  aiLeverageJson: string;
  briefingJson: string;
}) => `CONTEXTO:
DOCUMENTO FINAL: ${params.finalDocument}
AI LEVERAGE: ${params.aiLeverageJson}
BRIEFING: ${params.briefingJson}

GENERA LAS SECCIONES 10 A 14 DEL PRD LOW-LEVEL EN MARKDOWN:

# 10. FLUJOS PRINCIPALES

Para cada flujo core (mínimo 5):
### Flujo: [Nombre del flujo]
**Tipo**: Happy path / Edge case
**Actores**: quién participa
**Precondiciones**: qué debe existir antes

| Paso | Actor | Acción en UI | Query/Mutation Supabase | Estado resultante | Variables afectadas |
| 1 | Usuario | Descripción | SQL/RPC concreto | Estado nuevo | var_xxx, var_yyy |

**Edge cases**:
- ¿Qué pasa si [error]? → [respuesta UI] + [manejo técnico]
- ¿Qué pasa si [timeout]? → [degradación graceful]

# 11. MÓDULOS DEL PRODUCTO

Para CADA módulo (lista cerrada — no añadir módulos fuera del alcance):

## 11.X [Nombre del Módulo] — Fase [N] — [P0/P1/P2]
- **Pantallas**: lista con ruta (ej: /dashboard/farmacias → FarmaciasList)
- **Entidades**: tablas de BD involucradas
- **Variables**: del catálogo, cuáles se muestran/editan
- **Patrones**: del catálogo, cuáles se evalúan en este módulo
- **Edge Functions**: funciones IA involucradas (si aplica)
- **Dependencias**: qué módulos deben existir antes

# 12. REQUISITOS FUNCIONALES

Para cada módulo, user stories con criterios:

### RF-001: [Título corto]
- **Módulo**: Nombre
- **Como** [rol] **quiero** [acción] **para** [beneficio]
- **Criterios de aceptación**:
  - DADO [contexto] CUANDO [acción] ENTONCES [resultado medible]
  - DADO [contexto] CUANDO [error] ENTONCES [manejo específico]
- **Variables involucradas**: var_xxx, var_yyy
- **Prioridad**: P0/P1/P2
- **Fase**: N

# 13. REQUISITOS NO FUNCIONALES

| ID | Categoría | Requisito | Métrica | Herramienta de medición |
| NFR-01 | Rendimiento | Carga inicial <2s en 3G | LCP <2000ms | Lighthouse |
| NFR-02 | Seguridad | Datos cifrados en reposo | Supabase encryption | Config Supabase |
| NFR-03 | RGPD | Derecho al olvido | DELETE cascade en 72h | Edge Function |
| NFR-04 | Disponibilidad | Uptime >99.5% | Monitoreo | Supabase dashboard |

# 14. DISEÑO DE IA

Para CADA componente IA del AI Leverage que sea MVP o Fase 1-2:

## AI-XXX: [Nombre]
- **Edge Function**: nombre (ej: score-entidad)
- **Trigger**: qué lo dispara (ej: Database webhook en INSERT tabla WHERE condición)
- **Modelo/Proveedor**: nombre exacto
- **Input ejemplo**: JSON con campos reales
- **Output ejemplo**: JSON con campos reales
- **Variables del catálogo usadas**: lista explícita de var_xxx
- **Patrones que alimenta**: lista de PAT-xxx que este componente IA activa
- **Prompt base**: el prompt resumido que se envía al modelo
- **Fallback**: qué pasa si la API falla
- **Guardrails**: límites (max tokens, timeout, validación output)
- **Logging**: INSERT INTO auditoria_ia con campos concretos
- **Métricas de calidad**: cómo medir (correlación, precision, recall)
- **Coste/operación**: € con cálculo de volumen
- **Secrets**: qué API keys en Supabase Vault

IMPORTANTE: Genera SOLO secciones 10-14. Termina con: ---END_PART_3---`;

// ── PRD PART 4: Secciones 15-19 (Scoring, SQL, Edge Functions, Integraciones, Seguridad) ──
export const buildPrdPart4Prompt = (params: {
  part1Output: string;
  part2Output: string;
  part3Output: string;
  servicesDecision?: {
    rag?: { necesario: boolean; dominio_sugerido?: string; tipo_consultas?: string[] };
    pattern_detector?: { necesario: boolean; sector_sugerido?: string; objetivo_sugerido?: string };
    deployment_mode?: string;
  };
}) => {
  let servicesBlock = "";
  if (params.servicesDecision?.rag?.necesario) {
    servicesBlock += `\nSERVICIO EXTERNO: RAG (Base de Conocimiento)
- Consumido via Edge Function proxy (rag-proxy) — server-to-server
- Dominio: ${params.servicesDecision.rag.dominio_sugerido || "dominio del proyecto"}
- Integración: POST /functions/v1/rag-proxy { question, filters? } → { answer, citations, confidence }
- Secrets: AGUSTITO_RAG_URL, AGUSTITO_RAG_KEY, AGUSTITO_RAG_ID
- NO crear tablas pgvector, rag_chunks, embeddings en el schema SQL\n`;
  }
  if (params.servicesDecision?.pattern_detector?.necesario) {
    servicesBlock += `\nSERVICIO EXTERNO: Detector de Patrones
- Consumido via Edge Function proxy (patterns-proxy) — server-to-server
- Integración: POST /functions/v1/patterns-proxy {} → { layers, composite_scores, model_verdict }
- Secrets: AGUSTITO_PATTERNS_URL, AGUSTITO_PATTERNS_KEY, AGUSTITO_PATTERNS_RUN_ID
- Señales established (1.0x) vs trial (0.5x)\n`;
  }

  return `PARTES 1, 2 Y 3 YA GENERADAS (para continuidad):
PARTE 1 (Resumen, Marco, Principios, Métricas):
${params.part1Output}

PARTE 2 (Ontología, Variables, Patrones, Alcance, Personas):
${params.part2Output}

PARTE 3 (Flujos, Módulos, RF, NFR, IA):
${params.part3Output}

GENERA LAS SECCIONES 15 A 19 DEL PRD LOW-LEVEL EN MARKDOWN:

# 15. MOTOR DE SCORING Y RIESGO

## 15.1 Fórmula conceptual
\`\`\`
score_final = f(var_objetivo, var_contexto, var_externas) × factor_confianza × factor_frescura
\`\`\`
Describe la fórmula CONCRETA del proyecto, no genérica. Usa las variables del catálogo (sección 6).

## 15.2 Variables objetivo
| Variable | Peso base | Normalización | Rango | Justificación del peso |

## 15.3 Incertidumbre y abstención
- Cuándo el sistema NO debe dar score (datos insuficientes)
- Umbrales de confianza mínima para mostrar resultado
- Cómo comunicar incertidumbre al usuario (ej: "Confianza: 72% — basado en 3 de 5 variables disponibles")

## 15.4 Reglas de convergencia
- Qué pasa cuando dos señales contradictorias co-ocurren
- Peso de evidencia contradictoria
- Cascade logic: orden de evaluación de capas

## 15.5 Signal Object estandarizado
\`\`\`typescript
interface SignalObject {
  signal_id: string;          // PAT-xxx del catálogo de patrones
  source_family: string;      // Familia de variables (sección 6)
  freshness_tier: 'F0' | 'F1' | 'F2' | 'F3' | 'F4';
  ttl_hours: number;
  normalized_score: number;   // 0-100
  confidence: number;         // 0-1
  affected_entities: string[];
  raw_evidence: Record<string, any>;
  created_at: string;
}
\`\`\`

## 15.6 Tiers de frescura
| Tier | Latencia máxima | Ejemplo | Uso en score |
| F0 | Real-time (<1min) | Precio actual, stock | Peso completo |
| F1 | Horaria (1-4h) | Tráfico web, menciones | Peso 0.9x |
| F2 | Diaria (12-24h) | Noticias, clima | Peso 0.7x |
| F3 | Semanal (1-7d) | Informes mercado | Peso 0.5x |
| F4 | Mensual+ (>7d) | Censo, catastro, regulación | Peso 0.3x pero vigente |

Adapta los tiers al dominio ESPECÍFICO del proyecto.

# 16. MODELO DE DATOS SQL COMPLETO

## 16.1 Schema SQL (ejecutable en Supabase)
Para CADA tabla, generar CREATE TABLE completo con tipos, constraints, defaults, índices:
\`\`\`sql
CREATE TABLE public.nombre_tabla (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- campos con tipos reales, NOT NULL donde aplique
  -- constraints CHECK, UNIQUE donde aplique
  -- indices para queries frecuentes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

IMPORTANTE: Supabase usa auth.users. NO crear tabla "usuarios" con email/password. Tabla perfiles REFERENCIA auth.users(id).

## 16.2 RLS Policies completas
Para CADA tabla, policies de seguridad con USING y WITH CHECK.

## 16.3 Storage Buckets
| Bucket | Visibilidad | Max size | Tipos permitidos | Acceso |

## 16.4 Diagrama Mermaid completo
\`\`\`mermaid
erDiagram
  [Todas las tablas con relaciones]
\`\`\`

## 16.5 Índices y vistas materializadas
Para queries frecuentes del dashboard, definir índices y vistas.

# 17. EDGE FUNCTIONS Y ORQUESTACIÓN

Para CADA Edge Function del proyecto:

## EF-XXX: [Nombre]
- **Trigger**: Qué lo dispara (webhook, cron, POST manual)
- **Cadencia**: Frecuencia de ejecución (real-time, cada 5min, horaria, diaria)
- **Input**: JSON schema
- **Proceso**: Paso a paso
- **Output**: JSON schema
- **Tablas que lee**: lista
- **Tablas que escribe**: lista
- **Variables del catálogo afectadas**: lista
- **Timeout**: máximo en ms
- **Fallback**: comportamiento si falla
- **Secrets requeridos**: lista

### Tabla de cadencias
| Edge Function | Cadencia | Trigger | Tablas afectadas | Timeout |

# 18. INTEGRACIONES Y SIGNAL OBJECT

Para CADA integración:
| Sistema | Tipo | Endpoint | Auth | Rate limit | Fallback | Edge Function | Secrets | Variables que alimenta |
${servicesBlock}

## 18.1 Flujo de señales
Describe cómo los datos fluyen desde las fuentes externas hasta el score final:
Fuente → Edge Function (ingestión) → Tabla raw → Edge Function (procesamiento) → Signal Object → Score

# 19. SEGURIDAD, RLS Y GOBIERNO

## 19.1 Políticas de acceso por rol
| Tabla | Admin | Usuario estándar | Usuario restringido | Público |

## 19.2 Gobierno de datos
- Retención: cuánto tiempo se guardan los datos
- Purga: política de eliminación automática
- Auditoría: qué operaciones se logean
- RGPD: derecho al olvido, exportación

## 19.3 Secrets management
| Secret | Descripción | Rotación | Dónde se usa |

IMPORTANTE: Genera SOLO secciones 15-19. Termina con: ---END_PART_4---`;
};

// ── PRD PART 5: Secciones 20-24 (UX, Telemetría, Riesgos, Fases, Matriz) ──
export const buildPrdPart5Prompt = (params: {
  part1Output: string;
  part2Output: string;
  part3Output: string;
  part4Output: string;
}) => `PARTES 1-4 YA GENERADAS (para continuidad):
PARTE 1 (resumen): ${params.part1Output.substring(0, 3000)}
PARTE 2 (ontología/variables): ${params.part2Output.substring(0, 3000)}
PARTE 3 (flujos/módulos): ${params.part3Output.substring(0, 3000)}
PARTE 4 (scoring/SQL): ${params.part4Output.substring(0, 3000)}

GENERA LAS SECCIONES 20 A 24 DEL PRD LOW-LEVEL EN MARKDOWN:

# 20. UX Y WIREFRAMES TEXTUALES

Para CADA pantalla del producto:

## 20.X Pantalla: [Nombre] — Ruta: [/ruta]
- **Acceso**: Rol(es) que acceden
- **Layout**: Sidebar/Header/Grid — describir estructura
- **Componentes visibles**:
  - Card/Tabla/Formulario/Gráfico con datos específicos
  - Variables del catálogo que se muestran
  - Acciones disponibles (botones, filtros, ordenamiento)
- **Estados**:
  - Loading: skeleton/spinner
  - Empty: mensaje + CTA
  - Error: mensaje + retry
  - Success: feedback visual
- **Query Supabase**: query exacta que alimenta los datos
- **Responsive**: cómo cambia en mobile (stack vertical, hide sidebar, etc.)
- **Interacciones clave**: click → qué pasa, hover → qué muestra

# 21. TELEMETRÍA Y ANALÍTICA

## 21.1 Eventos a trackear
| Evento | Trigger | Datos capturados | Tabla destino | Variables del catálogo |

## 21.2 KPIs del dashboard admin
| KPI | Query SQL exacta | Frecuencia actualización | Alerta si... |

## 21.3 Alertas automáticas
| Condición | Acción | Canal | Patrones relacionados (PAT-xxx) |

## 21.4 Dashboard de salud del sistema
- Métricas de Edge Functions (latencia, errores, invocaciones)
- Frescura de datos por fuente
- Coste IA acumulado

# 22. RIESGOS Y MITIGACIONES

| ID | Riesgo | Probabilidad | Impacto | Mitigación técnica | Responsable | Indicador de activación | Patrón relacionado |

Incluir riesgos técnicos, de negocio, de datos y de adopción.

# 23. PLAN DE FASES

Para CADA fase:
## Fase X: [Nombre] (X semanas)
- **Pantallas nuevas**: lista con rutas
- **Tablas nuevas**: lista con nombres
- **Edge Functions nuevas**: lista
- **Variables nuevas del catálogo**: cuáles se activan en esta fase
- **Patrones nuevos**: cuáles se activan en esta fase
- **Componentes nuevos**: lista
- **Criterio de éxito**: medible con query SQL
- **Coste estimado**: rango
- **Dependencias de fase anterior**: qué debe estar listo

# 24. MATRIZ DE DESPLIEGUE

| Componente/Feature | Core MVP | Alpha Edge | Experimental | Descartado | Justificación |

Clasificar CADA feature del proyecto:
- **Core MVP**: Imprescindible para el producto mínimo viable. Sin esto no hay producto.
- **Alpha Edge**: Aporta valor diferencial. Se activa tras validar Core. Flag feature.
- **Experimental**: Hipótesis a validar. Puede pivotar o eliminarse. Detrás de feature flag.
- **Descartado**: Se evaluó y se descartó con motivo documentado.

IMPORTANTE: Genera SOLO secciones 20-24. Termina con: ---END_PART_5---`;

// ── PRD PART 6: Blueprint + Checklist + Specs + Glosario ──
export const buildPrdPart6Prompt = (params: {
  part1Output: string;
  part2Output: string;
  part3Output: string;
  part4Output: string;
  part5Output: string;
  targetPhase?: string;
  servicesDecision?: {
    rag?: { necesario: boolean; dominio_sugerido?: string };
    pattern_detector?: { necesario: boolean; sector_sugerido?: string };
    deployment_mode?: string;
  };
}) => {
  let secretsBlock = "";
  let proxyBlock = "";
  if (params.servicesDecision?.rag?.necesario) {
    secretsBlock += `\n| AGUSTITO_RAG_URL | Endpoint servicio RAG | ManIAS Lab. |\n| AGUSTITO_RAG_KEY | API key del RAG | ManIAS Lab. |\n| AGUSTITO_RAG_ID | ID del proyecto RAG | ManIAS Lab. |`;
    proxyBlock += `\n### Edge Function: rag-proxy\n- Trigger: POST (usuario autenticado)\n- Proceso: auth → POST server-to-server → { answer, citations, confidence }\n- Fallback: "Base de conocimiento no disponible"`;
  }
  if (params.servicesDecision?.pattern_detector?.necesario) {
    secretsBlock += `\n| AGUSTITO_PATTERNS_URL | Endpoint detector | ManIAS Lab. |\n| AGUSTITO_PATTERNS_KEY | API key patrones | ManIAS Lab. |\n| AGUSTITO_PATTERNS_RUN_ID | ID run patrones | ManIAS Lab. |`;
    proxyBlock += `\n### Edge Function: patterns-proxy\n- Trigger: POST (usuario autenticado)\n- Proceso: auth → POST server-to-server → { layers, composite_scores, model_verdict }\n- Fallback: "Análisis no disponible"`;
  }
  const secretsSection = secretsBlock ? `\n\n## Secrets (Supabase Vault)\n| Secret | Descripción | Configurado por |\n| SUPABASE_URL | URL del proyecto | Auto |\n| SUPABASE_ANON_KEY | Key pública | Auto |${secretsBlock}` : "";
  const proxySection = proxyBlock ? `\n\n## Edge Functions Proxy${proxyBlock}` : "";

  return `PARTES 1-5 DEL PRD YA GENERADAS:
PARTE 1: ${params.part1Output.substring(0, 2000)}
PARTE 2: ${params.part2Output.substring(0, 2000)}
PARTE 3: ${params.part3Output.substring(0, 2000)}
PARTE 4: ${params.part4Output.substring(0, 2000)}
PARTE 5: ${params.part5Output.substring(0, 2000)}

FASE OBJETIVO PARA EL BLUEPRINT: ${params.targetPhase || "Fase 0 + Fase 1 (MVP)"}

Genera TRES bloques separados:

---

# LOVABLE BUILD BLUEPRINT

> Diseñado para copiarse y pegarse DIRECTAMENTE en Lovable.dev.
> SOLO lo necesario para la fase indicada. NO funcionalidades futuras.

## Contexto
[2-3 líneas: qué es la app, para quién, qué fase]

## Stack
React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Supabase
Deps npm: react-router-dom, @supabase/supabase-js, lucide-react, recharts

## Pantallas y Rutas
| Ruta | Componente | Acceso | Descripción |
(SOLO pantallas de la fase objetivo)

## Wireframes Textuales
Para CADA pantalla: layout, componentes, estados, query Supabase

## Componentes Reutilizables
| Componente | Descripción | Usado en |

## Base de Datos
\`\`\`sql
-- SOLO tablas de esta fase con RLS y Storage buckets
\`\`\`

## Edge Functions
Para cada una: nombre, trigger, proceso, fallback, secrets${proxySection}

## Design System
Colores, tipografía, bordes, sombras, tono visual${secretsSection}

## Auth Flow
Supabase Auth con email+password. Redirect post-login según rol.

## QA Checklist
- [ ] Todas las rutas cargan sin error
- [ ] Auth funciona (registro + login + redirect por rol)
- [ ] RLS impide acceso no autorizado
- [ ] Estados vacíos muestran mensaje apropiado
- [ ] Edge Functions responden correctamente
- [ ] Responsive en mobile

---

# CHECKLIST MAESTRO DE CONSTRUCCIÓN

## P0 — Bloquea el lanzamiento
- [ ] item (con tabla/pantalla/función concreta)

## P1 — Importante, no bloquea
- [ ] item

## P2 — Deseable, post-lanzamiento
- [ ] item

Lista EXHAUSTIVA de cada ítem que debe construirse, agrupada por prioridad.
Cada ítem referencia la sección del PRD de donde viene (ej: "RF-003, Sección 12").

---

# SPECS PARA FASES POSTERIORES DEL PIPELINE

## D1 — Spec RAG (Fase 8)
- Fuentes de conocimiento
- Estrategia de chunking
- Quality gates
- Categorías
- Endpoints de consulta

## D2 — Spec Detector de Patrones (Fase 9)
- Señales a analizar
- Output esperado
- Métricas de calidad

# 25. GLOSARIO Y ANEXOS

## 25.1 Glosario de términos del dominio
| Término | Definición | Contexto de uso |

## 25.2 Referencias
- Fuentes de datos externas con URLs
- APIs de terceros con documentación
- Normativa aplicable

Termina con: ---END_PART_6---`;
};


// ── PRD VALIDATION CALL (Call 7 — auditoría cruzada del propio PRD) ────────
// Modelo: Claude Sonnet 4 (auditor, no generador)
// Config: max_tokens: 4096, temperature: 0.2

export const PRD_VALIDATION_SYSTEM_PROMPT = `Eres un auditor técnico de PRDs low-level. Recibes las 6 partes de un PRD y verificas su consistencia interna. NO reescribes nada — solo señalas problemas.

REGLAS:
- Verifica que los nombres de módulos son IDÉNTICOS entre todas las partes.
- Verifica que las variables del catálogo (sección 6) se referencian correctamente en patrones (sección 7), scoring (sección 15), y Edge Functions (sección 17).
- Verifica que los patrones (sección 7) usan variables que existen en el catálogo.
- Verifica que los nombres de tablas SQL (sección 16) coinciden con las entidades de la ontología (sección 5).
- Verifica que cada pantalla del Blueprint tiene wireframe textual (sección 20).
- Verifica que cada Edge Function del Blueprint está documentada en sección 17.
- Verifica que las fases son consistentes (sin saltos ni contradicciones).
- Verifica que los RLS policies cubren todos los flujos de acceso.
- Verifica que el stack es SOLO React+Vite+Supabase.
- Verifica que los nombres propios están correctamente escritos.
- Verifica que la matriz de despliegue (sección 24) cubre TODAS las features del alcance.
- Verifica que el checklist maestro referencia secciones reales del PRD.
- Responde SOLO con JSON válido.`;

export const buildPrdValidationPrompt = (params: {
  part1: string;
  part2: string;
  part3: string;
  part4: string;
  part5: string;
  part6: string;
}) => `PRD PARTE 1 (Resumen, Marco, Principios, Métricas):
${params.part1}

PRD PARTE 2 (Ontología, Variables, Patrones, Alcance, Personas):
${params.part2}

PRD PARTE 3 (Flujos, Módulos, RF, NFR, IA):
${params.part3}

PRD PARTE 4 (Scoring, SQL, Edge Functions, Integraciones, Seguridad):
${params.part4}

PRD PARTE 5 (UX, Telemetría, Riesgos, Fases, Matriz):
${params.part5}

PRD PARTE 6 (Blueprint, Checklist, Specs, Glosario):
${params.part6}

Analiza las 6 partes y devuelve:
{
  "consistencia_global": 0-100,
  "issues": [
    {
      "id": "PRD-V-001",
      "severidad": "CRÍTICO/IMPORTANTE/MENOR",
      "tipo": "NOMBRE_INCONSISTENTE/TABLA_FALTANTE/VARIABLE_HUERFANA/PATRON_SIN_VARIABLES/PANTALLA_SIN_WIREFRAME/RLS_INCOMPLETO/STACK_INCORRECTO/FASE_INCONSISTENTE/TYPO_NOMBRE_PROPIO/CHECKLIST_REF_INVALIDA",
      "descripción": "descripción concreta del problema",
      "ubicación": "en qué parte(s) y sección(es) se detecta",
      "corrección_sugerida": "qué debería decir"
    }
  ],
  "resumen": "X issues encontrados: Y críticos, Z importantes. [Veredicto]",
  "cobertura": {
    "variables_referenciadas": "X de Y del catálogo",
    "patrones_con_variables": "X de Y tienen variables válidas",
    "tablas_con_rls": "X de Y tienen policies",
    "pantallas_con_wireframe": "X de Y tienen wireframe"
  },
  "nombres_verificados": {
    "empresa_cliente": "nombre correcto según briefing",
    "stakeholders": ["nombre1 — OK/INCORRECTO"],
    "producto": "nombre correcto"
  }
}`;

// ── FASE 8: Generación de RAGs ─────────────────────────────────────────────
// Modelo: Claude Sonnet 4
// Config: max_tokens: 8192, temperature: 0.3

export const RAG_GEN_SYSTEM_PROMPT = `Eres un ingeniero de RAG (Retrieval Augmented Generation) especializado en construir bases de conocimiento para asistentes de IA de proyectos. Tu trabajo es tomar toda la documentación de un proyecto y organizarla en chunks semánticos óptimos para retrieval.

REGLAS:
- Genera entre 45-60 chunks para proyectos medianos. Escala proporcionalmente para proyectos más grandes o pequeños.
- Cada chunk DEBE ser autocontenido: un desarrollador que lea SOLO ese chunk debe entender lo que describe sin necesidad de contexto adicional. No uses pronombres sin antecedente ni referencias a "lo anterior".
- Tamaño óptimo: 200-500 tokens por chunk.
- Incluye la distribución por categoría al inicio:
  - Funcionalidad: 18-22 chunks (uno por módulo + subfuncionalidades clave)
  - Decisión: 10-15 chunks (una por decisión confirmada, con contexto Y alternativas descartadas)
  - Arquitectura: 6-8 chunks (stack, modelo de datos, integraciones, despliegue)
  - Proceso: 5-6 chunks (flujos de usuario paso a paso)
  - Dato clave: 4-5 chunks (cifras, presupuesto, tarifas, estructura del negocio)
  - FAQ: 8-10 chunks (preguntas anticipadas del equipo con respuestas DETALLADAS)
- Los chunks de FAQ deben explicar el "POR QUÉ" de las decisiones, no solo el "qué". Ejemplo: "¿Por qué no se integra con la API del banco para combustible? Se evaluó integración con X y Y, pero se descartó para el MVP por tres razones: (1)... (2)... (3)... Se mantiene como evolución futura P2."
- Los chunks de decisión deben incluir: qué se decidió, por qué, y qué alternativa se descartó con su motivo.
- INCLUIR chunks específicos de Lovable: stack, estructura de carpetas esperada, convenciones de naming, componentes shadcn usados.
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

Genera la estructura RAG completa. Cada chunk debe ser autocontenido y comprensible de forma independiente. Formato JSON:
{
  "proyecto": "${params.projectName}",
  "total_chunks": número,
  "distribución_por_categoría": {
    "funcionalidad": "18-22 chunks",
    "decisión": "10-15 chunks",
    "arquitectura": "6-8 chunks",
    "proceso": "5-6 chunks",
    "dato_clave": "4-5 chunks",
    "faq": "8-10 chunks"
  },
  "categorías": ["arquitectura", "funcionalidad", "decisión", "integración", "faq", "proceso", "dato_clave"],
  "chunks": [
    {
      "id": "CHK-001",
      "categoría": "funcionalidad",
      "módulo": "nombre del módulo",
      "fase": "Fase X",
      "prioridad": "P0/P1/P2",
      "título": "título descriptivo corto (ej: 'OCR Albaranes')",
      "contenido": "texto autocontenido de 200-500 tokens. DEBE incluir: qué hace, cómo funciona técnicamente, datos clave (volúmenes, costes, precisión), y cualquier restricción. Un desarrollador que lea SOLO este chunk debe poder implementar o entender esta parte sin leer nada más. Ejemplo: 'El sistema procesa albaranes mediante fotografía desde la app móvil del conductor. Google Vision API extrae el texto crudo y Claude Haiku estructura los datos en JSON (fecha, origen, destino, peso, nº albarán). La precisión objetivo es >92%. Si la confianza del OCR es inferior al 80%, el albarán se marca para revisión manual. Se estiman 660 albaranes/mes (30/día × 22 días). Coste API: 40-80€/mes.'",
      "tags": ["tag1", "tag2", "tag3"],
      "preguntas_relacionadas": ["¿cómo funciona X?", "¿qué pasa si Y?"],
      "dependencias": ["CHK-003", "CHK-015"],
      "fuente": "PRD sección 4.2 / Briefing / Reunión original"
    }
  ],
  "faqs_generadas": [
    {
      "id": "CHK-FAQ-001",
      "pregunta": "pregunta anticipada del equipo de desarrollo",
      "respuesta": "respuesta DETALLADA que explica el 'por qué' de la decisión, no solo el 'qué'. Incluir: contexto, alternativas evaluadas, razones de descarte, y evolución futura si aplica. Ejemplo: '¿Por qué no se integra con la API del banco? Se evaluó integración con X y Y, pero se descartó para MVP por: (1) tarjetas personales no corporativas, (2) complejidad de mapeo, (3) registro manual suficiente para calcular eficiencia. Se mantiene como evolución P2.'",
      "chunks_relacionados": ["CHK-001", "CHK-005"]
    }
  ],
  "embeddings_config": {
    "modelo_recomendado": "text-embedding-3-small (OpenAI) — buen soporte español, bajo coste",
    "dimensiones": 1536,
    "chunk_overlap": 50,
    "separador_recomendado": "Splitting semántico por módulo/decisión, no por longitud fija. Cada chunk corresponde a una unidad lógica de información."
  }
}`;

// ── FASE 9: Detección de Patrones ──────────────────────────────────────────
// Modelo: Claude Sonnet 4
// Config: max_tokens: 8192, temperature: 0.5

export const PATTERNS_SYSTEM_PROMPT = `Eres un analista de negocio senior especializado en detectar patrones recurrentes en proyectos tecnológicos. Tu análisis tiene dos objetivos: (1) identificar componentes reutilizables que aceleren futuros proyectos similares, y (2) detectar oportunidades comerciales (upselling, cross-selling, servicios recurrentes) con pitches listos para usar.

REGLAS:
- Los patrones deben ser CONCRETOS y ACCIONABLES, no observaciones genéricas.
- Cada patrón técnico debe tener un "componente_extraíble" con NOMBRE DE PRODUCTO (ej: "DocCapture", "StepFlow", "FleetDash") — como si fuera un módulo que vendes.
- Las oportunidades comerciales deben incluir un pitch textual LISTO PARA USAR en una reunión (1-2 frases naturales, no corporativas).
- El timing de cada oportunidad debe ser concreto: "Cuando lleven 2-3 meses usando X" o "Al cerrar Fase 3", no "en el futuro".
- El score del cliente debe ser una tabla con dimensiones específicas + siguiente contacto con fecha concreta y motivo.
- Las señales de necesidades futuras deben tener timing concreto y acción preventiva.
- Los aprendizajes del proceso deben ser aplicables al pipeline interno de la agencia.
- REGLA DE ESTIMACIÓN CONSERVADORA: Los valores estimados en oportunidades comerciales deben usar el ESCENARIO BAJO. Si hay incertidumbre, usa el 50% del valor optimista. Los rangos de "Lifetime value estimado" deben ser conservadores — es mejor subestimar que sobreestimar.
- REGLA DE FRAUDE/ANOMALÍAS: Si algún patrón u oportunidad involucra detección de fraude o anomalías, NO estimes valor monetario sin datos reales. Usa "potencial de detección sin cuantificar" en su lugar.
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
- Nombre: ManIAS Lab.
- Servicios: Desarrollo tecnológico, IA aplicada, marketing digital, consultoría
- Proyectos previos relevantes: ${params.previousProjectsSummary || "No disponible"}

Genera análisis de patrones con este formato JSON:
{
  "resumen": "valoración general en 2-3 frases: qué patrones se detectan, cuántas oportunidades comerciales, potencial del cliente",
  "patrones_técnicos": [
    {
      "id": "PAT-001",
      "patrón": "nombre descriptivo (ej: 'Pipeline OCR → IA → Validación humana')",
      "descripción": "qué es el patrón en 1-2 frases (ej: 'Foto → Vision API → LLM estructurador → UI de confirmación')",
      "reutilizable": true,
      "componente_extraíble": "nombre de producto + descripción (ej: 'Módulo DocCapture — config de campos por tipo de documento, pipeline de procesamiento, UI de validación')",
      "proyectos_aplicables": "tipos concretos de proyectos (ej: 'Gestión de facturas, partes de trabajo, informes médicos, formularios de campo')",
      "ahorro_estimado": "horas concretas (ej: '30-50h por proyecto futuro similar')"
    }
  ],
  "oportunidades_comerciales": [
    {
      "id": "OPP-001",
      "oportunidad": "descripción concreta (ej: 'Mantenimiento y soporte mensual')",
      "tipo": "UPSELL / CROSS_SELL / SERVICIO_RECURRENTE / NUEVO_PROYECTO",
      "timing": "cuándo proponerlo — concreto (ej: 'Al cerrar Fase 3' o 'Cuando lleven 2-3 meses usando la exportación Excel')",
      "valor_estimado": "€/mes o €/proyecto con rango (ej: '300-500€/mes' o '3.000-5.000€ desarrollo + 100€/mes mantenimiento')",
      "probabilidad": "alta/media/baja",
      "pitch_sugerido": "frase NATURAL lista para usar en reunión (ej: 'Con 40 camiones generando datos diarios y un motor de IA que mejora con el uso, recomendamos un servicio de mantenimiento que incluye actualizaciones, monitoreo de precisión IA y soporte técnico.')"
    }
  ],
  "señales_necesidades_futuras": [
    {
      "señal": "qué dijo o hizo el cliente que indica necesidad futura (cita o referencia concreta)",
      "necesidad_inferida": "qué necesitará",
      "cuándo": "estimación temporal concreta (ej: 'Cuando el sistema de incentivos lleve 3+ meses funcionando')",
      "acción": "qué hacer AHORA para posicionarse (ej: 'Diseñar la integración con nóminas como módulo opcional en la arquitectura actual')"
    }
  ],
  "aprendizajes_proceso": [
    {
      "aprendizaje": "qué se aprendió de este proyecto para el pipeline interno",
      "aplicable_a": "procesos internos / futuros proyectos / pipeline de ventas",
      "acción_sugerida": "cambio concreto a implementar en la agencia"
    }
  ],
  "score_cliente": {
    "dimensiones": [
      {"dimensión": "Potencial recurrencia", "valoración": "alto/medio/bajo", "notas": "justificación breve (ej: 'Mantenimiento + evoluciones + datos crecientes')"},
      {"dimensión": "Potencial referidos", "valoración": "alto/medio/bajo", "notas": "justificación (ej: 'Sector transporte con empresas similares en su entorno')"},
      {"dimensión": "Complejidad relación", "valoración": "alta/media/baja", "notas": "justificación (ej: 'Gap presupuestario, múltiples decisores')"},
      {"dimensión": "Lifetime value estimado", "valoración": "rango € (ej: '15.000-50.000€')", "notas": "desglose (ej: 'Desarrollo inicial + 2-3 años mantenimiento + upsells')"}
    ],
    "siguiente_contacto_recomendado": {
      "fecha": "fecha concreta o relativa (ej: 'Semana del 3 marzo 2026')",
      "motivo": "qué presentar o discutir (ej: 'Presentar documento corregido + propuesta Fase 0')"
    }
  }
}`;

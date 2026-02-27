// ── Project Pipeline Prompts ────────────────────────────────────────────────
// Sprint 1: Steps 1-3. Steps 4-9 prompts will be added in future sprints.

export const STEP_NAMES = [
  "Entrada del Proyecto",        // 0 → step 1
  "Extracción Inteligente",      // 1 → step 2
  "Documento de Alcance",        // 2 → step 3
  "Auditoría Cruzada",           // 3 → step 4 (Sprint 2)
  "Documento Final",             // 4 → step 5 (Sprint 2)
  "AI Leverage",                 // 5 → step 6 (Sprint 3)
  "PRD Técnico",                 // 6 → step 7 (Sprint 3)
  "Generación de RAGs",          // 7 → step 8 (Sprint 4)
  "Detección de Patrones",       // 8 → step 9 (Sprint 4)
] as const;

export const STEP_MODELS: Record<number, string> = {
  2: "gemini-flash",      // Extracción → Gemini Flash
  3: "claude-sonnet",      // Documento de Alcance → Claude Sonnet (streaming)
  // 4: "gemini-pro",      // Auditoría Cruzada → Sprint 2
  // 5: "claude-sonnet",   // Documento Final → Sprint 2
};

// ── Step 2: Extraction prompt ──────────────────────────────────────────────

export const EXTRACTION_SYSTEM_PROMPT = `Eres un analista de proyectos experto. Tu trabajo es extraer la esencia de una conversación, transcripción o documento y convertirla en un briefing estructurado.

REGLAS:
- Sé conciso y preciso. No inventes información que no esté en el input.
- Si algo no está claro, márcalo como [PENDIENTE DE CONFIRMAR].
- Usa el idioma del input (si está en español, responde en español).
- El briefing debe ser suficiente para que otro profesional entienda el proyecto sin leer el material original.`;

export const buildExtractionPrompt = (params: {
  projectName: string;
  companyName: string;
  projectType: string;
  clientNeed: string | null;
  inputContent: string;
}) => `
INPUT DEL USUARIO:
Nombre del proyecto: ${params.projectName}
Empresa: ${params.companyName}
Tipo de proyecto: ${params.projectType}
Necesidad declarada por el cliente: ${params.clientNeed || "No proporcionada, extraer del material"}

Material de entrada:
${params.inputContent}

GENERA UN BRIEFING CON ESTA ESTRUCTURA EXACTA (formato JSON):
{
  "resumen_ejecutivo": "2-3 frases que capturan la esencia del proyecto",
  "cliente": {
    "empresa": "nombre",
    "sector": "sector del cliente",
    "tamaño_estimado": "startup/pyme/gran empresa",
    "contexto_relevante": "cualquier dato relevante del cliente"
  },
  "necesidad_principal": "la necesidad core en 1-2 frases",
  "objetivos": ["objetivo 1 concreto y medible", "objetivo 2", "objetivo 3"],
  "problemas_detectados": ["problema o pain point 1", "problema 2"],
  "alcance_preliminar": {
    "incluido": ["qué entra en el proyecto"],
    "excluido": ["qué NO entra"],
    "supuestos": ["supuestos clave"]
  },
  "stakeholders": [{"nombre": "...", "rol": "...", "relevancia": "decisor/usuario/técnico"}],
  "restricciones": ["tiempo, presupuesto, tecnología, etc."],
  "datos_faltantes": ["información que necesitaríamos pedir al cliente"],
  "nivel_complejidad": "bajo/medio/alto/muy alto",
  "urgencia": "baja/media/alta/crítica"
}`;

// ── Step 3: Scope Document prompt ──────────────────────────────────────────

export const SCOPE_SYSTEM_PROMPT = `Eres un director de proyectos senior especializado en consultoría tecnológica y marketing digital. Generas documentos de alcance profesionales que podrían presentarse directamente a un comité de dirección.

ESTILO:
- Profesional pero accesible. Evita jerga innecesaria.
- Estructura clara con secciones numeradas.
- Incluye recomendaciones concretas, no solo descripción.
- Cuantifica cuando sea posible (plazos, métricas, recursos).
- Idioma: español (España).`;

export const buildScopePrompt = (params: {
  briefingJson: string;
  contactName: string;
  currentDate: string;
}) => `
BRIEFING APROBADO:
${params.briefingJson}

DATOS ADICIONALES:
Empresa ejecutora: Agustito
Contacto: ${params.contactName}
Fecha: ${params.currentDate}

GENERA UN DOCUMENTO DE ALCANCE CON ESTA ESTRUCTURA:

# 1. PORTADA
- Título del proyecto
- Cliente
- Fecha
- Versión: 1.0

# 2. RESUMEN EJECUTIVO
- Contexto del cliente y su necesidad (2-3 párrafos)
- Propuesta de valor (qué resolvemos y por qué somos los indicados)
- Resultado esperado (qué tendrá el cliente al final)

# 3. OBJETIVOS DEL PROYECTO
- Objetivo general
- Objetivos específicos (SMART: específicos, medibles, alcanzables, relevantes, con plazo)

# 4. ALCANCE DETALLADO
## 4.1 Entregables incluidos (lista detallada)
## 4.2 Exclusiones explícitas (lo que NO incluye)
## 4.3 Supuestos y dependencias

# 5. METODOLOGÍA
- Enfoque propuesto (fases, sprints, iteraciones)
- Herramientas y tecnologías clave
- Equipo propuesto (roles, no personas)

# 6. CRONOGRAMA ESTIMADO
- Fases con duración estimada
- Hitos principales
- Fecha estimada de entrega

# 7. INVERSIÓN
- Estructura de precios (si aplica, sino marcar [A DEFINIR])
- Condiciones de pago
- Qué incluye y qué no

# 8. RIESGOS Y MITIGACIÓN
- Top 3-5 riesgos identificados
- Plan de mitigación para cada uno

# 9. PRÓXIMOS PASOS
- Acciones inmediatas requeridas
- Qué necesitamos del cliente para arrancar
- Timeline de arranque`;

// Sprint 2: AuditFinding type for Step 4
// export interface AuditFinding {
//   severidad: "CRÍTICO" | "IMPORTANTE" | "MENOR" | "SUGERENCIA";
//   seccion: string;
//   problema: string;
//   sugerencia: string;
//   ejemplo?: string;
// }

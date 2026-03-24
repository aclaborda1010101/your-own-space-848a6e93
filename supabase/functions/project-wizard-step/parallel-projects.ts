/**
 * parallel-projects.ts — Detection & filtering of parallel projects in PRD pipeline
 * Extracted from index.ts to reduce bundle size.
 */

export interface ParallelProject {
  name: string;
  evidence: string;
  reason: "context" | "future_idea" | "other_vertical" | "separate_client";
}

/**
 * A) F2 Post-Process: Detect parallel projects mentioned in transcription/input.
 */
export function detectParallelProjects(inputText: string, briefing: any): ParallelProject[] {
  if (!inputText || typeof inputText !== "string") return [];

  const markers: Array<{ pattern: RegExp; reason: ParallelProject["reason"] }> = [
    { pattern: /(?:en\s+otro\s+proyecto|de\s+otro\s+proyecto|el\s+otro\s+proyecto)/gi, reason: "other_vertical" },
    { pattern: /(?:para\s+otro\s+cliente|de\s+otro\s+cliente|otro\s+cliente)/gi, reason: "separate_client" },
    { pattern: /(?:otra\s+vertical|otras?\s+verticales|otro\s+negocio)/gi, reason: "other_vertical" },
    { pattern: /(?:más\s+adelante|en\s+el\s+futuro|a\s+futuro|para\s+después|cuando\s+terminemos\s+esto)/gi, reason: "future_idea" },
    { pattern: /(?:en\s+paralelo|por\s+separado|aparte\s+de\s+esto|independientemente)/gi, reason: "context" },
    { pattern: /(?:también\s+estamos\s+con|lo\s+de\s+\w+\s+que\s+vimos|lo\s+otro\s+que)/gi, reason: "context" },
    { pattern: /(?:no\s+tiene\s+que\s+ver\s+con|fuera\s+de\s+esto|otro\s+tema\s+(?:es|sería))/gi, reason: "context" },
  ];

  const inScopeNames = new Set<string>();
  try {
    if (briefing?.alcance_preliminar?.incluido && Array.isArray(briefing.alcance_preliminar.incluido)) {
      for (const item of briefing.alcance_preliminar.incluido) {
        const names = [item.funcionalidad, item.módulo, item.modulo].filter(Boolean);
        for (const n of names) inScopeNames.add(n.toLowerCase().trim());
      }
    }
    if (briefing?.solution_candidates && Array.isArray(briefing.solution_candidates)) {
      for (const item of briefing.solution_candidates) {
        if (item.title) inScopeNames.add(item.title.toLowerCase().trim());
      }
    }
    if (briefing?.observed_facts && Array.isArray(briefing.observed_facts)) {
      for (const item of briefing.observed_facts) {
        if (item.title) inScopeNames.add(item.title.toLowerCase().trim());
      }
    }
  } catch { /* ignore */ }

  const sentences = inputText.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 10);
  const detected: ParallelProject[] = [];
  const seenNames = new Set<string>();

  for (const sentence of sentences) {
    for (const { pattern, reason } of markers) {
      pattern.lastIndex = 0;
      if (pattern.test(sentence)) {
        let name = "";
        const quotedMatch = sentence.match(/["«"']([^"»"']+)["»"']/);
        const loDeMatch = sentence.match(/lo\s+de\s+(\w[\w\s]{2,30}?)(?:\s+que|\s*[,.])/i);
        const proyectoMatch = sentence.match(/(?:proyecto|iniciativa|plataforma|app|vertical)\s+(?:de\s+)?(\w[\w\s]{2,30}?)(?:\s*[,.]|\s+(?:que|para|con|es|y))/i);

        if (quotedMatch) name = quotedMatch[1].trim();
        else if (loDeMatch) name = loDeMatch[1].trim();
        else if (proyectoMatch) name = proyectoMatch[1].trim();
        else {
          const afterMarker = sentence.substring(sentence.search(pattern));
          const words = afterMarker.split(/\s+/).slice(0, 8);
          name = words.join(" ");
        }

        if (!name || name.length < 3) continue;

        const nameLower = name.toLowerCase();
        let isInScope = false;
        for (const scopeName of inScopeNames) {
          if (nameLower.includes(scopeName) || scopeName.includes(nameLower)) {
            isInScope = true;
            break;
          }
        }
        if (isInScope) continue;

        if (seenNames.has(nameLower)) continue;
        seenNames.add(nameLower);

        detected.push({ name, evidence: sentence.substring(0, 200), reason });
        break;
      }
    }
  }

  return detected;
}

/**
 * B) F3/F5 Post-Process: Inject parallel project exclusions into the document.
 */
export function injectParallelProjectExclusions(document: string, parallelProjects: ParallelProject[] | undefined): string {
  if (!parallelProjects || parallelProjects.length === 0 || !document) return document;

  const reasonLabels: Record<string, string> = {
    context: "contexto de reunión",
    future_idea: "idea futura",
    other_vertical: "otra vertical/proyecto",
    separate_client: "proyecto de otro cliente",
  };

  const block = `\n\n### Proyectos paralelos mencionados (fuera de alcance)\nLos siguientes proyectos/iniciativas fueron mencionados durante la reunión como contexto pero **NO forman parte del alcance** del presente proyecto:\n${parallelProjects.map(p =>
    `- **${p.name}**: Mencionado como ${reasonLabels[p.reason] || "contexto"}. No forma parte del alcance del presente proyecto.`
  ).join("\n")}\n`;

  const exclusionesPatterns = [
    /^(#{1,3}\s*(?:\d+\.?\d*\.?\s*)?Exclusiones\s*(?:Explícitas|del\s+proyecto)?.*$)/mi,
    /^(#{1,3}\s*5\.4\s+Exclusiones.*$)/mi,
    /^(#{1,3}\s*Exclu(?:siones|ido).*$)/mi,
  ];

  for (const pattern of exclusionesPatterns) {
    const match = document.match(pattern);
    if (match && match.index !== undefined) {
      const headingLevel = (match[1].match(/^#+/) || ["#"])[0].length;
      const afterSection = document.substring(match.index + match[1].length);
      const nextHeadingMatch = afterSection.match(new RegExp(`^#{1,${headingLevel}}\\s`, "m"));

      if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
        const insertPos = match.index + match[1].length + nextHeadingMatch.index;
        return document.substring(0, insertPos) + block + "\n" + document.substring(insertPos);
      } else {
        return document + block;
      }
    }
  }

  const supuestosMatch = document.match(/^(#{1,3}\s*(?:\d+\.?\d*\.?\s*)?Supuestos)/mi);
  if (supuestosMatch && supuestosMatch.index !== undefined) {
    return document.substring(0, supuestosMatch.index) + "## 5.4 Exclusiones Explícitas\n" + block + "\n\n" + document.substring(supuestosMatch.index);
  }

  const section6Match = document.match(/^#{1,2}\s*6[\.\s]/m);
  if (section6Match && section6Match.index !== undefined) {
    return document.substring(0, section6Match.index) + "\n## Exclusiones Explícitas\n" + block + "\n\n" + document.substring(section6Match.index);
  }

  return document + "\n\n## Exclusiones Explícitas\n" + block;
}

/**
 * C) F4 Post-Process: Filter audit findings that match parallel projects.
 */
export function filterParallelProjectFindings(
  auditJson: any,
  parallelProjects: ParallelProject[] | undefined,
  documentText?: string
): any {
  if (!auditJson || !auditJson.hallazgos) return auditJson;

  const ppNames: string[] = [];

  if (parallelProjects && parallelProjects.length > 0) {
    for (const pp of parallelProjects) {
      ppNames.push(pp.name.toLowerCase());
    }
  }

  if (documentText) {
    const ppSection = documentText.match(/###?\s*Proyectos paralelos mencionados[\s\S]*?(?=\n#{1,3}\s|\n---|\$)/i);
    if (ppSection) {
      const bulletMatches = ppSection[0].matchAll(/\*\*([^*]+)\*\*/g);
      for (const m of bulletMatches) {
        const extracted = m[1].toLowerCase().trim();
        if (extracted && !ppNames.includes(extracted)) ppNames.push(extracted);
      }
    }
  }

  if (ppNames.length === 0) return auditJson;

  const hallazgosOpen: any[] = [];
  const hallazgosNoAplica: any[] = auditJson.hallazgos_no_aplica || [];
  let filteredCrit = 0, filteredImp = 0, filteredMen = 0;

  for (const h of auditJson.hallazgos) {
    const desc = (h.descripción || h.descripcion || "").toLowerCase();
    const seccion = (h.sección_afectada || h.seccion_afectada || "").toLowerCase();
    const searchText = desc + " " + seccion;

    let isParallel = false;
    for (const ppName of ppNames) {
      const ppWords = ppName.split(/\s+/).filter(w => w.length >= 3);
      const matchCount = ppWords.filter(w => searchText.includes(w)).length;
      if (matchCount >= Math.max(1, Math.ceil(ppWords.length * 0.6))) {
        isParallel = true;
        break;
      }
    }

    if (isParallel && (h.tipo === "OMISIÓN" || h.tipo === "OMISION")) {
      h.tipo_original = h.tipo;
      h.tipo = "NO_APLICA";
      h.nota_filtro = "[[NO_APLICA:proyecto_paralelo_mencionado]]";
      hallazgosNoAplica.push(h);

      const sev = (h.severidad || "").toUpperCase();
      if (sev === "CRÍTICO" || sev === "CRITICO") filteredCrit++;
      else if (sev === "IMPORTANTE") filteredImp++;
      else filteredMen++;
    } else {
      hallazgosOpen.push(h);
    }
  }

  auditJson.hallazgos = hallazgosOpen;
  auditJson.hallazgos_no_aplica = hallazgosNoAplica;

  if (filteredCrit + filteredImp + filteredMen > 0) {
    const summary = auditJson.resumen_hallazgos || {};
    summary.total = (summary.total || 0) - (filteredCrit + filteredImp + filteredMen);
    summary.críticos = (summary.críticos || summary.criticos || 0) - filteredCrit;
    summary.importantes = (summary.importantes || 0) - filteredImp;
    summary.menores = (summary.menores || 0) - filteredMen;
    if (summary.total < 0) summary.total = 0;
    if (summary.críticos < 0) summary.críticos = 0;
    if (summary.importantes < 0) summary.importantes = 0;
    if (summary.menores < 0) summary.menores = 0;
    auditJson.resumen_hallazgos = summary;

    const newScore = 100 - (summary.críticos * 20 + summary.importantes * 10 + summary.menores * 3);
    auditJson.puntuación_global = Math.max(0, Math.min(100, newScore));

    console.log(`[Parallel Projects Filter] Filtered ${filteredCrit} CRIT, ${filteredImp} IMP, ${filteredMen} MEN findings. New score: ${auditJson.puntuación_global}`);
  }

  return auditJson;
}

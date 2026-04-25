/**
 * clean-brief-builder.ts — Generates a presentable "Brief Limpio" markdown
 * from a normalized business_extraction_v2 briefing.
 *
 * 100% deterministic. No LLM calls.
 * Strips _source_chunks, _evidence_count, _merged_from, etc.
 */

export interface CleanSection {
  id: string;
  title: string;
  markdown: string;
}

export interface CleanBriefResult {
  markdown: string;
  sections: CleanSection[];
}

function clean(s: any): string {
  if (s === null || s === undefined) return "";
  return String(s).trim();
}

function bullet(s: string): string {
  return `- ${s}`;
}

function stripDebugPhrases(s: string): string {
  if (!s) return s;
  let out = s;
  // Remove parentheticals or trailing notes that mention internal pipeline stages.
  out = out.replace(/\s*\(\s*componente\s+can[oó]nico\s+inyectado[^)]*\)\s*/gi, "");
  out = out.replace(/\s*componente\s+can[oó]nico\s+inyectado\s+por\s+normalizer[^.;]*[.;]?/gi, "");
  out = out.replace(/\s*revisar\s+evidencia\s+en\s+F2\/roadmap[^.;]*[.;]?/gi, "");
  out = out.replace(/\s*\(\s*inferido\s*\)\s*/gi, " ");
  out = out.replace(/\s*\bnormalizer\b\s*/gi, " ");
  out = out.replace(/\s*\bF2\/roadmap\b\s*/gi, " ");
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

function fmtItem(item: any, opts: { showAmount?: boolean } = {}): string {
  if (!item) return "";
  if (typeof item === "string") return stripDebugPhrases(item);
  const title = stripDebugPhrases(clean(item.title || item.signal || item.name || item.flag || item.question || ""));
  const desc = stripDebugPhrases(clean(item.description || item.evidence || ""));
  const amount = opts.showAmount ? clean(item.amount_hint || item.data_volume_hint || "") : "";
  const unverified = item._unverified_number ? " ⚠️ *(cifra no verificada)*" : "";
  let out = title;
  if (desc && desc !== title) out += title ? `: ${desc}` : desc;
  if (amount) out += ` (${amount})`;
  return out + unverified;
}

function listSection(arr: any[] | undefined, opts: { max?: number; showAmount?: boolean } = {}): string {
  if (!Array.isArray(arr) || arr.length === 0) return "_Sin datos relevantes en este bloque._";
  const max = opts.max ?? 12;
  return arr.slice(0, max).map((it) => bullet(fmtItem(it, opts))).join("\n");
}

export function buildCleanBrief(briefing: any, ctx: { projectName: string }): CleanBriefResult {
  const v2 = briefing?.business_extraction_v2 || {};
  const sections: CleanSection[] = [];

  // 1. Resumen del negocio
  const bms = v2.business_model_summary || {};
  const exec = v2.executive_summary || "";
  const r1 = [
    bms.title ? `**${clean(bms.title)}**` : "",
    bms.context ? clean(bms.context) : "",
    bms.primary_goal ? `**Objetivo principal:** ${clean(bms.primary_goal)}` : "",
    bms.complexity_level || bms.urgency_level
      ? `**Complejidad:** ${clean(bms.complexity_level) || "n/d"} · **Urgencia:** ${clean(bms.urgency_level) || "n/d"}`
      : "",
    exec ? `\n${clean(exec)}` : "",
  ].filter(Boolean).join("\n\n");
  sections.push({ id: "resumen", title: "1. Resumen del negocio", markdown: r1 || "_Sin resumen disponible._" });

  // 2. Datos y activos existentes
  sections.push({
    id: "activos",
    title: "2. Datos y activos existentes",
    markdown: listSection(v2.underutilized_data_assets, { showAmount: true }),
  });

  // 3. Problemas detectados
  sections.push({
    id: "problemas",
    title: "3. Problemas detectados",
    markdown: listSection(v2.quantified_economic_pains, { showAmount: true }),
  });

  // 4. Catalizadores de negocio (canónicos primero)
  const catalysts = Array.isArray(v2.business_catalysts) ? [...v2.business_catalysts] : [];
  catalysts.sort((a: any, b: any) => {
    const aCanon = a?._inferred_by === "normalizer_catalyst_v1" ? 0 : 1;
    const bCanon = b?._inferred_by === "normalizer_catalyst_v1" ? 0 : 1;
    return aCanon - bCanon;
  });
  sections.push({
    id: "catalizadores",
    title: "4. Catalizadores de negocio",
    markdown: listSection(catalysts),
  });

  // 5. Necesidades explícitas
  sections.push({
    id: "necesidades",
    title: "5. Necesidades explícitas del cliente",
    markdown: listSection(v2.client_requested_items),
  });

  // 6. Oportunidades IA
  sections.push({
    id: "oportunidades",
    title: "6. Oportunidades IA detectadas",
    markdown: listSection(v2.ai_native_opportunity_signals),
  });

  // 7. Riesgos y compliance
  const risks = listSection(v2.constraints_and_risks);
  const flags = Array.isArray(v2.initial_compliance_flags) && v2.initial_compliance_flags.length > 0
    ? v2.initial_compliance_flags.map((f: any) => bullet(`**${clean(f.flag)}**${f.evidence ? ` — ${clean(f.evidence)}` : ""}${f._inferred_by ? " *(inferido)*" : ""}`)).join("\n")
    : "_Sin compliance flags._";
  sections.push({
    id: "riesgos",
    title: "7. Riesgos y compliance",
    markdown: `**Restricciones y riesgos:**\n${risks}\n\n**Compliance flags:**\n${flags}`,
  });

  // 8. Preguntas abiertas
  sections.push({
    id: "preguntas",
    title: "8. Preguntas abiertas",
    markdown: listSection(v2.open_questions),
  });

  // 9. Componentes candidatos normalizados
  const candidates = Array.isArray(v2.ai_native_opportunity_signals) ? v2.ai_native_opportunity_signals : [];
  const compMd = candidates.length === 0
    ? "_Sin candidatos extraídos._"
    : candidates.slice(0, 16).map((c: any, i: number) => {
        const title = clean(c.title || c.description || `Candidato ${i + 1}`);
        return `${i + 1}. **${title}**`;
      }).join("\n");
  sections.push({
    id: "candidatos",
    title: "9. Componentes candidatos normalizados",
    markdown: compMd,
  });

  // Compose final markdown.
  const naming = v2.client_naming_check || {};
  const header = `# Brief Limpio — ${clean(ctx.projectName) || "Proyecto"}\n\n` +
    `> **Cliente:** ${clean(naming.client_company_name) || "n/d"}` +
    `${naming.founder_or_decision_maker ? ` · **Decisor:** ${clean(naming.founder_or_decision_maker)}` : ""}` +
    `${naming.proposed_product_name ? ` · **Producto:** ${clean(naming.proposed_product_name)}` : ""}\n\n` +
    `_Generado automáticamente desde la extracción cruda. Para auditoría completa con evidencias y origen por bloque, ver "Brief Crudo (debug)"._\n`;

  const body = sections.map((s) => `## ${s.title}\n\n${s.markdown}`).join("\n\n");
  const markdown = `${header}\n${body}\n`;

  return { markdown, sections };
}

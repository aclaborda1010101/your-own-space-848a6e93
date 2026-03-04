import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Brand constants ───────────────────────────────────────────────────
const BRAND = {
  primary: "#0A3039",
  accent: "#7ED957",
  text: "#374151",
  muted: "#6B7280",
  white: "#FFFFFF",
  light: "#F9FAFB",
  lightAlt: "#F3F4F6",
  border: "#9A9A9A",
  alertRed: "#DC2626",
  alertRedBg: "#FEE2E2",
  alertOrange: "#D97706",
  alertOrangeBg: "#FEF3C7",
  confirmedGreen: "#059669",
  confirmedGreenBg: "#D1FAE5",
  dark: "#1A1A1A",
  graySubtitle: "#4A4A4A",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── Sanitize markdown ─────────────────────────────────────────────────
function sanitizeMarkdown(md: string): string {
  return md
    .split("\n")
    .filter(line => !/^\s*([-*_])\s*\1\s*\1[\s\-\*\_]*$/.test(line))
    .join("\n")
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "")
    .replace(/\n{3,}/g, "\n\n");
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Inline formatting: **bold**, *italic*, `code` → HTML ──────────────
function inlineFormat(text: string): string {
  let html = escapeHtml(text);
  // Bold+Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Code
  html = html.replace(/`(.+?)`/g, `<code style="font-family:Consolas,monospace;font-size:9pt;color:${BRAND.primary};background:${BRAND.lightAlt};padding:1px 4px;border-radius:2px;">$1</code>`);
  return html;
}

// ── CSS styles ────────────────────────────────────────────────────────
function getStyles(projectName: string): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');

    @page {
      size: A4;
      margin: 13mm 7mm 9mm 9mm;
    }
    @page :first {
      margin: 8mm 7mm 6mm 11mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, Calibri, 'Segoe UI', Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.4;
      color: ${BRAND.text};
    }
    .cover-page {
      page-break-after: always;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .brand-bar {
      background: ${BRAND.primary};
      color: ${BRAND.white};
      text-align: center;
      padding: 28px 0;
      font-family: Raleway, Arial, sans-serif;
      font-size: 18pt;
      font-weight: bold;
    }
    .brand-bar .accent { color: ${BRAND.accent}; }
    .cover-spacer { flex: 1; }
    .cover-title {
      text-align: center;
      font-family: Raleway, Arial, sans-serif;
      font-size: 36pt;
      font-weight: 800;
      color: ${BRAND.dark};
      margin: 40px 0 16px;
    }
    .cover-divider {
      width: 100px;
      height: 4px;
      background: #0D9488;
      margin: 0 auto 20px;
    }
    .cover-subtitle {
      text-align: center;
      font-family: Raleway, Arial, sans-serif;
      font-size: 16pt;
      color: ${BRAND.graySubtitle};
      margin-bottom: 60px;
    }
    .meta-table {
      width: 50%;
      margin: 0 auto;
      border-collapse: collapse;
    }
    .meta-table td {
      padding: 4px 8px;
      font-size: 10.5pt;
      border: none;
    }
    .meta-label {
      text-align: right;
      color: ${BRAND.muted};
      font-weight: bold;
      width: 35%;
    }
    .meta-value { color: ${BRAND.text}; }
    .confidential-badge {
      width: 30%;
      margin: 24px auto;
      background: ${BRAND.alertRed};
      color: ${BRAND.white};
      text-align: center;
      padding: 5px 0;
      font-family: Raleway, Arial, sans-serif;
      font-size: 9pt;
      font-weight: bold;
    }
    .brand-bar-bottom {
      background: ${BRAND.primary};
      color: ${BRAND.white};
      text-align: center;
      padding: 8px 0;
      font-family: Raleway, Arial, sans-serif;
      font-size: 8pt;
    }

    /* TOC */
    .toc-page { page-break-after: always; }
    .h1-bar {
      background: ${BRAND.primary};
      color: ${BRAND.white};
      font-family: Raleway, Arial, sans-serif;
      font-size: 20pt;
      font-weight: bold;
      padding: 12px 16px;
      margin: 24px 0 12px;
      border-bottom: 3px solid #0D9488;
    }
    .toc-entry {
      display: flex;
      align-items: baseline;
      padding: 4px 0;
    }
    .toc-entry .toc-text { flex-shrink: 0; }
    .toc-entry .toc-dots {
      flex: 1;
      border-bottom: 1px dotted ${BRAND.muted};
      margin: 0 6px;
      min-width: 20px;
      height: 1em;
    }
    .toc-1 .toc-text {
      font-family: Raleway, Arial, sans-serif;
      font-size: 12pt;
      font-weight: bold;
      color: ${BRAND.primary};
    }
    .toc-2 {
      padding-left: 24px;
    }
    .toc-2 .toc-text {
      font-size: 10.5pt;
      color: ${BRAND.text};
    }

    /* Content headings */
    h2 {
      font-family: Raleway, Arial, sans-serif;
      font-size: 12pt;
      color: ${BRAND.text};
      font-weight: bold;
      margin: 18px 0 8px;
    }
    h3 {
      font-family: Raleway, Arial, sans-serif;
      font-size: 10pt;
      color: ${BRAND.muted};
      font-weight: bold;
      margin: 12px 0 6px;
    }
    h4 {
      font-family: Raleway, Arial, sans-serif;
      font-size: 10pt;
      color: ${BRAND.muted};
      font-weight: bold;
      font-style: italic;
      margin: 10px 0 5px;
    }
    p {
      text-align: justify;
      margin-bottom: 6px;
      line-height: 1.4;
    }
    ul, ol {
      margin: 4px 0 8px 24px;
    }
    li {
      margin-bottom: 4px;
      line-height: 1.4;
    }
    blockquote {
      margin: 6px 0 6px 36px;
      padding: 6px 12px;
      background: ${BRAND.light};
      font-style: italic;
      color: ${BRAND.muted};
      border-left: 3px solid ${BRAND.border};
    }

    /* Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 12px;
      font-size: 9.5pt;
    }
    .data-table th, .data-table td {
      border: 1px solid ${BRAND.border};
      padding: 5px 8px;
      vertical-align: middle;
    }
    .data-table th {
      background: ${BRAND.primary};
      color: ${BRAND.white};
      font-weight: bold;
      text-transform: uppercase;
    }
    .severity-critico { background: ${BRAND.alertRedBg}; color: ${BRAND.alertRed}; font-weight: bold; }
    .severity-alto { background: ${BRAND.alertRedBg}; color: ${BRAND.alertRed}; font-weight: bold; }
    .severity-medio { background: ${BRAND.alertOrangeBg}; color: ${BRAND.alertOrange}; font-weight: bold; }
    .severity-bajo { background: ${BRAND.confirmedGreenBg}; color: ${BRAND.confirmedGreen}; font-weight: bold; }

    /* Callouts */
    .callout {
      margin: 8px 0;
      padding: 8px 14px;
      border-left: 5px solid;
      border-radius: 4px;
    }
    .callout-pendiente { background: ${BRAND.alertOrangeBg}; border-color: ${BRAND.alertOrange}; }
    .callout-alerta { background: ${BRAND.alertRedBg}; border-color: ${BRAND.alertRed}; }
    .callout-confirmado { background: ${BRAND.confirmedGreenBg}; border-color: ${BRAND.confirmedGreen}; }

    /* Executive Summary KPIs */
    .exec-summary { margin-bottom: 16px; }
    .kpi-grid {
      display: flex;
      gap: 8px;
      margin: 12px 0;
    }
    .kpi-box {
      flex: 1;
      background: ${BRAND.lightAlt};
      text-align: center;
      padding: 12px 8px;
    }
    .kpi-value {
      font-family: Raleway, Arial, sans-serif;
      font-size: 28pt;
      font-weight: bold;
      color: ${BRAND.primary};
    }
    .kpi-label {
      font-size: 9pt;
      color: ${BRAND.muted};
    }
    .kpi-bar {
      width: 100%;
      height: 6px;
      background: #E5E7EB;
      margin-top: 6px;
      border-radius: 3px;
      overflow: hidden;
    }
    .kpi-fill {
      height: 100%;
      background: #0D9488;
      border-radius: 3px;
    }
    .phase-bar-row {
      display: flex;
      align-items: center;
      margin: 3px 0;
    }
    .phase-name { width: 20%; font-size: 9.5pt; font-weight: bold; }
    .phase-bar { height: 16px; background: ${BRAND.primary}; }
    .phase-meta { font-size: 9pt; color: ${BRAND.muted}; margin-left: 8px; }
    .total-investment {
      width: 60%;
      margin: 16px auto;
      border: 2px solid ${BRAND.primary};
      text-align: center;
      padding: 8px;
    }
    .total-label { font-size: 9.5pt; color: ${BRAND.muted}; }
    .total-value { font-size: 16pt; font-weight: bold; color: ${BRAND.primary}; }
    .roi-text { text-align: center; color: ${BRAND.confirmedGreen}; font-weight: bold; margin: 6px 0 16px; }

    /* Inline KPI score boxes */
    .score-kpi-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin: 10px 0 14px;
    }
    .score-kpi-item {
      flex: 1;
      min-width: 120px;
      background: ${BRAND.lightAlt};
      padding: 10px 12px;
      text-align: center;
    }
    .score-kpi-number {
      font-family: Raleway, Arial, sans-serif;
      font-size: 22pt;
      font-weight: 800;
      color: ${BRAND.primary};
    }
    .score-kpi-name {
      font-size: 8.5pt;
      color: ${BRAND.muted};
      margin-top: 2px;
    }

    /* Signature */
    .signature-page { page-break-before: always; }
    .sig-title {
      font-family: Raleway, Arial, sans-serif;
      font-size: 16pt;
      color: ${BRAND.primary};
      font-weight: bold;
      border-bottom: 3px solid ${BRAND.primary};
      padding-bottom: 8px;
      margin: 20px 0 24px;
    }
    .sig-grid { display: flex; gap: 16px; }
    .sig-block {
      flex: 1;
      border: 1px solid ${BRAND.border};
      border-top: 2px solid ${BRAND.primary};
      background: ${BRAND.light};
      padding: 20px 16px;
    }
    .sig-entity {
      font-family: Raleway, Arial, sans-serif;
      font-size: 10.5pt;
      color: ${BRAND.primary};
      font-weight: bold;
      margin-bottom: 16px;
    }
    .sig-label { font-size: 10.5pt; color: ${BRAND.muted}; }
    .sig-line { border-bottom: 1px solid ${BRAND.text}; margin: 28px 0 8px; }
    .sig-validity {
      text-align: center;
      font-size: 9.5pt;
      color: ${BRAND.muted};
      font-style: italic;
      margin-top: 24px;
    }

    .page-break { page-break-before: always; }
  `;
}

// ── Build cover page HTML ─────────────────────────────────────────────
function buildCoverHtml(title: string, projectName: string, company: string, date: string, version: string, author?: string): string {
  const metaRows = [
    ["Cliente", company || "—"],
    ["Fecha", date],
    ["Versión", version],
  ];
  if (author) metaRows.push(["Autor", author]);

  return `
    <div class="cover-page">
      <div class="brand-bar">Man<span class="accent">IAS</span> Lab.</div>
      <div class="cover-spacer"></div>
      <div class="cover-title">${escapeHtml(title.toUpperCase())}</div>
      <div class="cover-divider"></div>
      <div class="cover-subtitle">${escapeHtml(projectName)}</div>
      <div class="cover-spacer"></div>
      <table class="meta-table">
        ${metaRows.map(([l, v]) => `<tr><td class="meta-label">${escapeHtml(l)}:</td><td class="meta-value">${escapeHtml(v)}</td></tr>`).join("")}
      </table>
      <div style="height:24px"></div>
      <div class="confidential-badge">CONFIDENCIAL</div>
      <div class="cover-spacer"></div>
      <div class="brand-bar-bottom">ManIAS Lab. | Consultora Tecnológica</div>
    </div>
  `;
}

// ── Build Executive Summary HTML ──────────────────────────────────────
function buildExecSummaryHtml(markdownContent: string): string {
  const match = markdownContent.match(/<!--EXEC_SUMMARY_JSON-->([\s\S]*?)<!--\/EXEC_SUMMARY_JSON-->/);
  if (!match) return "";

  try {
    const data = JSON.parse(match[1].trim());
    let html = '<div class="exec-summary">';
    html += `<div class="h1-bar">Resumen Ejecutivo</div>`;

    if (data.kpis?.length > 0) {
      html += '<div class="kpi-grid">';
      data.kpis.slice(0, 4).forEach((kpi: any) => {
        html += `<div class="kpi-box"><div class="kpi-value">${escapeHtml(kpi.value)}</div><div class="kpi-label">${escapeHtml(kpi.label)}</div></div>`;
      });
      html += '</div>';
    }

    if (data.phases?.length > 0) {
      html += `<h2>FASES DEL PROYECTO</h2>`;
      const maxWeight = Math.max(...data.phases.map((p: any) => p.weight || 0.5));
      data.phases.forEach((phase: any) => {
        const barWidth = Math.round(((phase.weight || 0.5) / maxWeight) * 60);
        html += `<div class="phase-bar-row">
          <span class="phase-name">${escapeHtml(phase.name)}</span>
          <div class="phase-bar" style="width:${barWidth}%"></div>
          <span class="phase-meta">${escapeHtml(phase.cost || "")} ${escapeHtml(phase.duration || "")}</span>
        </div>`;
      });
    }

    if (data.total_investment) {
      html += `<div class="total-investment"><div class="total-label">INVERSIÓN TOTAL</div><div class="total-value">${escapeHtml(data.total_investment)}</div></div>`;
      if (data.roi_estimate) {
        html += `<div class="roi-text">ROI Estimado: ${escapeHtml(data.roi_estimate)}</div>`;
      }
    }

    html += '</div><div class="page-break"></div>';
    return html;
  } catch {
    return "";
  }
}

// ── Build TOC HTML ────────────────────────────────────────────────────
function buildTocHtml(markdownContent: string): string {
  const lines = markdownContent.split("\n");
  let h1Counter = 0;
  let h2Counter = 0;
  let entries = "";

  for (const line of lines) {
    if (line.startsWith("# ")) {
      h1Counter++;
      h2Counter = 0;
      let title = line.slice(2).trim().replace(/^\d+(\.\d+)*[\.\)]*\s*/, "").trim();
      entries += `<div class="toc-entry toc-1"><span class="toc-text">${h1Counter}. ${escapeHtml(toTitleCase(title))}</span><span class="toc-dots"></span></div>`;
    } else if (line.startsWith("## ")) {
      h2Counter++;
      let title = line.slice(3).trim().replace(/^\d+(\.\d+)*[\.\)]*\s*/, "").trim();
      entries += `<div class="toc-entry toc-2"><span class="toc-text">${h1Counter}.${h2Counter} ${escapeHtml(title)}</span><span class="toc-dots"></span></div>`;
    }
  }

  if (!entries) return "";
  return `<div class="toc-page"><div class="h1-bar">Índice de Contenidos</div>${entries}</div>`;
}

// ── Parse markdown table → HTML ───────────────────────────────────────
function parseMarkdownTableHtml(tableLines: string[]): string {
  const parseCells = (line: string): string[] =>
    line.split("|").slice(1, -1).map(c => c.trim());

  const headerCells = parseCells(tableLines[0]);
  const dataLines = tableLines.slice(2);

  let html = '<table class="data-table"><thead><tr>';
  headerCells.forEach(cell => {
    html += `<th>${escapeHtml(cell.toUpperCase())}</th>`;
  });
  html += '</tr></thead><tbody>';

  dataLines.filter(l => l.trim().startsWith("|")).forEach(line => {
    const cells = parseCells(line);
    html += '<tr>';
    headerCells.forEach((_, colIdx) => {
      const cellText = cells[colIdx] || "";
      const cellUpper = cellText.toUpperCase().trim();
      let cls = "";
      if (/^(CRÍTICO|P0)$/i.test(cellUpper)) cls = "severity-critico";
      else if (/^(ALTO|ALTA)$/i.test(cellUpper)) cls = "severity-alto";
      else if (/^(IMPORTANTE|P1|MEDIO|MEDIA)$/i.test(cellUpper)) cls = "severity-medio";
      else if (/^(MENOR|P2|BAJO|BAJA)$/i.test(cellUpper)) cls = "severity-bajo";
      html += `<td${cls ? ` class="${cls}"` : ""}>${inlineFormat(cellText)}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

// ── Parse ASCII table → HTML ──────────────────────────────────────────
function parseAsciiTableHtml(tableLines: string[]): string {
  const contentLines = tableLines.filter(l => !l.trim().startsWith("+"));
  if (contentLines.length < 1) return "";

  const parseCells = (line: string): string[] =>
    line.split("|").filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim());

  const headerCells = parseCells(contentLines[0]);
  if (headerCells.length === 0) return "";

  let html = '<table class="data-table"><thead><tr>';
  headerCells.forEach(cell => { html += `<th>${escapeHtml(cell.toUpperCase())}</th>`; });
  html += '</tr></thead><tbody>';

  contentLines.slice(1).forEach(line => {
    const cells = parseCells(line);
    html += '<tr>';
    headerCells.forEach((_, colIdx) => {
      html += `<td>${inlineFormat(cells[colIdx] || "")}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

// ── Main markdown → HTML converter ────────────────────────────────────
function markdownToHtml(md: string): string {
  let sanitized = sanitizeMarkdown(md);
  sanitized = sanitized.replace(/<!--EXEC_SUMMARY_JSON-->[\s\S]*?<!--\/EXEC_SUMMARY_JSON-->/, "");

  const lines = sanitized.split("\n");
  let html = "";
  let isFirstH1 = true;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Callouts
    if (/^\[PENDIENTE:/i.test(trimmed)) {
      let calloutText = trimmed;
      while (i + 1 < lines.length && !calloutText.endsWith("]")) { i++; calloutText += " " + lines[i].trim(); }
      calloutText = calloutText.replace(/^\[PENDIENTE:\s*/i, "PENDIENTE: ").replace(/\]$/, "");
      html += `<div class="callout callout-pendiente">${inlineFormat(calloutText)}</div>`;
      i++; continue;
    }
    if (/^\[ALERTA:/i.test(trimmed)) {
      let calloutText = trimmed;
      while (i + 1 < lines.length && !calloutText.endsWith("]")) { i++; calloutText += " " + lines[i].trim(); }
      calloutText = calloutText.replace(/^\[ALERTA:\s*/i, "ALERTA: ").replace(/\]$/, "");
      html += `<div class="callout callout-alerta">${inlineFormat(calloutText)}</div>`;
      i++; continue;
    }
    if (/^\[CONFIRMADO:/i.test(trimmed)) {
      let calloutText = trimmed;
      while (i + 1 < lines.length && !calloutText.endsWith("]")) { i++; calloutText += " " + lines[i].trim(); }
      calloutText = calloutText.replace(/^\[CONFIRMADO:\s*/i, "CONFIRMADO: ").replace(/\]$/, "");
      html += `<div class="callout callout-confirmado">${inlineFormat(calloutText)}</div>`;
      i++; continue;
    }

    // Markdown tables
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { tableLines.push(lines[i]); i++; }
      if (tableLines.length >= 3) html += parseMarkdownTableHtml(tableLines);
      continue;
    }

    // ASCII tables
    if (trimmed.startsWith("+") && /^\+[-=+]+\+$/.test(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith("+") || lines[i].trim().startsWith("|"))) { tableLines.push(lines[i]); i++; }
      if (tableLines.length >= 3) html += parseAsciiTableHtml(tableLines);
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      if (!isFirstH1) html += '<div class="page-break"></div>';
      isFirstH1 = false;
      html += `<div class="h1-bar">${escapeHtml(line.slice(2).trim())}</div>`;
    } else if (line.startsWith("## ")) {
      html += `<h2>${inlineFormat(line.slice(3).trim())}</h2>`;
    } else if (line.startsWith("### ")) {
      html += `<h3>${inlineFormat(line.slice(4).trim())}</h3>`;
    } else if (line.startsWith("#### ")) {
      html += `<h4>${inlineFormat(line.slice(5).trim())}</h4>`;

    // Bullets
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      html += `<ul><li>${inlineFormat(line.slice(2))}</li></ul>`;
    } else if (/^ {2,5}[-*] /.test(line)) {
      html += `<ul style="margin-left:24px"><li>${inlineFormat(line.replace(/^ {2,5}[-*] /, ""))}</li></ul>`;
    } else if (/^ {6,}[-*] /.test(line)) {
      html += `<ul style="margin-left:48px"><li>${inlineFormat(line.replace(/^ {6,}[-*] /, ""))}</li></ul>`;
    } else if (line.match(/^\d+\.\s/)) {
      html += `<ol><li>${inlineFormat(line.replace(/^\d+\.\s/, ""))}</li></ol>`;

    // Blockquote
    } else if (line.startsWith("> ")) {
      html += `<blockquote>${inlineFormat(line.slice(2))}</blockquote>`;

    // Empty
    } else if (trimmed === "") {
      // skip

    // Bold-only line
    } else if (line.startsWith("**") && line.endsWith("**")) {
      html += `<p><strong>${escapeHtml(line.slice(2, -2))}</strong></p>`;

    // Normal paragraph
    } else {
      html += `<p>${inlineFormat(line)}</p>`;
    }
    i++;
  }
  return html;
}

// ── JSON to HTML (generic) ────────────────────────────────────────────
function jsonToHtml(data: any): string {
  let html = "";
  if (typeof data === "object" && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      if (key === "parse_error" || key === "raw_text") continue;
      const title = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      html += `<h2>${escapeHtml(title)}</h2>`;
      if (typeof value === "string") {
        html += `<p>${inlineFormat(sanitizeMarkdown(value))}</p>`;
      } else if (Array.isArray(value)) {
        html += '<ul>';
        value.forEach((item: any) => {
          const text = typeof item === "string" ? sanitizeMarkdown(item) : Object.entries(item).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
          html += `<li>${inlineFormat(sanitizeMarkdown(text))}</li>`;
        });
        html += '</ul>';
      } else if (typeof value === "object" && value !== null) {
        Object.entries(value).forEach(([k, v]) => {
          html += `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(sanitizeMarkdown(typeof v === "object" ? JSON.stringify(v) : String(v)))}</p>`;
        });
      }
    }
  } else {
    html += `<pre style="font-family:Consolas;font-size:9pt;white-space:pre-wrap;">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
  }
  return html;
}

// ── Signature page HTML ───────────────────────────────────────────────
function buildSignatureHtml(company: string, date: string, author?: string): string {
  return `
    <div class="signature-page">
      <div class="sig-title">Aceptación del Documento de Alcance</div>
      <div class="sig-grid">
        <div class="sig-block">
          <div class="sig-entity">POR ${escapeHtml((company || "CLIENTE").toUpperCase())}</div>
          <div class="sig-label">Firma:</div>
          <div class="sig-line"></div>
          <div class="sig-label">Nombre: ________________</div>
          <div class="sig-label">Fecha: ___/___/${new Date().getFullYear()}</div>
        </div>
        <div class="sig-block">
          <div class="sig-entity">POR MANIAS LAB.</div>
          <div class="sig-label">Firma:</div>
          <div class="sig-line"></div>
          <div class="sig-label">Nombre: ${escapeHtml(author || "________________")}</div>
          <div class="sig-label">Fecha: ___/___/${new Date().getFullYear()}</div>
        </div>
      </div>
      <div class="sig-validity">Validez: 15 días naturales desde fecha de emisión</div>
    </div>
  `;
}

// ── Assemble full HTML document ───────────────────────────────────────
function buildHtmlDocument(
  title: string, projectName: string, company: string, date: string, version: string,
  contentHtml: string, rawMarkdown: string, stepNumber: number, author?: string
): string {
  const isClientFacing = [3, 5].includes(stepNumber);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>${getStyles(projectName)}</style>
</head>
<body>
  ${buildCoverHtml(title, projectName, company, date, version, author)}
  ${buildExecSummaryHtml(rawMarkdown)}
  ${buildTocHtml(rawMarkdown)}
  <div class="content">${contentHtml}</div>
  ${isClientFacing ? buildSignatureHtml(company, date, author) : ""}
</body>
</html>`;
}

// ── Convert HTML to PDF via html2pdf.app ──────────────────────────────
async function convertToPdf(htmlString: string): Promise<Uint8Array> {
  const apiKey = Deno.env.get("HTML2PDF_API_KEY");
  if (!apiKey) throw new Error("HTML2PDF_API_KEY not configured");

  const response = await fetch("https://api.html2pdf.app/v1/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html: htmlString,
      apiKey,
      format: "A4",
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:8pt;width:100%;text-align:right;padding-right:18mm;color:${BRAND.muted};">CONFIDENCIAL</div>`,
      footerTemplate: `<div style="font-size:8pt;width:100%;padding:0 18mm;display:flex;justify-content:space-between;color:${BRAND.muted};"><span>ManIAS Lab.</span><span>Pág <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("html2pdf.app error:", response.status, errorText);
    throw new Error(`PDF generation failed: ${response.status} - ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// ── Step titles ───────────────────────────────────────────────────────
const STEP_TITLES: Record<number, string> = {
  2: "Briefing Extraído",
  3: "Documento de Alcance",
  4: "Auditoría Cruzada",
  5: "Documento Final",
  6: "Auditoría IA",
  7: "PRD Técnico",
  8: "Generación de RAGs",
  9: "Detección de Patrones",
  10: "Documento Final de Auditoría",
  11: "Cuestionario de Auditoría",
  12: "Radiografía del Negocio",
  13: "Plan por Capas",
  14: "Roadmap Vendible",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, stepNumber, content, contentType, projectName, company, date, version, author } = await req.json();

    if (!projectId || !stepNumber || !content) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const title = STEP_TITLES[stepNumber] || `Fase ${stepNumber}`;
    const dateStr = date || new Date().toISOString().split("T")[0];
    const ver = version || "v1";

    // Convert content to HTML
    let contentHtml = "";
    let rawMarkdown = "";
    if (contentType === "markdown" || typeof content === "string") {
      rawMarkdown = typeof content === "string" ? content : JSON.stringify(content, null, 2);
      contentHtml = markdownToHtml(rawMarkdown);
    } else {
      rawMarkdown = JSON.stringify(content, null, 2);
      contentHtml = jsonToHtml(content);
    }

    // Build full HTML document
    const fullHtml = buildHtmlDocument(title, projectName || "Proyecto", company || "", dateStr, ver, contentHtml, rawMarkdown, stepNumber, author);

    // Convert to PDF
    const pdfBuffer = await convertToPdf(fullHtml);

    // Upload to Storage
    const supabase = getSupabaseAdmin();
    const filePath = `${projectId}/${stepNumber}/v${ver}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("project-documents")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Upload failed", details: uploadError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from("project-documents")
      .createSignedUrl(filePath, 3600);

    if (urlError) {
      return new Response(JSON.stringify({ error: "Failed to generate download URL" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update DB record
    const { error: dbError } = await supabase
      .from("project_documents")
      .upsert({
        project_id: projectId,
        step_number: stepNumber,
        version: parseInt(ver.replace("v", "")) || 1,
        file_url: signedUrlData.signedUrl,
        file_format: "pdf",
        is_client_facing: [3, 5, 7].includes(stepNumber),
        updated_at: new Date().toISOString(),
      }, { onConflict: "project_id,step_number,version" })
      .select()
      .single();

    return new Response(JSON.stringify({
      url: signedUrlData.signedUrl,
      filePath,
      fileName: `${title.replace(/\s+/g, "-").toLowerCase()}-${ver}.pdf`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Generate document error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

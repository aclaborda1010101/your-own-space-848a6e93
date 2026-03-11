// generate-document/index.ts — HTML→PDF via html2pdf.app
// REEMPLAZO COMPLETO del generador DOCX
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ══════════════════════════════════════════════════════════════════════
// CSS — Diseño corporativo ManIAS
// ══════════════════════════════════════════════════════════════════════

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;600;700;800&family=Montserrat:wght@400;500;600;700&display=swap');

:root {
  --primary: #0A3039;
  --accent: #0D9488;
  --accent-light: #5EEAD4;
  --text: #374151;
  --text-light: #6B7280;
  --bg-light: #F9FAFB;
  --border: #9A9A9A;
  --border-light: #E5E7EB;
  --alert-red: #DC2626;
  --alert-orange: #D97706;
  --confirmed-green: #059669;
  --white: #FFFFFF;
}

@page {
  size: A4;
  margin: 22mm 18mm 25mm 22mm;
}

@page :first {
  margin: 0;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Montserrat', 'Calibri', sans-serif;
  font-size: 10.5pt;
  line-height: 1.55;
  color: var(--text);
}

.cover-page {
  page-break-after: always;
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  padding: 0;
  background: var(--primary);
  box-sizing: border-box;
  overflow: hidden;
}

.cover-header {
  padding: 60px 40px 30px;
  text-align: center;
}

.logo-text {
  font-family: 'Raleway', 'Arial Black', sans-serif;
  font-size: 36pt;
  font-weight: 800;
  text-align: center;
  padding: 50px 0 30px;
}
.logo-text .man { color: #FFFFFF; }
.logo-text .ias { color: #BFFF00; font-weight: 900; }
.logo-text .lab { color: #FFFFFF; }
.logo-text .dot { color: #BFFF00; }

.cover-header-text {
  font-family: 'Raleway', sans-serif;
  font-weight: 300;
  font-size: 24pt;
  color: rgba(255,255,255,0.85);
  letter-spacing: 3px;
  margin-top: 12px;
  display: none;
}

.cover-header-text b { font-weight: 700; color: var(--accent-light); }

.cover-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 30px;
  text-align: center;
}

.cover-doc-type {
  font-family: 'Raleway', sans-serif;
  font-size: 11pt;
  font-weight: 600;
  color: rgba(255,255,255,0.6);
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 25px;
}

.cover-title {
  font-family: 'Raleway', sans-serif;
  font-size: 18pt;
  font-weight: 800;
  color: var(--white);
  line-height: 1.25;
  margin-bottom: 12px;
  max-width: 500px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.cover-divider {
  width: 80px;
  height: 4px;
  background: var(--accent);
  margin: 20px auto 25px;
  border-radius: 2px;
}

.cover-subtitle {
  font-family: 'Raleway', sans-serif;
  font-size: 14pt;
  font-weight: 300;
  color: rgba(255,255,255,0.6);
  margin-bottom: 25px;
  max-width: 400px;
}

.cover-date {
  font-family: 'Montserrat', sans-serif;
  font-size: 10pt;
  color: rgba(255,255,255,0.7);
  text-align: center;
  margin-top: 20px;
}

.cover-badge {
  display: inline-block;
  background: var(--alert-red);
  color: var(--white);
  font-size: 8pt;
  font-weight: 700;
  padding: 4px 18px;
  border-radius: 3px;
  letter-spacing: 3px;
  margin-top: 15px;
}

.cover-bottom-bar {
  background: rgba(0,0,0,0.2);
  padding: 14px 45px;
  text-align: center;
}

.cover-bottom-bar span {
  color: rgba(255,255,255,0.5);
  font-family: 'Raleway', sans-serif;
  font-size: 8.5pt;
  letter-spacing: 1.5px;
}

/* ═══════════════════════════════════════ */
/* ÍNDICE                                 */
/* ═══════════════════════════════════════ */

.toc-page {
  page-break-after: always;
  padding-top: 10px;
}

.section-bar {
  font-family: 'Raleway', sans-serif;
  font-size: 18pt;
  font-weight: 700;
  color: var(--white);
  background: var(--primary);
  padding: 14px 22px;
  margin: 0 0 25px 0;
  border-bottom: 3px solid var(--accent);
}

.toc-h1 {
  font-family: 'Raleway', sans-serif;
  font-size: 11.5pt;
  font-weight: 600;
  color: var(--primary);
  padding: 7px 0;
  border-bottom: 1px solid var(--border-light);
}

.toc-h2 {
  font-family: 'Montserrat', sans-serif;
  font-size: 10pt;
  color: var(--text-light);
  padding: 4px 0 4px 22px;
}

/* ═══════════════════════════════════════ */
/* HEADINGS                               */
/* ═══════════════════════════════════════ */

h1 {
  font-family: 'Raleway', sans-serif;
  font-size: 18pt;
  font-weight: 700;
  color: var(--white);
  background: var(--primary);
  padding: 14px 22px;
  margin: 0 0 20px 0;
  border-bottom: 3px solid var(--accent);
  page-break-before: always;
}

h2 {
  font-family: 'Raleway', sans-serif;
  font-size: 13pt;
  font-weight: 700;
  color: var(--primary);
  padding-bottom: 6px;
  border-bottom: 2px solid var(--accent);
  margin: 28px 0 14px 0;
  page-break-after: avoid;
  break-after: avoid;
}

h3 {
  font-family: 'Raleway', sans-serif;
  font-size: 11.5pt;
  font-weight: 600;
  color: var(--text);
  margin: 20px 0 10px 0;
  page-break-after: avoid;
  break-after: avoid;
}

h4 {
  font-family: 'Raleway', sans-serif;
  font-size: 10.5pt;
  font-weight: 600;
  color: var(--text);
  font-style: italic;
  margin: 16px 0 8px 0;
  page-break-after: avoid;
  break-after: avoid;
}

h5 {
  font-family: 'Raleway', sans-serif;
  font-size: 10.5pt;
  font-weight: 700;
  color: var(--primary);
  margin: 14px 0 6px 0;
  border-bottom: 2px solid var(--accent);
  padding-bottom: 5px;
}

/* ═══════════════════════════════════════ */
/* PÁRRAFOS Y LISTAS                      */
/* ═══════════════════════════════════════ */

p {
  text-align: justify;
  margin: 0 0 8px 0;
  orphans: 3;
  widows: 3;
}

ul, ol {
  margin: 6px 0 14px 0;
  padding-left: 22px;
}

li {
  margin-bottom: 4px;
  line-height: 1.5;
}

li strong:first-child {
  color: var(--primary);
}

blockquote {
  border-left: 3px solid var(--accent);
  background: var(--bg-light);
  padding: 10px 16px;
  margin: 10px 0;
  font-style: italic;
  color: var(--text-light);
}

code {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 9pt;
  background: var(--bg-light);
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--accent);
}

pre {
  background: var(--primary);
  color: var(--accent-light);
  padding: 14px 18px;
  border-radius: 6px;
  font-size: 8.5pt;
  overflow-x: auto;
  margin: 12px 0;
  line-height: 1.5;
}

pre code {
  background: none;
  padding: 0;
  color: inherit;
}

/* ═══════════════════════════════════════ */
/* TABLAS                                 */
/* ═══════════════════════════════════════ */

table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 9pt;
  page-break-inside: avoid;
  break-inside: avoid;
}

tr {
  page-break-inside: avoid;
  break-inside: avoid;
}

th {
  background: var(--primary);
  color: var(--white);
  font-weight: 600;
  text-align: left;
  padding: 9px 10px;
  border: 1px solid var(--border);
  font-size: 8.5pt;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

td {
  padding: 7px 10px;
  border: 1px solid var(--border);
  vertical-align: top;
}

tr:nth-child(even) td {
  background: var(--bg-light);
}

/* Severidad */
.sev-critico { background: #FEE2E2 !important; color: var(--alert-red); font-weight: 600; }
.sev-importante { background: #FEF3C7 !important; color: var(--alert-orange); font-weight: 600; }
.sev-menor { background: #D1FAE5 !important; color: var(--confirmed-green); font-weight: 600; }

/* ═══════════════════════════════════════ */
/* KPI BOXES                              */
/* ═══════════════════════════════════════ */

.kpi-row {
  display: flex;
  gap: 12px;
  margin: 20px 0;
}

.kpi-box {
  flex: 1;
  background: var(--bg-light);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 16px 12px;
  text-align: center;
}

.kpi-value {
  font-family: 'Raleway', sans-serif;
  font-size: 26pt;
  font-weight: 800;
  color: var(--accent);
  line-height: 1;
}

.kpi-label {
  font-size: 8pt;
  color: var(--text-light);
  margin-top: 6px;
}

.kpi-bar {
  height: 5px;
  background: var(--border-light);
  border-radius: 3px;
  margin-top: 10px;
  overflow: hidden;
}

.kpi-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
}

/* ═══════════════════════════════════════ */
/* CALLOUT BOXES                          */
/* ═══════════════════════════════════════ */

.callout {
  padding: 12px 16px;
  margin: 14px 0;
  border-radius: 5px;
  border-left: 4px solid;
  font-size: 9.5pt;
}

.callout-pending {
  background: #FEF3C7;
  border-left-color: var(--alert-orange);
}

.callout-alert {
  background: #FEE2E2;
  border-left-color: var(--alert-red);
}

.callout-confirmed {
  background: #D1FAE5;
  border-left-color: var(--confirmed-green);
}

.callout-title {
  font-weight: 700;
  margin-bottom: 4px;
}

/* ═══════════════════════════════════════ */
/* OPPORTUNITY CARDS                       */
/* ═══════════════════════════════════════ */

.opp-card {
  border: 1px solid var(--border-light);
  border-left: 4px solid var(--accent);
  border-radius: 6px;
  padding: 16px 18px;
  margin: 14px 0;
  background: white;
}

.opp-card h4 {
  font-family: 'Raleway', sans-serif;
  font-size: 11pt;
  font-weight: 700;
  color: var(--primary);
  margin: 0 0 6px 0;
  font-style: normal;
}

.opp-card p {
  font-size: 9.5pt;
  text-align: left;
  margin-bottom: 12px;
}

.opp-metrics {
  display: flex;
  gap: 18px;
  padding-top: 10px;
  border-top: 1px solid var(--border-light);
}

.opp-metric {
  text-align: center;
}

.opp-metric-val {
  font-family: 'Raleway', sans-serif;
  font-size: 12pt;
  font-weight: 700;
  color: var(--accent);
  display: block;
}

.opp-metric-label {
  font-size: 7.5pt;
  color: var(--text-light);
}

.diff-badge {
  display: inline-block;
  font-size: 7.5pt;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  float: right;
}

.diff-low { background: #D1FAE5; color: var(--confirmed-green); }
.diff-medium { background: #FEF3C7; color: var(--alert-orange); }
.diff-high { background: #FEE2E2; color: var(--alert-red); }

/* ═══════════════════════════════════════ */
/* ROI HIGHLIGHTS                          */
/* ═══════════════════════════════════════ */

.roi-box {
  text-align: center;
  padding: 22px;
  margin: 18px 0;
  background: var(--primary);
  border-radius: 8px;
  color: white;
}

.roi-number {
  font-family: 'Raleway', sans-serif;
  font-size: 32pt;
  font-weight: 800;
  color: var(--accent-light);
}

.roi-label {
  font-size: 9.5pt;
  color: rgba(255,255,255,0.7);
  margin-top: 4px;
}

/* ═══════════════════════════════════════ */
/* FIRMA                                  */
/* ═══════════════════════════════════════ */

.sig-page { page-break-before: always; padding-top: 40px; }

.sig-title {
  font-family: 'Raleway', sans-serif;
  font-size: 16pt;
  font-weight: 700;
  color: var(--primary);
  text-align: center;
  margin-bottom: 40px;
}

.sig-boxes { display: flex; gap: 25px; }

.sig-box {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 25px 20px;
  background: var(--bg-light);
}

.sig-box h4 {
  font-family: 'Raleway', sans-serif;
  font-size: 10pt;
  font-weight: 700;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 25px 0;
  font-style: normal;
}

.sig-line {
  border-bottom: 1px solid var(--text);
  margin: 35px 0 5px 0;
}

.sig-label {
  font-size: 8.5pt;
  color: var(--text-light);
  margin-bottom: 15px;
}

.sig-validity {
  text-align: center;
  margin-top: 30px;
  font-size: 8.5pt;
  color: var(--text-light);
  font-style: italic;
}

/* ═══════════════════════════════════════ */
/* CTA PAGE                               */
/* ═══════════════════════════════════════ */

.cta-page {
  page-break-before: always;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  padding: 60px 40px;
}

.cta-page h2 {
  font-family: 'Raleway', sans-serif;
  font-size: 22pt;
  font-weight: 700;
  color: var(--primary);
  border: none;
  margin-bottom: 15px;
}

.cta-page p {
  text-align: center;
  font-size: 11pt;
  color: var(--text-light);
  margin-bottom: 40px;
}

.cta-contact {
  display: flex;
  gap: 30px;
  justify-content: center;
}

.cta-item {
  padding: 20px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-light);
  text-align: center;
  min-width: 200px;
}

.cta-item strong {
  color: var(--primary);
  display: block;
  margin-bottom: 4px;
}

.cta-item span {
  font-size: 9pt;
  color: var(--text-light);
}

.content-body {
  padding: 0 5px 0 18px;
}

.content-body ul, .content-body ol {
  padding-left: 24px;
}

.content-body p {
  margin-left: 4px;
}
`;

// ══════════════════════════════════════════════════════════════════════
// Markdown → HTML conversion
// ══════════════════════════════════════════════════════════════════════

function sanitizeMarkdown(md: string): string {
  return md
    .split("\n")
    .filter(line => !/^\s*([-*_])\s*\1\s*\1[\s\-\*\_]*$/.test(line))
    .join("\n")
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2702}-\u{27B0}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/[\u{200D}]/gu, "")
    .replace(/[\u{20E3}]/gu, "")
    .replace(/[\u{E0020}-\u{E007F}]/gu, "")
    .replace(/\n{3,}/g, "\n\n");
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineFmt(text: string): string {
  return escHtml(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function detectKpiScores(lines: string[]): { html: string; consumed: number } | null {
  const kpis: { name: string; value: number }[] = [];
  let consumed = 0;
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const m = lines[i].match(/^(?:\*\*)?(.+?)(?:\*\*)?:\s*(\d+)\/100/);
    if (m) {
      kpis.push({ name: m[1].trim(), value: parseInt(m[2]) });
      consumed = i + 1;
    } else if (lines[i].trim() === "" && kpis.length > 0) {
      consumed = i + 1;
      break;
    } else if (kpis.length > 0) {
      break;
    }
  }
  if (kpis.length < 2) return null;
  
  const boxes = kpis.map(k => `
    <div class="kpi-box">
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-label">${escHtml(k.name)}</div>
      <div class="kpi-bar"><div class="kpi-fill" style="width:${k.value}%"></div></div>
    </div>`).join("");
  
  return { html: `<div class="kpi-row">${boxes}</div>`, consumed };
}

function detectOpportunityCard(lines: string[], startIdx: number): { html: string; consumed: number } | null {
  const metricsFound: { label: string; value: string }[] = [];
  let description = "";
  let difficulty = "";
  let title = "";
  let consumed = 0;
  
  for (let i = startIdx; i < Math.min(lines.length, startIdx + 12); i++) {
    const line = lines[i].trim();
    if (i === startIdx) {
      title = line.replace(/^\*\*/, "").replace(/\*\*$/, "");
      consumed = 1;
      continue;
    }
    
    const timeMatch = line.match(/^Tiempo ahorrado:\s*(.+)/i);
    const prodMatch = line.match(/^Productividad:\s*(.+)/i);
    const diffMatch = line.match(/^Dificultad:\s*(.+)/i);
    
    if (timeMatch) {
      metricsFound.push({ label: "Tiempo ahorrado", value: timeMatch[1] });
      consumed = i - startIdx + 1;
    } else if (prodMatch) {
      metricsFound.push({ label: "Productividad", value: prodMatch[1] });
      consumed = i - startIdx + 1;
    } else if (diffMatch) {
      difficulty = diffMatch[1];
      consumed = i - startIdx + 1;
    } else if (line && !timeMatch && !prodMatch && !diffMatch && metricsFound.length === 0) {
      description += (description ? " " : "") + line;
      consumed = i - startIdx + 1;
    }
  }
  
  if (metricsFound.length < 2) return null;
  
  let diffClass = "diff-medium";
  let diffLabel = difficulty;
  if (/low|baj/i.test(difficulty)) { diffClass = "diff-low"; diffLabel = "Fácil"; }
  else if (/high|alt/i.test(difficulty)) { diffClass = "diff-high"; diffLabel = "Difícil"; }
  else { diffLabel = "Medio"; }
  const timelineMatch = difficulty.match(/·\s*(.+)/);
  const timeline = timelineMatch ? timelineMatch[1].trim() : "";
  
  const metricsHtml = metricsFound.map(m => `
    <div class="opp-metric">
      <span class="opp-metric-val">${escHtml(m.value)}</span>
      <span class="opp-metric-label">${escHtml(m.label)}</span>
    </div>`).join("");
  
  return {
    html: `<div class="opp-card">
      <h4>${escHtml(title)} <span class="diff-badge ${diffClass}">${escHtml(diffLabel)}${timeline ? " · " + escHtml(timeline) : ""}</span></h4>
      <p>${inlineFmt(description)}</p>
      <div class="opp-metrics">${metricsHtml}</div>
    </div>`,
    consumed
  };
}

function markdownToHtml(md: string): string {
  const sanitized = sanitizeMarkdown(md);
  const lines = sanitized.split("\n");
  const html: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeader: string[] = [];
  let inCodeBlock = false;
  let codeContent = "";
  
  const flushTable = () => {
    if (tableHeader.length === 0 && tableRows.length === 0) return;
    let t = "<table><tr>";
    for (const h of tableHeader) {
      t += `<th>${inlineFmt(h.trim())}</th>`;
    }
    t += "</tr>";
    for (const row of tableRows) {
      t += "<tr>";
      for (const cell of row) {
        const trimmed = cell.trim();
        let cls = "";
        if (/cr[ií]tico/i.test(trimmed)) cls = ' class="sev-critico"';
        else if (/importante/i.test(trimmed)) cls = ' class="sev-importante"';
        else if (/menor/i.test(trimmed)) cls = ' class="sev-menor"';
        t += `<td${cls}>${inlineFmt(trimmed)}</td>`;
      }
      t += "</tr>";
    }
    t += "</table>";
    html.push(t);
    tableHeader = [];
    tableRows = [];
    inTable = false;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        html.push(`<pre><code>${escHtml(codeContent)}</code></pre>`);
        codeContent = "";
        inCodeBlock = false;
        i++;
        continue;
      } else {
        inCodeBlock = true;
        i++;
        continue;
      }
    }
    if (inCodeBlock) {
      codeContent += (codeContent ? "\n" : "") + line;
      i++;
      continue;
    }
    
    if (line.includes("|") && line.trim().startsWith("|")) {
      const cells = line.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (/^[\s\-:]+$/.test(cells.join(""))) {
        i++;
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      i++;
      continue;
    } else if (inTable) {
      flushTable();
    }
    
    if (/^\[PENDIENTE:/i.test(line.trim())) {
      const text = line.trim().replace(/^\[PENDIENTE:\s*/, "").replace(/\]$/, "");
      html.push(`<div class="callout callout-pending"><div class="callout-title">⚠ PENDIENTE</div>${inlineFmt(text)}</div>`);
      i++;
      continue;
    }
    if (/^\[ALERTA:/i.test(line.trim())) {
      const text = line.trim().replace(/^\[ALERTA:\s*/, "").replace(/\]$/, "");
      html.push(`<div class="callout callout-alert"><div class="callout-title">🔴 ALERTA</div>${inlineFmt(text)}</div>`);
      i++;
      continue;
    }
    if (/^\[CONFIRMADO:/i.test(line.trim())) {
      const text = line.trim().replace(/^\[CONFIRMADO:\s*/, "").replace(/\]$/, "");
      html.push(`<div class="callout callout-confirmed"><div class="callout-title">✅ CONFIRMADO</div>${inlineFmt(text)}</div>`);
      i++;
      continue;
    }
    
    if (line.startsWith("# ")) {
      html.push(`<h1>${inlineFmt(line.slice(2))}</h1>`);
      const kpiResult = detectKpiScores(lines.slice(i + 1));
      if (kpiResult) {
        html.push(kpiResult.html);
        i += kpiResult.consumed;
      }
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      html.push(`<h2>${inlineFmt(line.slice(3))}</h2>`);
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      html.push(`<h3>${inlineFmt(line.slice(4))}</h3>`);
      i++;
      continue;
    }
    if (line.startsWith("#### ")) {
      html.push(`<h4>${inlineFmt(line.slice(5))}</h4>`);
      i++;
      continue;
    }
    if (line.startsWith("##### ")) {
      html.push(`<h5>${inlineFmt(line.slice(6))}</h5>`);
      i++;
      continue;
    }
    
    if (/^(\s*)[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(\s*)[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^(\s*)[-*]\s/, ""));
        i++;
      }
      html.push("<ul>" + items.map(item => `<li>${inlineFmt(item)}</li>`).join("") + "</ul>");
      continue;
    }
    
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      html.push("<ol>" + items.map(item => `<li>${inlineFmt(item)}</li>`).join("") + "</ol>");
      continue;
    }
    
    if (line.startsWith("> ")) {
      html.push(`<blockquote>${inlineFmt(line.slice(2))}</blockquote>`);
      i++;
      continue;
    }
    
    if (line.trim() === "") {
      i++;
      continue;
    }
    
    html.push(`<p>${inlineFmt(line)}</p>`);
    i++;
  }
  
  if (inTable) flushTable();
  
  return html.join("\n");
}

// ══════════════════════════════════════════════════════════════════════
// Client dictionary for jargon translation (C1)
// ══════════════════════════════════════════════════════════════════════

const CLIENT_DICTIONARY: Record<string, string> = {
  'RAG': 'Base de conocimiento especializada',
  'Knowledge Graph': 'Mapa de relaciones y conceptos',
  'KG': 'Mapa de relaciones',
  'LLM': 'Motor de inteligencia artificial',
  'router de modelos': 'Sistema de optimización automática',
  'scraping': 'Monitorización automática de fuentes',
  'embeddings': 'Análisis semántico',
  'chunks': 'Fragmentos de conocimiento',
  'fine-tuning': 'Especialización del modelo',
  'pipeline': 'Flujo de procesamiento',
  'webhook': 'Notificación automática',
  'LangGraph': 'Motor de orquestación',
  'Supabase': 'Plataforma de datos',
  'edge function': 'Procesamiento en la nube',
  'edge functions': 'Procesamiento en la nube',
  'vector database': 'Base de datos inteligente',
};

function translateForClient(text: string): string {
  let result = text;
  for (const [term, translation] of Object.entries(CLIENT_DICTIONARY)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    result = result.replace(regex, translation);
  }
  return result;
}

// ══════════════════════════════════════════════════════════════════════
// Full sanitization pipeline for individual text fields (step 100)
// ══════════════════════════════════════════════════════════════════════

function sanitizeTextForClient(text: string): string {
  if (!text || typeof text !== "string") return text || "";
  let t = text;

  // 1. Autoclose + strip [[INTERNAL_ONLY]]
  const ac = autocloseInternalOnly(t);
  t = ac.content;
  t = stripInternalOnly(t);

  // 2. Strip changelog
  t = stripChangelog(t);

  // 3. Strip [[NO_APLICA:*]]
  t = stripNoAplica(t);

  // 4. Process PENDING and NEEDS_CLARIFICATION tags (client mode)
  t = processPendingTags(t, true);
  t = processNeedsClarification(t, true);

  // 5. Strip [HIPÓTESIS] / [HIPOTESIS] tags
  t = t.replace(/\[HIP[OÓ]TESIS\]/gi, "");

  // 6. Strip all mentions of Lovable
  t = t.replace(/\bLovable[\s.-]*(?:dev|ready|Build|Blueprint)?\b/gi, "");
  t = t.replace(/copy[\s-]*paste\s+en\s+Lovable/gi, "");
  t = t.replace(/LOVABLE\s*BUILD\s*BLUEPRINT/gi, "");
  t = t.replace(/Sistema\s+Lovable[\s-]*ready/gi, "Sistema preparado");

  // 7. Generalize AI model names
  t = t.replace(/\bClaude\s*3\.?5?\s*(Haiku|Sonnet|Opus)?\b/gi, "Motor de IA");
  t = t.replace(/\bClaude\b/gi, "Motor de IA");
  t = t.replace(/\bAnthropic\s*(API)?\b/gi, "Motor de IA");
  t = t.replace(/\bGemini\s*(Pro|Flash|Ultra)?\b/gi, "Motor de IA");
  t = t.replace(/\bOpenAI\b/gi, "Motor de IA");
  t = t.replace(/\bGPT-?4[o\s]?\b/gi, "Motor de IA");
  t = t.replace(/\bGoogle\s*Vision\b/gi, "Motor de reconocimiento visual");
  // Collapse repeated "Motor de IA"
  t = t.replace(/(Motor de IA[,\s]*){2,}/gi, "Motor de IA ");

  // 8. Dedup + bad phrases
  t = deduplicateText(t);
  t = fixKnownBadPhrases(t);

  // 9. Translate tech jargon
  t = translateForClient(t);

  return t;
}

function stripChangelog(text: string): string {
  return text.replace(/\n---\s*\n+##\s*CHANGELOG[\s\S]*$/i, '');
}

// ── Tag System: [[INTERNAL_ONLY]]..[[/INTERNAL_ONLY]], [[PENDING:*]], [[NEEDS_CLARIFICATION:*]], [[NO_APLICA:*]] ──

/** Autoclose unclosed [[INTERNAL_ONLY]] tags by appending [[/INTERNAL_ONLY]] at EOF */
function autocloseInternalOnly(content: string): { content: string; fixed: boolean; missing: number } {
  const open = (content.match(/\[\[INTERNAL_ONLY\]\]/g) || []).length;
  const close = (content.match(/\[\[\/INTERNAL_ONLY\]\]/g) || []).length;
  const missing = Math.max(0, open - close);
  if (missing === 0) return { content, fixed: false, missing: 0 };
  return {
    content: content + "\n\n" + Array(missing).fill("[[/INTERNAL_ONLY]]").join("\n"),
    fixed: true,
    missing
  };
}

/** Extract all [[PENDING:X]] tags from content */
function extractPendingTags(text: string): string[] {
  const matches = text.match(/\[\[PENDING:([^\]]+)\]\]/g) || [];
  return matches.map(m => m.replace(/\[\[PENDING:/, '').replace(/\]\]$/, ''));
}

/** Extract all [[NEEDS_CLARIFICATION:X]] tags from content */
function extractNeedsClarificationTags(text: string): string[] {
  const matches = text.match(/\[\[NEEDS_CLARIFICATION:([^\]]+)\]\]/g) || [];
  return matches.map(m => m.replace(/\[\[NEEDS_CLARIFICATION:/, '').replace(/\]\]$/, ''));
}

/** Check if content has NOTA MVP in implementation section */
function hasNotaMvp(text: string): boolean {
  return /NOTA\s+MVP/i.test(text);
}

/** Simple text deduplication — removes repeated bigrams within sentences */
function deduplicateText(text: string): string {
  return text.split('\n').map(line => {
    const words = line.split(/\s+/);
    if (words.length < 6) return line;
    for (let len = 8; len >= 3; len--) {
      for (let i = 0; i <= words.length - len * 2; i++) {
        const phrase = words.slice(i, i + len).join(' ').toLowerCase();
        const nextPhrase = words.slice(i + len, i + len * 2).join(' ').toLowerCase();
        if (phrase === nextPhrase && phrase.length > 10) {
          words.splice(i + len, len);
          return words.join(' ');
        }
      }
    }
    return line;
  }).join('\n');
}

function fixKnownBadPhrases(text: string): string {
  const fixes: [RegExp, string][] = [
    [/monitorización automática de fuentes\s+automátic[oa]/gi, "Monitorización automática de fuentes"],
  ];
  let result = text;
  for (const [pattern, replacement] of fixes) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function stripInternalOnly(text: string): string {
  // Solo borramos bloques bien formados. Los no formados se corrigen antes con autocloseInternalOnly().
  return text.replace(/\[\[INTERNAL_ONLY\]\][\s\S]*?\[\[\/INTERNAL_ONLY\]\]/g, '');
}

function stripNoAplica(text: string): string {
  return text.replace(/^.*\[\[NO_APLICA:[^\]]*\]\].*\n?/gm, '');
}

function processPendingTags(text: string, isClientMode: boolean): string {
  if (!isClientMode) return text;
  return text.replace(/\[\[PENDING:([^\]]+)\]\]/g, '________________');
}

function processNeedsClarification(text: string, isClientMode: boolean): string {
  if (!isClientMode) return text;
  return text.replace(/\[\[NEEDS_CLARIFICATION:([^\]]+)\]\]/g, '[Por confirmar]');
}

// ══════════════════════════════════════════════════════════════════════
// Audit scoring — computeScoreFromAudit
// ══════════════════════════════════════════════════════════════════════

type SeverityKey = "CRIT" | "IMP" | "MEN";

const severityMap = (s: string): SeverityKey | null => {
  const x = (s || "").toLowerCase();
  if (["crítico", "critico", "critical", "crit"].includes(x)) return "CRIT";
  if (["importante", "major", "imp"].includes(x)) return "IMP";
  if (["menor", "minor", "men"].includes(x)) return "MEN";
  return null;
};

const isOpenHallazgo = (h: any): boolean => {
  const s = (h?.status ?? h?.estado ?? h?.state ?? "").toString().toLowerCase();
  return s === "abierto" || s === "open" || h?.abierto === true;
};

function computeScoreFromAudit(auditJson: any): { score: number; scoreBreakdown: { CRIT: number; IMP: number; MEN: number; NO_APLICA: number } } {
  const hallazgos = auditJson?.hallazgos || auditJson?.findings || [];
  let CRIT = 0, IMP = 0, MEN = 0, NO_APLICA = 0;

  for (const h of hallazgos) {
    const raw = (h?.tag || h?.estado_tag || "").toString();
    if (raw.includes("[[NO_APLICA") || raw.includes("NO_APLICA")) { NO_APLICA++; continue; }

    if (!isOpenHallazgo(h)) continue;

    const sev = severityMap(h?.severidad ?? h?.severity ?? "");
    if (sev === "CRIT") CRIT++;
    else if (sev === "IMP") IMP++;
    else if (sev === "MEN") MEN++;
  }

  const score = Math.max(0, 100 - (CRIT * 20 + IMP * 10 + MEN * 3));
  return { score, scoreBreakdown: { CRIT, IMP, MEN, NO_APLICA } };
}

// ══════════════════════════════════════════════════════════════════════
// Export validation
// ══════════════════════════════════════════════════════════════════════

/** Run full validation checklist on content, returns validation result */
function runExportValidation(
  content: string,
  isClientMode: boolean,
  stepNumber: number,
  auditJson?: any,
  allowDraft?: boolean
): {
  canExport: boolean;
  pendingTags: string[];
  needsClarification: string[];
  hasNotaMvp: boolean;
  dedupApplied: boolean;
  issues: string[];
  warnings: { type: string; key: string; message: string }[];
  score?: number;
  scoreBreakdown?: { CRIT: number; IMP: number; MEN: number; NO_APLICA: number };
} {
  const pendingTags = extractPendingTags(content);
  const ncTags = extractNeedsClarificationTags(content);
  const mvpPresent = hasNotaMvp(content);
  const issues: string[] = [];
  const warnings: { type: string; key: string; message: string }[] = [];

  if (isClientMode && pendingTags.length > 0) {
    issues.push(`${pendingTags.length} campos PENDING sin resolver: ${pendingTags.join(', ')}`);
  }
  if (ncTags.length > 0) {
    issues.push(`${ncTags.length} campos por clarificar: ${ncTags.join(', ')}`);
  }

  // Warning: check for "Exclusiones Explícitas" section in steps 4/5
  if ((stepNumber === 4 || stepNumber === 5) && !/exclusiones\s+expl[ií]citas/i.test(content)) {
    warnings.push({
      type: "warning",
      key: "no_exclusiones_section",
      message: "No se detectó sección 'Exclusiones Explícitas'. Los hallazgos de tipo OMISIÓN no podrán convertirse a NO_APLICA automáticamente.",
    });
  }

  // Compute score from audit data if available (steps 4/5 only)
  let score: number | undefined;
  let scoreBreakdown: { CRIT: number; IMP: number; MEN: number; NO_APLICA: number } | undefined;
  if (auditJson && (stepNumber === 4 || stepNumber === 5)) {
    const auditData = typeof auditJson === "string" ? (() => { try { return JSON.parse(auditJson); } catch { return null; } })() : auditJson;
    if (auditData && (auditData.hallazgos || auditData.findings)) {
      const result = computeScoreFromAudit(auditData);
      score = result.score;
      scoreBreakdown = result.scoreBreakdown;
    }
  }

  return {
    canExport: isClientMode ? (pendingTags.length === 0 || !!allowDraft) : true,
    pendingTags,
    needsClarification: ncTags,
    hasNotaMvp: mvpPresent,
    dedupApplied: true,
    issues,
    warnings,
    score,
    scoreBreakdown,
  };
}

// ══════════════════════════════════════════════════════════════════════
// HTML document assembly
// ══════════════════════════════════════════════════════════════════════

function extractHeadings(htmlContent: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  const regex = /<h([1-2])[^>]*>(.*?)<\/h\1>/gi;
  let match;
  while ((match = regex.exec(htmlContent)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, "");
    headings.push({ level: parseInt(match[1]), text });
  }
  return headings;
}

function buildTocHtml(headings: { level: number; text: string }[]): string {
  let h1Counter = 0;
  let h2Counter = 0;
  return headings.map(h => {
    if (h.level === 1) {
      h1Counter++;
      h2Counter = 0;
      return `<div class="toc-h1">${h1Counter}. ${escHtml(h.text)}</div>`;
    } else {
      h2Counter++;
      return `<div class="toc-h2">${h1Counter}.${h2Counter}. ${escHtml(h.text)}</div>`;
    }
  }).join("\n");
}

function buildCoverHtml(
  title: string,
  projectName: string,
  company: string,
  date: string,
  version: string,
  isInternalMode: boolean = false,
  isDraft: boolean = false
): string {
  let badge: string;
  if (isInternalMode) {
    badge = `<div class="cover-badge" style="background:#D97706;">BORRADOR INTERNO — NO DISTRIBUIR</div>`;
  } else if (isDraft) {
    badge = `<div class="cover-badge" style="background:#D97706;">BORRADOR PARA REVISIÓN — NO ENVIAR</div>`;
  } else {
    badge = `<div class="cover-badge">CONFIDENCIAL</div>`;
  }
  const subtitle = (isInternalMode || isDraft)
    ? ""
    : (company ? `<div class="cover-date">${escHtml(company)}</div>` : "");
  return `
  <div class="cover-page">
    <div class="cover-header">
      <div class="logo-text">
        <span class="man">Man</span><span class="ias">IAS</span>
        <span class="lab"> Lab</span><span class="dot">.</span>
      </div>
    </div>
    <div class="cover-body">
      <div class="cover-title">${escHtml(projectName)}</div>
      <div class="cover-divider"></div>
      <div class="cover-doc-type">${escHtml(title)}</div>
      ${subtitle}
      <div class="cover-date">${escHtml(date)}</div>
      ${badge}
    </div>
    <div class="cover-bottom-bar">
      <span>ManIAS Lab. | Consultora Tecnológica y Marketing Digital</span>
    </div>
  </div>`;
}

function buildSignatureHtml(company: string, date: string): string {
  return `
  <div class="sig-page">
    <div class="sig-title">Aceptación del Documento</div>
    <div class="sig-boxes">
      <div class="sig-box">
        <h4>Por ${escHtml(company || "el Cliente")}</h4>
        <div class="sig-label">Firma:</div>
        <div class="sig-line"></div>
        <div class="sig-label">Nombre: ________________</div>
        <div class="sig-label">Fecha: ___/___/2026</div>
      </div>
      <div class="sig-box">
        <h4>Por ManIAS Lab.</h4>
        <div class="sig-label">Firma:</div>
        <div class="sig-line"></div>
        <div class="sig-label">Nombre: Agustín Cifuentes</div>
        <div class="sig-label">Fecha: ___/___/2026</div>
      </div>
    </div>
    <div class="sig-validity">Validez: 15 días naturales desde fecha de emisión</div>
  </div>`;
}

function buildFullHtml(
  title: string,
  projectName: string,
  company: string,
  date: string,
  version: string,
  htmlContent: string,
  isClientFacing: boolean,
  isInternalMode: boolean = false,
  isDraft: boolean = false
): string {
  const headings = extractHeadings(htmlContent);
  const tocHtml = buildTocHtml(headings);
  const coverHtml = buildCoverHtml(title, projectName, company, date, version, isInternalMode, isDraft);
  const signatureHtml = (isClientFacing && !isDraft) ? buildSignatureHtml(company, date) : "";

  return `<!DOCTYPE html>
<html lang="es">
  <head><meta charset="UTF-8"><style>${CSS}</style></head>
  <body>
  ${coverHtml}

  <div class="toc-page">
    <div class="section-bar">Índice</div>
    ${tocHtml}
  </div>

  <div class="content-body">
    ${htmlContent}
  </div>

  ${signatureHtml}

  <div class="cta-page">
    <h2>¿Listo para dar el siguiente paso?</h2>
    <p>Contacta con nosotros para transformar tu negocio con tecnología e inteligencia artificial.</p>
    <div class="cta-contact">
      <div class="cta-item">
        <strong>Agustín Cifuentes</strong>
        <span>Consultor Senior / Experto IA</span>
      </div>
      <div class="cta-item">
        <strong>ManIAS Lab.</strong>
        <span>Consultora Tecnológica</span>
      </div>
    </div>
  </div>
  </body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════
// HTML → PDF via html2pdf.app API — with mode-aware headers
// ══════════════════════════════════════════════════════════════════════

function getHeaderTemplate(params: { exportMode: string; allowDraft?: boolean; company?: string; dateStr: string }): string {
  const { exportMode, allowDraft, company, dateStr } = params;

  if (exportMode === "internal") {
    return `<div style="font-size:7pt;color:#D97706;width:100%;text-align:center;padding:0 18mm;">BORRADOR INTERNO — NO DISTRIBUIR</div>`;
  }
  if (allowDraft) {
    return `<div style="font-size:7pt;color:#D97706;width:100%;text-align:center;padding:0 18mm;">BORRADOR PARA REVISIÓN — NO ENVIAR</div>`;
  }
  return `<div style="font-size:7pt;color:#6B7280;width:100%;text-align:right;padding-right:18mm;">CONFIDENCIAL — ${(company || "").replace(/"/g, "&quot;")} — ${dateStr}</div>`;
}

async function convertHtmlToPdf(
  html: string,
  projectName: string,
  headerParams?: { exportMode: string; allowDraft?: boolean; company?: string; dateStr: string }
): Promise<Uint8Array> {
  const apiKey = Deno.env.get("HTML2PDF_API_KEY");
  
  if (!apiKey) {
    throw new Error("HTML2PDF_API_KEY not configured. Add it to Supabase secrets.");
  }

  const headerTemplate = headerParams
    ? getHeaderTemplate(headerParams)
    : `<div style="font-size:7pt;color:#6B7280;width:100%;text-align:right;padding-right:18mm;">CONFIDENCIAL</div>`;

  const response = await fetch("https://api.html2pdf.app/v1/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      apiKey,
      format: "A4",
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate: `<div style="width:calc(100% - 40mm);margin:0 18mm 0 22mm;border-top:0.5px solid #E5E7EB;padding:5px 0 0;display:flex;justify-content:space-between;font-size:7pt;color:#9A9A9A;font-family:Montserrat,Arial,sans-serif;"><span>ManIAS Lab.</span><span>Pág <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`html2pdf.app API error: ${response.status} — ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// ══════════════════════════════════════════════════════════════════════
// Step titles
// ══════════════════════════════════════════════════════════════════════

const STEP_TITLES: Record<number, string> = {
  2: "Briefing Extraído",
  3: "Borrador de Alcance",
  4: "Auditoría Cruzada",
  5: "Documento de Alcance",
  6: "Estimación de Presupuesto",
  7: "PRD Técnico",
  8: "Generación de RAGs",
  9: "Detección de Patrones",
  10: "Documento Final de Auditoría",
  11: "Cuestionario de Auditoría",
  12: "Radiografía del Negocio",
  13: "Plan por Capas",
  14: "Roadmap Vendible",
  100: "Propuesta de Solución",
  101: "Resumen Ejecutivo",
};

// ══════════════════════════════════════════════════════════════════════
// Main handler
// ══════════════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, stepNumber, content, contentType, projectName, company, date, version, exportMode, validateOnly, allowDraft, auditJson } = await req.json();

    if (!projectId || !stepNumber || !content) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawTitle = STEP_TITLES[stepNumber] || `Fase ${stepNumber}`;
    const title = (stepNumber === 6 && exportMode === "client") ? "Propuesta Económica" : rawTitle;
    const dateRaw = date?.includes("-") ? date : date?.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") || new Date().toISOString().split("T")[0];
    const [_y, _m, _d] = dateRaw.split("-");
    const dateStr = `${_d}/${_m}/${_y}`;
    const ver = version || "v1";
    const isClientMode = exportMode === "client";
    const isInternalMode = exportMode === "internal";
    const isClientFacing = !isInternalMode && ([3, 5, 7, 100, 101].includes(stepNumber) || stepNumber === 6);
    const isDraft = isClientMode && allowDraft === true;

    // ── Validate-only mode: return validation without generating PDF ──
    if (validateOnly) {
      const rawContent = typeof content === "string" ? content : (content?.document || JSON.stringify(content));
      const validation = runExportValidation(rawContent, isClientMode, stepNumber, auditJson, allowDraft);
      return new Response(JSON.stringify({ validation }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // PIPELINE ORDER (P0):
    // 1. autocloseInternalOnly — structure safety
    // 2. deduplicateText — cleanup
    // 3. stripChangelog — legacy docs
    // 4. stripInternalOnly — remove confidential blocks
    // 5. stripNoAplica — client mode
    // 6. PENDING block check — with allowDraft bypass
    // 7. processPendingTags / processNeedsClarification
    // 8. translateForClient
    // ══════════════════════════════════════════════════════════════════

    let processedContent: any = content;

    // Step 1: Autoclose unclosed [[INTERNAL_ONLY]] tags (structure safety first)
    if (typeof processedContent === "string") {
      const autocloseResult = autocloseInternalOnly(processedContent);
      if (autocloseResult.fixed) {
        console.log(`[Pipeline] Autoclosed ${autocloseResult.missing} unclosed [[INTERNAL_ONLY]] tag(s)`);
      }
      processedContent = autocloseResult.content;
    }

    // Step 2: Deduplication pass
    if (typeof processedContent === "string") {
      processedContent = deduplicateText(processedContent);
    }

    // Step 2b: Known bad phrases fix (post-dedup, pre-strip)
    if (typeof processedContent === "string") {
      processedContent = fixKnownBadPhrases(processedContent);
    }

    // Step 3: Strip changelog (non-internal mode)
    if (!isInternalMode && typeof processedContent === "string") {
      processedContent = stripChangelog(processedContent);
    }

    // Step 4: Strip [[INTERNAL_ONLY]]..[[/INTERNAL_ONLY]] blocks (non-internal mode)
    if (!isInternalMode && typeof processedContent === "string") {
      processedContent = stripInternalOnly(processedContent);
    }

    // Step 5: Strip [[NO_APLICA:*]] in client mode
    if (isClientMode && typeof processedContent === "string") {
      processedContent = stripNoAplica(processedContent);
    }

    // Step 6: PENDING block check with allowDraft bypass
    if (typeof processedContent === "string") {
      if (isClientMode) {
        const pendingTags = extractPendingTags(processedContent);
        if (pendingTags.length > 0 && !allowDraft) {
          // BLOCK client FINAL export if PENDING tags remain
          return new Response(JSON.stringify({
            error: "EXPORT_BLOCKED",
            message: `No se puede exportar en modo Cliente FINAL: hay ${pendingTags.length} campo(s) [[PENDING]] sin resolver.`,
            pendingTags,
          }), {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // If allowDraft and PENDING tags exist, continue (draft mode)
        if (pendingTags.length > 0 && allowDraft) {
          console.log(`[Pipeline] Draft mode: ${pendingTags.length} PENDING tag(s) allowed through`);
        }
      }

      // Step 7: Process tags for rendering
      processedContent = processPendingTags(processedContent, isClientMode);
      processedContent = processNeedsClarification(processedContent, isClientMode);
    }

    // Step 8: Apply client dictionary in client mode
    if (isClientMode && typeof processedContent === "string") {
      processedContent = translateForClient(processedContent);
    }

    let htmlContent: string;

    // ── Step 100: Unified Client Proposal renderer ──
    if (stepNumber === 100 && typeof processedContent === "object" && processedContent !== null) {
      const proposal = processedContent as any;
      const parts: string[] = [];

      // ── Sanitize all text fields before rendering ──
      const cleanScope = sanitizeTextForClient(
        typeof proposal.scope === "string" ? proposal.scope : ""
      );
      const cleanTech = sanitizeTextForClient(
        typeof proposal.techSummary === "string" ? proposal.techSummary : ""
      );

      // Section 1: Executive Summary (short extract — max 5 paragraphs, no duplication)
      parts.push(`<h1>Resumen Ejecutivo</h1>`);
      if (cleanScope) {
        const scopeLines = cleanScope.split("\n");
        const summaryLines: string[] = [];
        let paragraphCount = 0;
        for (const sl of scopeLines) {
          if (paragraphCount >= 5) break;
          if (/^##\s/.test(sl) && summaryLines.length > 3) break;
          summaryLines.push(sl);
          if (sl.trim() === "") paragraphCount++;
        }
        parts.push(markdownToHtml(summaryLines.join("\n")));
      }

      // Section 2: Full Scope (complete, already sanitized)
      parts.push(`<h1>Alcance de la Solución</h1>`);
      if (cleanScope) {
        parts.push(markdownToHtml(cleanScope));
      }

      // Section 3: AI Opportunities (sanitized)
      if (proposal.aiOpportunities) {
        parts.push(`<h1>Oportunidades de Inteligencia Artificial</h1>`);
        const aiData = proposal.aiOpportunities;

        // Filter internal keys from top-level
        const internalKeys = new Set(["parse_error", "raw_response", "raw_text", "_score", "_internal", "_debug", "_meta", "_tokens"]);

        if (aiData.opportunities && Array.isArray(aiData.opportunities)) {
          for (const opp of aiData.opportunities) {
            parts.push(`<div class="opp-card">`);
            parts.push(`<h4>${escHtml(opp.title || opp.name || "")}</h4>`);
            if (opp.description) parts.push(`<p>${escHtml(sanitizeTextForClient(opp.description))}</p>`);
            const metrics: string[] = [];
            if (opp.time_saved) metrics.push(`<div class="opp-metric"><span class="opp-metric-val">${escHtml(String(opp.time_saved))}</span><span class="opp-metric-label">Tiempo ahorrado</span></div>`);
            if (opp.productivity) metrics.push(`<div class="opp-metric"><span class="opp-metric-val">${escHtml(String(opp.productivity))}</span><span class="opp-metric-label">Productividad</span></div>`);
            if (opp.roi) metrics.push(`<div class="opp-metric"><span class="opp-metric-val">${escHtml(String(opp.roi))}</span><span class="opp-metric-label">ROI</span></div>`);
            if (metrics.length) parts.push(`<div class="opp-metrics">${metrics.join("")}</div>`);
            parts.push(`</div>`);
          }
        } else if (typeof aiData === "string") {
          parts.push(markdownToHtml(sanitizeTextForClient(aiData)));
        } else {
          // Render as generic sections — filter internal keys
          for (const [key, value] of Object.entries(aiData)) {
            if (key.startsWith("_") || internalKeys.has(key) || !value) continue;
            const heading = key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
            if (typeof value === "string") {
              parts.push(`<h2>${escHtml(heading)}</h2>`);
              parts.push(markdownToHtml(sanitizeTextForClient(value)));
            } else if (Array.isArray(value) && value.length > 0) {
              parts.push(`<h2>${escHtml(heading)}</h2>`);
              if (typeof value[0] === "object") {
                for (const item of value) {
                  parts.push(`<div class="opp-card">`);
                  const title = item.title || item.name || item.nombre || "";
                  if (title) parts.push(`<h4>${escHtml(title)}</h4>`);
                  const desc = item.description || item.descripcion || "";
                  if (desc) parts.push(`<p>${escHtml(sanitizeTextForClient(desc))}</p>`);
                  parts.push(`</div>`);
                }
              } else {
                parts.push(`<ul>${value.map((v: any) => `<li>${escHtml(String(v))}</li>`).join("")}</ul>`);
              }
            }
          }
        }
      }

      // Section 4: Technical Architecture (simplified, sanitized PRD)
      if (cleanTech) {
        parts.push(`<h1>Arquitectura y Solución Técnica</h1>`);
        parts.push(markdownToHtml(cleanTech));
      }

      // Section 5: Implementation Plan with Gantt
      if (proposal.budget?.development?.phases?.length) {
        parts.push(`<h1>Plan de Implementación</h1>`);
        const phases = proposal.budget.development.phases;
        const totalHours = phases.reduce((s: number, p: any) => s + (p.hours || 0), 0);

        // Phase table — show duration in weeks, NOT hours (client-facing)
        parts.push(`<table><tr><th>Fase</th><th>Descripción</th><th>Duración estimada</th></tr>`);
        for (const p of phases) {
          const weeks = Math.max(1, Math.round((p.hours || 0) / 40));
          const durationLabel = weeks <= 1 ? "1 semana" : `${weeks} semanas`;
          parts.push(`<tr><td><strong>${escHtml(p.name || "")}</strong></td><td>${escHtml(p.description || "")}</td><td style="text-align:center">${durationLabel}</td></tr>`);
        }
        parts.push(`</table>`);

        // Simple Gantt chart (CSS bars)
        parts.push(`<h2>Cronograma Visual</h2>`);
        parts.push(`<div style="margin:16px 0;">`);
        let cumulativeWeeks = 0;
        const totalWeeks = Math.max(1, Math.round(totalHours / 40));
        const colors = ["#0D9488", "#0891B2", "#7C3AED", "#DB2777", "#EA580C", "#059669", "#4F46E5", "#DC2626"];

        for (let pi = 0; pi < phases.length; pi++) {
          const p = phases[pi];
          const phaseWeeks = Math.max(1, Math.round((p.hours || 0) / 40));
          const leftPct = (cumulativeWeeks / totalWeeks) * 100;
          const widthPct = Math.max(5, (phaseWeeks / totalWeeks) * 100);
          const color = colors[pi % colors.length];

          parts.push(`<div style="display:flex;align-items:center;margin-bottom:8px;">`);
          parts.push(`<div style="width:140px;flex-shrink:0;font-size:8.5pt;font-weight:600;color:var(--text);">${escHtml(p.name || `Fase ${pi + 1}`)}</div>`);
          parts.push(`<div style="flex:1;height:24px;background:var(--bg-light);border-radius:4px;position:relative;border:1px solid var(--border-light);">`);
          parts.push(`<div style="position:absolute;left:${leftPct}%;width:${widthPct}%;height:100%;background:${color};border-radius:3px;display:flex;align-items:center;justify-content:center;">`);
          parts.push(`<span style="font-size:7pt;color:white;font-weight:600;">${phaseWeeks}sem</span>`);
          parts.push(`</div></div></div>`);

          cumulativeWeeks += phaseWeeks;
        }
        parts.push(`</div>`);

        // KPI boxes: only show weeks and phases count — NOT hours
        parts.push(`<div class="kpi-row">`);
        parts.push(`<div class="kpi-box"><div class="kpi-value">${totalWeeks} sem</div><div class="kpi-label">Duración estimada</div></div>`);
        parts.push(`<div class="kpi-box"><div class="kpi-value">${phases.length}</div><div class="kpi-label">Fases</div></div>`);
        parts.push(`</div>`);
      }

      // Section 6: Investment — NO hourly_rate, NO total_hours, NO your_cost
      parts.push(`<h1>Inversión</h1>`);
      if (proposal.budget?.development) {
        const dev = proposal.budget.development;
        parts.push(`<h2>Desarrollo</h2>`);
        if (dev.phases?.length) {
          parts.push(`<table><tr><th>Fase</th><th>Inversión (€)</th></tr>`);
          for (const p of dev.phases) {
            parts.push(`<tr><td><strong>${escHtml(p.name || "")}</strong></td><td style="text-align:right">€${(p.cost_eur ?? 0).toLocaleString("es-ES")}</td></tr>`);
          }
          parts.push(`</table>`);
        }
        if (dev.total_development_eur != null) {
          parts.push(`<div class="roi-box"><div class="roi-number">€${(dev.total_development_eur ?? 0).toLocaleString("es-ES")}</div><div class="roi-label">Inversión total en desarrollo</div></div>`);
        }
      }

      if (proposal.budget?.recurring_monthly) {
        const r = proposal.budget.recurring_monthly;
        parts.push(`<h2>Costes Recurrentes</h2>`);
        if (r.items?.length) {
          parts.push(`<table><tr><th>Concepto</th><th>Coste (€/mes)</th></tr>`);
          for (const item of r.items) {
            parts.push(`<tr><td>${escHtml(item.name || "")}</td><td style="text-align:right">€${item.cost_eur ?? 0}</td></tr>`);
          }
          parts.push(`</table>`);
        }
        if (r.total_monthly_eur != null) {
          parts.push(`<p><strong>Total mensual recurrente:</strong> €${r.total_monthly_eur}/mes</p>`);
        }
      }

      // Monetization models (client-safe — no margins)
      if (proposal.budget?.monetization_models?.length) {
        parts.push(`<h2>Opciones de Modelo Comercial</h2>`);
        for (const model of proposal.budget.monetization_models) {
          const isRec = proposal.budget.recommended_model === model.name;
          parts.push(`<div class="opp-card"${isRec ? ' style="border-left-color:#059669;border-left-width:5px;"' : ""}>`);
          parts.push(`<h4>${escHtml(model.name)}${isRec ? ' <span class="diff-badge diff-low">★ Recomendado</span>' : ""}</h4>`);
          parts.push(`<p>${escHtml(model.description || "")}</p>`);
          const metrics: string[] = [];
          if (model.setup_price_eur) metrics.push(`<div class="opp-metric"><span class="opp-metric-val">€${escHtml(model.setup_price_eur)}</span><span class="opp-metric-label">Setup</span></div>`);
          if (model.monthly_price_eur) metrics.push(`<div class="opp-metric"><span class="opp-metric-val">€${escHtml(model.monthly_price_eur)}</span><span class="opp-metric-label">Mensual</span></div>`);
          if (model.price_range && !model.setup_price_eur && !model.monthly_price_eur) metrics.push(`<div class="opp-metric"><span class="opp-metric-val">${escHtml(model.price_range)}</span><span class="opp-metric-label">Precio</span></div>`);
          if (metrics.length) parts.push(`<div class="opp-metrics">${metrics.join("")}</div>`);
          if (model.pros?.length || model.cons?.length) {
            parts.push(`<table style="margin-top:10px;"><tr><th style="background:#059669;">Beneficios</th><th style="background:#DC2626;">Consideraciones</th></tr><tr>`);
            parts.push(`<td><ul>${(model.pros || []).map((p: string) => `<li>${escHtml(p)}</li>`).join("")}</ul></td>`);
            parts.push(`<td><ul>${(model.cons || []).map((c: string) => `<li>${escHtml(c)}</li>`).join("")}</ul></td>`);
            parts.push(`</tr></table>`);
          }
          if (model.best_for) parts.push(`<p style="font-style:italic;font-size:9pt;color:var(--text-light);margin-top:6px;">Ideal para: ${escHtml(model.best_for)}</p>`);
          parts.push(`</div>`);
        }
      }

      // Section 7: Next Steps
      parts.push(`<h1>Próximos Pasos</h1>`);
      parts.push(`<ol>`);
      parts.push(`<li><strong>Revisión de esta propuesta</strong> — Validar el alcance funcional y el modelo comercial preferido.</li>`);
      parts.push(`<li><strong>Reunión de arranque (Kick-off)</strong> — Definir equipo, accesos y calendario detallado.</li>`);
      parts.push(`<li><strong>Fase 0 – Configuración</strong> — Preparación del entorno técnico y primeros prototipos.</li>`);
      parts.push(`<li><strong>Entregas iterativas</strong> — Demos periódicas para validación continua.</li>`);
      parts.push(`</ol>`);

      htmlContent = parts.join("\n");
    }
    // ── Step 101: Simplified Executive Summary (3-5 pages) ──
    else if (stepNumber === 101 && typeof processedContent === "object" && processedContent !== null) {
      const proposal = processedContent as any;
      const parts: string[] = [];

      // Sanitize scope and filter out "Comparativa" / "Alternativas" sections
      let cleanScope = sanitizeTextForClient(
        typeof proposal.scope === "string" ? proposal.scope : ""
      );
      // Remove comparativa/alternativas sections from scope
      cleanScope = cleanScope.replace(/^##\s*(?:.*(?:comparativa|alternativa|comparación).*)\n(?:(?!^##\s)[\s\S])*?(?=\n##\s|\n#\s|$)/gim, "");

      // Renumber scope headings: strip existing numbers like "5.1" and re-index starting from section 2
      const renumberScope = (text: string): string => {
        let h2Counter = 0;
        return text.replace(/^(##)\s*(?:\d+\.?\d*\.?\s*)?(.+)$/gm, (_match, hashes, title) => {
          h2Counter++;
          return `${hashes} 2.${h2Counter}. ${title.trim()}`;
        });
      };

      // ── Section 1: Executive Summary (short, 3-5 bullet points) ──
      parts.push(`<h1>Resumen Ejecutivo</h1>`);
      if (cleanScope) {
        const scopeLines = cleanScope.split("\n");
        const summaryLines: string[] = [];
        let paraCount = 0;
        for (const sl of scopeLines) {
          if (paraCount >= 3 && /^##\s/.test(sl)) break;
          if (sl.trim() === "") { paraCount++; if (paraCount > 4) break; }
          if (/^#\s/.test(sl)) continue;
          summaryLines.push(sl);
        }
        parts.push(markdownToHtml(summaryLines.join("\n")));
      }

      // ── Section 2: Scope (simplified — key features only) ──
      parts.push(`<h1>Alcance del Proyecto</h1>`);
      if (cleanScope) {
        const scopeLines = cleanScope.split("\n");
        const simplifiedLines: string[] = [];
        let inSection = false;
        let sectionContentLines = 0;

        for (const sl of scopeLines) {
          if (/^##\s/.test(sl)) {
            inSection = true;
            sectionContentLines = 0;
            simplifiedLines.push(sl);
          } else if (/^#\s/.test(sl)) {
            inSection = false;
          } else if (inSection) {
            if (/^[-*]\s/.test(sl.trim()) || /^\d+\.\s/.test(sl.trim())) {
              simplifiedLines.push(sl);
              sectionContentLines++;
            } else if (sl.trim() && sectionContentLines < 3) {
              simplifiedLines.push(sl);
              sectionContentLines++;
            }
          }
        }
        // Renumber the headings before converting to HTML
        parts.push(markdownToHtml(renumberScope(simplifiedLines.join("\n"))));
      }

      // ── Section 3: Timeline ──
      if (proposal.budget?.development?.phases?.length) {
        parts.push(`<h1>Cronograma de Implementación</h1>`);
        const phases = proposal.budget.development.phases;

        // Use explicit duration_weeks from phases if available, otherwise compute from hours
        const getPhaseWeeks = (p: any): number => {
          if (p.duration_weeks != null && p.duration_weeks > 0) return p.duration_weeks;
          if (p.weeks != null && p.weeks > 0) return p.weeks;
          return Math.max(1, Math.round((p.hours || 0) / 40));
        };

        const totalWeeks = phases.reduce((s: number, p: any) => s + getPhaseWeeks(p), 0) || 1;

        // Phase table
        parts.push(`<table><tr><th>Fase</th><th>Descripción</th><th>Duración</th></tr>`);
        for (const p of phases) {
          const weeks = getPhaseWeeks(p);
          parts.push(`<tr><td><strong>${escHtml(p.name || "")}</strong></td><td>${escHtml(p.description || "")}</td><td style="text-align:center">${weeks <= 1 ? "1 semana" : `${weeks} semanas`}</td></tr>`);
        }
        parts.push(`</table>`);

        // Gantt
        parts.push(`<div style="margin:16px 0;">`);
        let cumulativeWeeks = 0;
        const colors = ["#0D9488", "#0891B2", "#7C3AED", "#DB2777", "#EA580C", "#059669"];
        for (let pi = 0; pi < phases.length; pi++) {
          const p = phases[pi];
          const phaseWeeks = getPhaseWeeks(p);
          const leftPct = (cumulativeWeeks / totalWeeks) * 100;
          const widthPct = Math.max(5, (phaseWeeks / totalWeeks) * 100);
          parts.push(`<div style="display:flex;align-items:center;margin-bottom:8px;">`);
          parts.push(`<div style="width:140px;flex-shrink:0;font-size:8.5pt;font-weight:600;">${escHtml(p.name || `Fase ${pi + 1}`)}</div>`);
          parts.push(`<div style="flex:1;height:24px;background:var(--bg-light);border-radius:4px;position:relative;border:1px solid var(--border-light);">`);
          parts.push(`<div style="position:absolute;left:${leftPct}%;width:${widthPct}%;height:100%;background:${colors[pi % colors.length]};border-radius:3px;display:flex;align-items:center;justify-content:center;">`);
          parts.push(`<span style="font-size:7pt;color:white;font-weight:600;">${phaseWeeks}sem</span>`);
          parts.push(`</div></div></div>`);
          cumulativeWeeks += phaseWeeks;
        }
        parts.push(`</div>`);

        parts.push(`<div class="kpi-row">`);
        parts.push(`<div class="kpi-box"><div class="kpi-value">${totalWeeks} sem</div><div class="kpi-label">Duración total estimada</div></div>`);
        parts.push(`<div class="kpi-box"><div class="kpi-value">${phases.length}</div><div class="kpi-label">Fases</div></div>`);
        parts.push(`</div>`);
      }

      // ── Section 4: Presupuesto (simplified — only prices, no marketing) ──
      parts.push(`<h1>Presupuesto</h1>`);

      // Monetization models — ONLY name + setup + monthly, no description/pros/cons/best_for
      if (proposal.budget?.monetization_models?.length) {
        for (const model of proposal.budget.monetization_models) {
          parts.push(`<div class="opp-card">`);
          parts.push(`<h4>${escHtml(model.name)}</h4>`);
          const metrics: string[] = [];
          if (model.setup_price_eur) metrics.push(`<div class="opp-metric"><span class="opp-metric-val">€${escHtml(String(model.setup_price_eur))}</span><span class="opp-metric-label">Setup</span></div>`);
          if (model.monthly_price_eur) metrics.push(`<div class="opp-metric"><span class="opp-metric-val">€${escHtml(String(model.monthly_price_eur))}/mes</span><span class="opp-metric-label">Mensual</span></div>`);
          if (model.annual_price_eur) metrics.push(`<div class="opp-metric"><span class="opp-metric-val">€${escHtml(String(model.annual_price_eur))}/año</span><span class="opp-metric-label">Anual</span></div>`);
          if (model.price_range && !model.setup_price_eur && !model.monthly_price_eur) metrics.push(`<div class="opp-metric"><span class="opp-metric-val">${escHtml(model.price_range)}</span><span class="opp-metric-label">Precio</span></div>`);
          if (metrics.length) parts.push(`<div class="opp-metrics">${metrics.join("")}</div>`);
          parts.push(`</div>`);
        }
      }

      // Recurring costs — use real items[] from budget
      if (proposal.budget?.recurring_monthly) {
        const r = proposal.budget.recurring_monthly;
        if (r.items?.length) {
          parts.push(`<h2>Costes Recurrentes Mensuales</h2>`);
          parts.push(`<table><tr><th>Concepto</th><th>Coste (€/mes)</th></tr>`);
          for (const item of r.items) {
            parts.push(`<tr><td>${escHtml(item.name || "")}</td><td style="text-align:right">€${item.cost_eur ?? 0}</td></tr>`);
          }
          if (r.total_monthly_eur != null) {
            parts.push(`<tr style="font-weight:bold;border-top:2px solid var(--border);"><td>Total</td><td style="text-align:right">€${r.total_monthly_eur}/mes</td></tr>`);
          }
          parts.push(`</table>`);
        } else if (r.total_monthly_eur != null) {
          parts.push(`<p style="margin-top:12px;"><strong>Costes recurrentes mensuales:</strong> €${r.total_monthly_eur}/mes</p>`);
        }
      }

      // ── Section 5: Next Steps ──
      parts.push(`<h1>Próximos Pasos</h1>`);
      parts.push(`<ol>`);
      parts.push(`<li><strong>Confirmar modelo comercial preferido</strong> y alcance del proyecto.</li>`);
      parts.push(`<li><strong>Reunión de arranque (Kick-off)</strong> — Definir equipo, accesos y calendario.</li>`);
      parts.push(`<li><strong>Inicio de Fase 0</strong> — Configuración técnica y primeros prototipos.</li>`);
      parts.push(`</ol>`);

      htmlContent = parts.join("\n");
    }
    // ── Step 6: Budget-specific renderer ──
    else if (stepNumber === 6 && typeof processedContent === "object" && processedContent !== null) {
      const b = processedContent as any;
      const parts: string[] = [];

      // Development costs
      if (b.development) {
        parts.push(`<h1>Costes de Desarrollo</h1>`);
        if (b.development.phases?.length) {
          parts.push(`<table><tr><th>Fase</th><th>Descripción</th><th>Horas</th><th>Coste (€)</th></tr>`);
          for (const p of b.development.phases) {
            parts.push(`<tr><td><strong>${escHtml(p.name || "")}</strong></td><td>${escHtml(p.description || "")}</td><td style="text-align:right">${p.hours ?? 0}</td><td style="text-align:right">${(p.cost_eur ?? 0).toLocaleString("es-ES")}</td></tr>`);
          }
          parts.push(`</table>`);
        }
        parts.push(`<div class="kpi-row">`);
        parts.push(`<div class="kpi-box"><div class="kpi-value">${b.development.total_hours ?? 0}</div><div class="kpi-label">Horas totales</div></div>`);
        parts.push(`<div class="kpi-box"><div class="kpi-value">€${b.development.hourly_rate_eur ?? 0}</div><div class="kpi-label">Tarifa / hora</div></div>`);
        parts.push(`<div class="kpi-box"><div class="kpi-value">€${(b.development.total_development_eur ?? 0).toLocaleString("es-ES")}</div><div class="kpi-label">Total desarrollo</div></div>`);
        parts.push(`</div>`);
        if (b.development.your_cost_eur != null && isInternalMode) {
          parts.push(`<p><strong>Coste real:</strong> €${b.development.your_cost_eur.toLocaleString("es-ES")} (margen ${b.development.margin_pct ?? 0}%)</p>`);
        }
      }

      // Recurring costs
      if (b.recurring_monthly) {
        parts.push(`<h1>Costes Recurrentes (Mensual)</h1>`);
        if (b.recurring_monthly.items?.length) {
          parts.push(`<table><tr><th>Concepto</th><th>Coste (€/mes)</th><th>Notas</th></tr>`);
          for (const item of b.recurring_monthly.items) {
            parts.push(`<tr><td>${escHtml(item.name || "")}</td><td style="text-align:right">${(item.cost_eur ?? 0)}</td><td>${escHtml(item.notes || "")}</td></tr>`);
          }
          parts.push(`</table>`);
        } else {
          if (b.recurring_monthly.hosting != null) parts.push(`<p><strong>Hosting:</strong> €${b.recurring_monthly.hosting}/mes</p>`);
          if (b.recurring_monthly.ai_apis != null) parts.push(`<p><strong>APIs IA:</strong> €${b.recurring_monthly.ai_apis}/mes</p>`);
        }
        if (b.recurring_monthly.maintenance_eur != null) {
          parts.push(`<p><strong>Mantenimiento:</strong> €${b.recurring_monthly.maintenance_eur}/mes (${b.recurring_monthly.maintenance_hours ?? 0}h)</p>`);
        }
        parts.push(`<div class="roi-box"><div class="roi-number">€${(b.recurring_monthly.total_monthly_eur ?? 0)}/mes</div><div class="roi-label">Total costes recurrentes mensuales</div></div>`);
      }

      // Monetization models
      if (b.monetization_models?.length) {
        parts.push(`<h1>Modelos de Monetización</h1>`);
        for (const model of b.monetization_models) {
          const isRec = b.recommended_model === model.name;
          parts.push(`<div class="opp-card"${isRec ? ' style="border-left-color:#059669;border-left-width:5px;"' : ""}>`);
          parts.push(`<h4>${escHtml(model.name)}${isRec ? ' <span class="diff-badge diff-low">★ Recomendado</span>' : ""}</h4>`);
          parts.push(`<p>${escHtml(model.description || "")}</p>`);
          
          const metrics: string[] = [];
          if (model.setup_price_eur) metrics.push(`<div class="opp-metric"><span class="opp-metric-val">€${escHtml(model.setup_price_eur)}</span><span class="opp-metric-label">Setup</span></div>`);
          if (model.monthly_price_eur) metrics.push(`<div class="opp-metric"><span class="opp-metric-val">€${escHtml(model.monthly_price_eur)}</span><span class="opp-metric-label">Mensual</span></div>`);
          if (model.price_range && !model.setup_price_eur && !model.monthly_price_eur) metrics.push(`<div class="opp-metric"><span class="opp-metric-val">${escHtml(model.price_range)}</span><span class="opp-metric-label">Precio</span></div>`);
          if (model.your_margin_pct != null && isInternalMode) metrics.push(`<div class="opp-metric"><span class="opp-metric-val">${model.your_margin_pct}%</span><span class="opp-metric-label">Margen</span></div>`);
          if (metrics.length) parts.push(`<div class="opp-metrics">${metrics.join("")}</div>`);

          if (model.pros?.length || model.cons?.length) {
            parts.push(`<table style="margin-top:10px;"><tr><th style="background:#059669;">${isInternalMode ? "Pros (interno)" : "Beneficios"}</th><th style="background:#DC2626;">${isInternalMode ? "Contras (interno)" : "Consideraciones"}</th></tr><tr>`);
            parts.push(`<td><ul>${(model.pros || []).map((p: string) => `<li>${escHtml(p)}</li>`).join("")}</ul></td>`);
            parts.push(`<td><ul>${(model.cons || []).map((c: string) => `<li>${escHtml(c)}</li>`).join("")}</ul></td>`);
            parts.push(`</tr></table>`);
          }
          if (model.best_for) parts.push(`<p style="font-style:italic;font-size:9pt;color:var(--text-light);margin-top:6px;">Ideal para: ${escHtml(model.best_for)}</p>`);
          parts.push(`</div>`);
        }
      }

      // Risk factors
      if (b.risk_factors?.length) {
        parts.push(`<h2>Factores de Riesgo</h2>`);
        parts.push(`<ul>${b.risk_factors.map((r: string) => `<li>${escHtml(r)}</li>`).join("")}</ul>`);
      }

      if (b.pricing_notes) {
        parts.push(`<blockquote>${escHtml(b.pricing_notes)}</blockquote>`);
      }

      htmlContent = parts.join("\n");
    }
    // Convert content to HTML (non-budget steps)
    else if (contentType === "markdown" || typeof processedContent === "string") {
      htmlContent = markdownToHtml(typeof processedContent === "string" ? processedContent : JSON.stringify(processedContent, null, 2));
    } else {
      const mdLines: string[] = [];
      if (typeof processedContent === "object" && processedContent !== null) {
        for (const [key, value] of Object.entries(processedContent)) {
          if (key.startsWith("_") || key === "parse_error" || key === "raw_text") continue;
          if (value === null || value === undefined || value === "" ||
              (Array.isArray(value) && value.length === 0) ||
              (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0)) continue;

          const heading = key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
          mdLines.push(`## ${heading}`);
          if (typeof value === "string") {
            mdLines.push(value);
          } else if (Array.isArray(value)) {
            if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
              const keys = Object.keys(value[0] as object);
              mdLines.push(`| ${keys.map(k => k.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())).join(" | ")} |`);
              mdLines.push(`| ${keys.map(() => "---").join(" | ")} |`);
              for (const item of value) {
                mdLines.push(`| ${keys.map(k => {
                  const v = (item as any)[k];
                  return typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
                }).join(" | ")} |`);
              }
            } else {
              for (const item of value) {
                if (typeof item === "string") {
                  mdLines.push(`- ${item}`);
                } else if (typeof item === "object") {
                  const summary = Object.entries(item as object).map(([k, v]) => `**${k}**: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
                  mdLines.push(`- ${summary}`);
                }
              }
            }
          } else if (typeof value === "object" && value !== null) {
            for (const [k, v] of Object.entries(value as object)) {
              mdLines.push(`**${k}**: ${typeof v === "object" ? JSON.stringify(v) : v}`);
            }
          }
          mdLines.push("");
        }
      }
      let mdText = mdLines.join("\n");
      if (isClientMode) {
        mdText = translateForClient(mdText);
      }
      htmlContent = markdownToHtml(mdText);
    }

    // Build full HTML document
    const fullHtml = buildFullHtml(
      title,
      projectName || "Proyecto",
      company || "",
      dateStr,
      ver,
      htmlContent,
      isClientFacing,
      isInternalMode,
      isDraft
    );

    // Convert to PDF with mode-aware headers
    let pdfBuffer: Uint8Array;
    try {
      pdfBuffer = await convertHtmlToPdf(fullHtml, projectName || "Proyecto", {
        exportMode: exportMode || "client",
        allowDraft,
        company: company || "",
        dateStr,
      });
    } catch (pdfErr: any) {
      console.error("PDF conversion failed, returning HTML fallback:", pdfErr.message);
      const encoder = new TextEncoder();
      pdfBuffer = encoder.encode(fullHtml);
    }

    const isPdf = pdfBuffer[0] === 0x25; // PDF starts with %PDF
    const fileExt = isPdf ? "pdf" : "html";
    const contentTypeHeader = isPdf ? "application/pdf" : "text/html";

    // Upload to storage
    const supabase = getSupabaseAdmin();
    const filePath = `${projectId}/${stepNumber}/v${ver}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("project-documents")
      .upload(filePath, pdfBuffer, {
        contentType: contentTypeHeader,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Upload failed", details: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from("project-documents")
      .createSignedUrl(filePath, 3600);

    if (urlError) {
      console.error("Signed URL error:", urlError);
      return new Response(JSON.stringify({ error: "Failed to generate download URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: dbError } = await supabase
      .from("project_documents")
      .upsert({
        project_id: projectId,
        step_number: stepNumber,
        version: parseInt(ver.replace("v", "")) || 1,
        file_url: signedUrlData.signedUrl,
        file_format: fileExt,
        is_client_facing: isClientFacing,
        updated_at: new Date().toISOString(),
      }, { onConflict: "project_id,step_number,version" })
      .select()
      .single();

    // Filename: include __CLIENTE_BORRADOR__ for draft mode
    const baseFileName = title.replace(/\s+/g, "-").toLowerCase();
    const fileName = isDraft
      ? `${baseFileName}__CLIENTE_BORRADOR__-${ver}.${fileExt}`
      : `${baseFileName}-${ver}.${fileExt}`;

    return new Response(JSON.stringify({
      url: signedUrlData.signedUrl,
      filePath,
      fileName,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Generate document error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

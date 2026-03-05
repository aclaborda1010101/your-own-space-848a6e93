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
    
    // Code blocks
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
    
    // Table detection
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
    
    // Callouts
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
    
    // Headings
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
    
    // Bullets
    if (/^(\s*)[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(\s*)[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^(\s*)[-*]\s/, ""));
        i++;
      }
      html.push("<ul>" + items.map(item => `<li>${inlineFmt(item)}</li>`).join("") + "</ul>");
      continue;
    }
    
    // Numbered lists
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      html.push("<ol>" + items.map(item => `<li>${inlineFmt(item)}</li>`).join("") + "</ol>");
      continue;
    }
    
    // Blockquotes
    if (line.startsWith("> ")) {
      html.push(`<blockquote>${inlineFmt(line.slice(2))}</blockquote>`);
      i++;
      continue;
    }
    
    // Empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }
    
    // Regular paragraph
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

function stripChangelog(text: string): string {
  return text.replace(/\n---\s*\n+##\s*CHANGELOG[\s\S]*$/i, '');
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
  return headings.map(h => {
    const cls = h.level === 1 ? "toc-h1" : "toc-h2";
    return `<div class="${cls}">${escHtml(h.text)}</div>`;
  }).join("\n");
}

function buildCoverHtml(title: string, projectName: string, company: string, date: string, version: string): string {
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
      ${company ? `<div class="cover-date">${escHtml(company)}</div>` : ""}
      <div class="cover-date">${escHtml(date)}</div>
      <div class="cover-badge">CONFIDENCIAL</div>
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
  isClientFacing: boolean
): string {
  const headings = extractHeadings(htmlContent);
  const tocHtml = buildTocHtml(headings);
  const coverHtml = buildCoverHtml(title, projectName, company, date, version);
  const signatureHtml = isClientFacing ? buildSignatureHtml(company, date) : "";

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
// HTML → PDF via html2pdf.app API
// ══════════════════════════════════════════════════════════════════════

async function convertHtmlToPdf(html: string, projectName: string): Promise<Uint8Array> {
  const apiKey = Deno.env.get("HTML2PDF_API_KEY");
  
  if (!apiKey) {
    throw new Error("HTML2PDF_API_KEY not configured. Add it to Supabase secrets.");
  }

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
      headerTemplate: `<div style="font-size:7pt;color:#6B7280;width:100%;text-align:right;padding-right:18mm;">CONFIDENCIAL</div>`,
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

// ══════════════════════════════════════════════════════════════════════
// Main handler
// ══════════════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, stepNumber, content, contentType, projectName, company, date, version, exportMode } = await req.json();

    if (!projectId || !stepNumber || !content) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const title = STEP_TITLES[stepNumber] || `Fase ${stepNumber}`;
    const dateRaw = date?.includes("-") ? date : date?.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") || new Date().toISOString().split("T")[0];
    const [_y, _m, _d] = dateRaw.split("-");
    const dateStr = `${_d}/${_m}/${_y}`;
    const ver = version || "v1";
    const isClientFacing = [3, 5, 7].includes(stepNumber);

    // Convert content to HTML
    let htmlContent: string;
    if (contentType === "markdown" || typeof content === "string") {
      htmlContent = markdownToHtml(typeof content === "string" ? content : JSON.stringify(content, null, 2));
    } else {
      const mdLines: string[] = [];
      if (typeof content === "object" && content !== null) {
        for (const [key, value] of Object.entries(content)) {
          if (key.startsWith("_") || key === "parse_error" || key === "raw_text") continue;
          const heading = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          mdLines.push(`## ${heading}`);
          if (typeof value === "string") {
            mdLines.push(value);
          } else if (Array.isArray(value)) {
            for (const item of value) {
              if (typeof item === "string") {
                mdLines.push(`- ${item}`);
              } else if (typeof item === "object") {
                const summary = Object.entries(item).map(([k, v]) => `**${k}**: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
                mdLines.push(`- ${summary}`);
              }
            }
          } else if (typeof value === "object" && value !== null) {
            for (const [k, v] of Object.entries(value)) {
              mdLines.push(`**${k}**: ${typeof v === "object" ? JSON.stringify(v) : v}`);
            }
          }
          mdLines.push("");
        }
      }
      htmlContent = markdownToHtml(mdLines.join("\n"));
    }

    // Build full HTML document
    const fullHtml = buildFullHtml(
      title,
      projectName || "Proyecto",
      company || "",
      dateStr,
      ver,
      htmlContent,
      isClientFacing
    );

    // Convert to PDF
    let pdfBuffer: Uint8Array;
    try {
      pdfBuffer = await convertHtmlToPdf(fullHtml, projectName || "Proyecto");
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

    return new Response(JSON.stringify({
      url: signedUrlData.signedUrl,
      filePath,
      fileName: `${title.replace(/\s+/g, "-").toLowerCase()}-${ver}.${fileExt}`,
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

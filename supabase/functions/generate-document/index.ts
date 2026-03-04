import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, Footer, Header, ShadingType, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, PageNumber, TabStopPosition, TabStopType, TableLayoutType, SectionType } from "npm:docx@9.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Brand colors (premium consulting palette) ─────────────────────────
const BRAND = {
  primary: "0A3039",       // Dark teal brand
  primaryDark: "0A3039",   // Dark teal for legacy compat
  accent: "7ED957",        // Green accent
  text: "374151",          // Gris oscuro body
  muted: "6B7280",         // Gris medio
  white: "FFFFFF",
  light: "F9FAFB",         // Zebra rows
  lightAlt: "F3F4F6",      // KPI boxes bg
  border: "9A9A9A",        // Table borders (gray)
  alertRed: "DC2626",
  alertRedBg: "FEE2E2",
  alertOrange: "D97706",
  alertOrangeBg: "FEF3C7",
  confirmedGreen: "059669",
  confirmedGreenBg: "D1FAE5",
  dark: "1A1A1A",
  graySubtitle: "4A4A4A",
};

// ── Fonts ──────────────────────────────────────────────────────────────
const FONT = {
  heading: "Arial",
  body: "Calibri",
  code: "Consolas",
};

const SIZE = {
  body: 21,           // 10.5pt
  bodySmall: 19,      // 9.5pt (tables)
  h1: 32,             // 16pt
  h2: 24,             // 12pt
  h3: 20,             // 10pt
  code: 18,           // 9pt
  coverTitle: 56,     // 28pt
  coverSubtitle: 36,  // 18pt
  kpiNumber: 48,      // 24pt
  kpiLabel: 18,       // 9pt
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── Fetch logo from storage ───────────────────────────────────────────
async function fetchLogo(): Promise<Uint8Array | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from("project-documents")
      .download("brand/manias-logo.png");
    if (error || !data) return null;
    const arrayBuffer = await data.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch { return null; }
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

// ── Helpers ────────────────────────────────────────────────────────────
const noBorder = { style: BorderStyle.NONE, size: 0, color: BRAND.white };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const hBorder = (color = BRAND.border, sz = 1) => ({ style: BorderStyle.SINGLE, size: sz, color });
const noBorderV = { style: BorderStyle.NONE, size: 0, color: BRAND.white };
// Gray borders on all sides for tables
const grayBorders = () => ({
  top: hBorder(BRAND.border),
  bottom: hBorder(BRAND.border),
  left: hBorder(BRAND.border),
  right: hBorder(BRAND.border),
});

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
}

// ── Cover page (premium consulting) ───────────────────────────────────
function createCoverPage(
  title: string,
  projectName: string,
  company: string,
  date: string,
  version: string,
  logoData: Uint8Array | null,
  author?: string
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  // Helper: invisible-border table with shading
  const brandTable = (fill: string, children: Paragraph[], widthPct = 100) => new Table({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [new TableRow({
      children: [new TableCell({
        borders: noBorders,
        shading: { type: ShadingType.CLEAR, color: "auto", fill },
        children,
      })],
    })],
  });

  // ── Top teal band ──
  const logoContent = logoData
    ? [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 300, after: 300 },
        children: [new ImageRun({ data: logoData, transformation: { width: 220, height: 70 }, type: "png" })],
      })]
    : [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 300, after: 300 },
        children: [
          new TextRun({ text: "Man", font: FONT.heading, size: 36, color: BRAND.white, bold: true }),
          new TextRun({ text: "IAS", font: FONT.heading, size: 36, color: BRAND.accent, bold: true }),
          new TextRun({ text: " Lab.", font: FONT.heading, size: 36, color: BRAND.white, bold: true }),
        ],
      })];

  elements.push(brandTable(BRAND.primary, logoContent));

  // Spacer before title
  elements.push(new Paragraph({ spacing: { after: 1200 }, children: [] }));

  // Document type title
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: title.toUpperCase(), font: FONT.heading, size: SIZE.coverTitle, color: BRAND.dark, bold: true })],
  }));

  // Decorative teal line
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: BRAND.primary, space: 1 } },
    children: [new TextRun({ text: " ", size: 2 })],
  }));

  // Project name subtitle
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: projectName, font: FONT.heading, size: SIZE.coverSubtitle, color: BRAND.graySubtitle })],
  }));

  // 3-4 spacer paragraphs for vertical centering
  for (let i = 0; i < 4; i++) {
    elements.push(new Paragraph({ spacing: { after: 300 }, children: [] }));
  }

  // ── Metadata table (invisible borders, gray labels, bold values) ──
  const metaRows: [string, string][] = [
    ["Cliente", company || "—"],
    ["Fecha", date],
    ["Versión", version],
  ];
  if (author) metaRows.push(["Autor", author]);

  elements.push(new Table({
    width: { size: 50, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: metaRows.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          borders: noBorders,
          width: { size: 35, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 50, after: 50 },
            children: [new TextRun({ text: label + ":", font: FONT.body, size: SIZE.body, color: BRAND.muted, bold: true })],
          })],
        }),
        new TableCell({
          borders: noBorders,
          width: { size: 65, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            spacing: { before: 50, after: 50 },
            indent: { left: 200 },
            children: [new TextRun({ text: value, font: FONT.body, size: SIZE.body, color: BRAND.text })],
          })],
        }),
      ],
    })),
  }));

  // Spacer
  elements.push(new Paragraph({ spacing: { after: 400 }, children: [] }));

  // ── CONFIDENCIAL badge (red bg, white text, no borders) ──
  elements.push(brandTable(BRAND.alertRed, [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text: "CONFIDENCIAL", font: FONT.heading, size: 18, color: BRAND.white, bold: true })],
    }),
  ], 30));

  // Spacer
  elements.push(new Paragraph({ spacing: { after: 800 }, children: [] }));

  // ── Bottom teal band ──
  elements.push(brandTable(BRAND.primary, [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 100 },
      children: [new TextRun({ text: "ManIAS Lab. | Consultora Tecnológica", font: FONT.heading, size: 16, color: BRAND.white })],
    }),
  ]));

  // Page break after cover
  elements.push(new Paragraph({ children: [new PageBreak()] }));

  return elements;
}

// ── Executive Summary (visual KPIs) ───────────────────────────────────
function createExecutiveSummary(markdownContent: string): (Paragraph | Table)[] {
  const match = markdownContent.match(/<!--EXEC_SUMMARY_JSON-->([\s\S]*?)<!--\/EXEC_SUMMARY_JSON-->/);
  if (!match) return [];

  try {
    const data = JSON.parse(match[1].trim());
    const elements: (Paragraph | Table)[] = [];

    // Title
    elements.push(new Paragraph({
      spacing: { before: 200, after: 300 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: BRAND.primary, space: 4 } },
      children: [new TextRun({ text: "Resumen Ejecutivo", font: FONT.heading, size: SIZE.h1, color: BRAND.primary, bold: true })],
    }));

    // KPI boxes (4 columns)
    if (data.kpis && data.kpis.length > 0) {
      const kpiCells = data.kpis.slice(0, 4).map((kpi: any) => new TableCell({
        borders: noBorders,
        shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.lightAlt },
        verticalAlign: VerticalAlign.CENTER,
        width: { size: 25, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 40 },
            children: [new TextRun({ text: kpi.value, font: FONT.heading, size: SIZE.kpiNumber, color: BRAND.primary, bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: kpi.label, font: FONT.body, size: SIZE.kpiLabel, color: BRAND.muted })],
          }),
        ],
      }));

      elements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: kpiCells })],
      }));

      elements.push(new Paragraph({ spacing: { after: 300 }, children: [] }));
    }

    // Phases with visual bars
    if (data.phases && data.phases.length > 0) {
      elements.push(new Paragraph({
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: "FASES DEL PROYECTO", font: FONT.heading, size: SIZE.h2, color: BRAND.text, bold: true })],
      }));

      const maxWeight = Math.max(...data.phases.map((p: any) => p.weight || 0.5));
      const phaseRows = data.phases.map((phase: any, idx: number) => {
        const barWidth = Math.round(((phase.weight || 0.5) / maxWeight) * 60);
        const emptyWidth = 60 - barWidth;
        const tints = ["0A3039", "134E4A", "115E59", "0F766E"];
        const color = tints[idx % tints.length];

        return new TableRow({
          children: [
            new TableCell({
              borders: noBorders,
              width: { size: 20, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({
                spacing: { before: 60, after: 60 },
                children: [new TextRun({ text: phase.name, font: FONT.body, size: SIZE.bodySmall, color: BRAND.text, bold: true })],
              })],
            }),
            new TableCell({
              borders: noBorders,
              shading: { type: ShadingType.CLEAR, color: "auto", fill: color },
              width: { size: barWidth, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: " ", font: FONT.body, size: 12 })],
              })],
            }),
            ...(emptyWidth > 0 ? [new TableCell({
              borders: noBorders,
              width: { size: emptyWidth, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [] })],
            })] : []),
            new TableCell({
              borders: noBorders,
              width: { size: 10, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: phase.cost || "", font: FONT.body, size: SIZE.bodySmall, color: BRAND.text, bold: true })],
              })],
            }),
            new TableCell({
              borders: noBorders,
              width: { size: 10, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: phase.duration || "", font: FONT.body, size: SIZE.bodySmall, color: BRAND.muted })],
              })],
            }),
          ],
        });
      });

      elements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: phaseRows,
      }));

      elements.push(new Paragraph({ spacing: { after: 300 }, children: [] }));
    }

    // Total investment box
    if (data.total_investment) {
      elements.push(new Table({
        width: { size: 60, type: WidthType.PERCENTAGE },
        rows: [new TableRow({
          children: [new TableCell({
            borders: {
              top: hBorder(BRAND.primary, 2),
              bottom: hBorder(BRAND.primary, 2),
              left: hBorder(BRAND.primary, 2),
              right: hBorder(BRAND.primary, 2),
            },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 20 },
                children: [new TextRun({ text: "INVERSIÓN TOTAL", font: FONT.heading, size: SIZE.bodySmall, color: BRAND.muted })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [new TextRun({ text: data.total_investment, font: FONT.heading, size: SIZE.h1, color: BRAND.primary, bold: true })],
              }),
            ],
          })],
        })],
      }));

      if (data.roi_estimate) {
        elements.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 200 },
          children: [new TextRun({ text: `ROI Estimado: ${data.roi_estimate}`, font: FONT.body, size: SIZE.body, color: BRAND.confirmedGreen, bold: true })],
        }));
      }
    }

    elements.push(new Paragraph({ children: [new PageBreak()] }));
    return elements;
  } catch (e) {
    console.warn("Failed to parse EXEC_SUMMARY_JSON:", e);
    return [];
  }
}

// ── Manual Table of Contents (fixed duplicate numbering) ──────────────
function createManualTOC(markdownContent: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  elements.push(new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: BRAND.primary, space: 4 } },
    children: [new TextRun({ text: "Índice de Contenidos", font: FONT.heading, size: SIZE.h1, color: BRAND.primary, bold: true })],
  }));

  const lines = markdownContent.split("\n");
  let h1Counter = 0;
  let h2Counter = 0;

  for (const line of lines) {
    if (line.startsWith("# ")) {
      h1Counter++;
      h2Counter = 0;
      let title = line.slice(2).trim();
      // Fix: detect if heading already starts with a number (e.g. "1. PORTADA")
      const hasNumber = /^\d+(\.\d+)*[\.\)]*\s/.test(title);
      const prefix = hasNumber ? "" : `${h1Counter}.  `;
      // Normalize: strip existing number for display, re-add ours
      if (hasNumber) {
        // Keep as-is but clean up
        title = title.replace(/^\d+(\.\d+)*[\.\)]*\s*/, "").trim();
      }
      elements.push(new Paragraph({
        spacing: { before: 100, after: 50 },
        children: [new TextRun({ text: `${h1Counter}.  ${toTitleCase(title)}`, font: FONT.heading, size: SIZE.h2, color: BRAND.primary, bold: true })],
      }));
    } else if (line.startsWith("## ")) {
      h2Counter++;
      let title = line.slice(3).trim();
      const hasNumber = /^\d+(\.\d+)*[\.\)]*\s/.test(title);
      if (hasNumber) title = title.replace(/^\d+(\.\d+)*[\.\)]*\s*/, "").trim();
      elements.push(new Paragraph({
        spacing: { before: 30, after: 30 },
        indent: { left: 480 },
        children: [new TextRun({ text: `${h1Counter}.${h2Counter}  ${title}`, font: FONT.body, size: SIZE.body, color: BRAND.text })],
      }));
    }
  }

  elements.push(new Paragraph({ spacing: { before: 200 }, children: [new PageBreak()] }));
  return elements;
}

// ── Parse markdown table to professional docx Table ───────────────────
function parseMarkdownTable(tableLines: string[]): Table {
  const parseCells = (line: string): string[] =>
    line.split("|").slice(1, -1).map(c => c.trim());

  const headerCells = parseCells(tableLines[0]);
  const dataLines = tableLines.slice(2);

  const headerRow = new TableRow({
    tableHeader: true,
    children: headerCells.map(cell => new TableCell({
      borders: grayBorders(),
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: cell.toUpperCase(), font: FONT.body, size: SIZE.bodySmall, color: BRAND.text, bold: true })],
      })],
    })),
  });

  const dataRows = dataLines
    .filter(l => l.trim().startsWith("|"))
    .map((line, rowIdx) => {
      const cells = parseCells(line);
      return new TableRow({
        children: headerCells.map((_, colIdx) => {
          const cellText = cells[colIdx] || "";
          const isFirstCol = colIdx === 0;
          const cellUpper = cellText.toUpperCase().trim();
          let cellShading: any = undefined;
          let cellColor = BRAND.text;

          if (/^(CRÍTICO|P0|ALTO|ALTA)$/i.test(cellUpper)) {
            cellShading = { type: ShadingType.CLEAR, color: "auto", fill: BRAND.alertRedBg };
            cellColor = BRAND.alertRed;
          } else if (/^(IMPORTANTE|P1|MEDIO|MEDIA)$/i.test(cellUpper)) {
            cellShading = { type: ShadingType.CLEAR, color: "auto", fill: BRAND.alertOrangeBg };
            cellColor = BRAND.alertOrange;
          } else if (/^(MENOR|P2|BAJO|BAJA)$/i.test(cellUpper)) {
            cellShading = { type: ShadingType.CLEAR, color: "auto", fill: BRAND.confirmedGreenBg };
            cellColor = BRAND.confirmedGreen;
          }

          return new TableCell({
            shading: cellShading,
            borders: grayBorders(),
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({
              spacing: { before: 0, after: 0 },
              children: parseInlineFormatting(cellText, isFirstCol),
            })],
          });
        }),
      });
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: hBorder(BRAND.border), bottom: hBorder(BRAND.border),
      left: hBorder(BRAND.border), right: hBorder(BRAND.border),
      insideHorizontal: hBorder(BRAND.border), insideVertical: hBorder(BRAND.border),
    },
    rows: [headerRow, ...dataRows],
  });
}

// ── Parse ASCII art tables (+---+---+) ────────────────────────────────
function parseAsciiTable(tableLines: string[]): Table | null {
  // Filter out border lines (+---+)
  const contentLines = tableLines.filter(l => !l.trim().startsWith("+"));
  if (contentLines.length < 1) return null;

  const parseCells = (line: string): string[] =>
    line.split("|").filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim());

  const headerCells = parseCells(contentLines[0]);
  if (headerCells.length === 0) return null;

  const headerRow = new TableRow({
    tableHeader: true,
    children: headerCells.map(cell => new TableCell({
      borders: grayBorders(),
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [new Paragraph({
        children: [new TextRun({ text: cell.toUpperCase(), font: FONT.body, size: SIZE.bodySmall, color: BRAND.text, bold: true })],
      })],
    })),
  });

  const dataRows = contentLines.slice(1).map((line, rowIdx) => {
    const cells = parseCells(line);
    const isZebra = rowIdx % 2 === 1;
    return new TableRow({
      children: headerCells.map((_, colIdx) => new TableCell({
        shading: isZebra ? { type: ShadingType.CLEAR, color: "auto", fill: BRAND.light } : undefined,
        borders: proBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [new Paragraph({
          children: parseInlineFormatting(cells[colIdx] || ""),
        })],
      })),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

// ── Callout boxes ─────────────────────────────────────────────────────
function createCalloutBox(text: string, type: "pendiente" | "alerta" | "confirmado"): Table {
  const config = {
    pendiente: { bg: BRAND.alertOrangeBg, border: BRAND.alertOrange, prefix: "PENDIENTE" },
    alerta: { bg: BRAND.alertRedBg, border: BRAND.alertRed, prefix: "ALERTA" },
    confirmado: { bg: BRAND.confirmedGreenBg, border: BRAND.confirmedGreen, prefix: "CONFIRMADO" },
  }[type];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: config.bg },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: config.bg },
          bottom: { style: BorderStyle.NONE, size: 0, color: config.bg },
          right: { style: BorderStyle.NONE, size: 0, color: config.bg },
          left: { style: BorderStyle.SINGLE, size: 6, color: config.border },
        },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          spacing: { after: 0 },
          children: [new TextRun({ text: text, font: FONT.body, size: SIZE.bodySmall, color: BRAND.text })],
        })],
      })],
    })],
  });
}

// ── Signature page ────────────────────────────────────────────────────
function createSignaturePage(company: string, date: string, author?: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  elements.push(new Paragraph({ children: [new PageBreak()] }));

  elements.push(new Paragraph({
    spacing: { before: 400, after: 400 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: BRAND.primary, space: 4 } },
    children: [new TextRun({ text: "Aceptación del Documento de Alcance", font: FONT.heading, size: SIZE.h1, color: BRAND.primary, bold: true })],
  }));

  const signBorder = { style: BorderStyle.SINGLE, size: 1, color: BRAND.border };
  const signBorders = { top: signBorder, bottom: signBorder, left: signBorder, right: signBorder };

  const makeSignBlock = (entityName: string, personName: string) => new TableCell({
    borders: signBorders,
    shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.light },
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    width: { size: 50, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: `POR ${entityName.toUpperCase()}`, font: FONT.heading, size: SIZE.body, color: BRAND.primary, bold: true })],
      }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Firma:", font: FONT.body, size: SIZE.body, color: BRAND.muted })] }),
      new Paragraph({
        spacing: { after: 300 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: BRAND.text, space: 1 } },
        children: [new TextRun({ text: " ", size: SIZE.body })],
      }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `Nombre: ${personName}`, font: FONT.body, size: SIZE.body, color: BRAND.text })] }),
      new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: `Fecha: ___/___/${new Date().getFullYear()}`, font: FONT.body, size: SIZE.body, color: BRAND.text })] }),
    ],
  });

  elements.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [
        makeSignBlock(company || "Cliente", "________________"),
        makeSignBlock("ManIAS Lab.", author || "________________"),
      ],
    })],
  }));

  elements.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200 },
    children: [new TextRun({ text: "Validez: 15 días naturales desde fecha de emisión", font: FONT.body, size: SIZE.bodySmall, color: BRAND.muted, italics: true })],
  }));

  return elements;
}

// ── Inline formatting parser ──────────────────────────────────────────
function parseInlineFormatting(text: string, forceBold = false): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], font: FONT.body, size: SIZE.body, color: BRAND.text, bold: true, italics: true }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], font: FONT.body, size: SIZE.body, color: BRAND.text, bold: true }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], font: FONT.body, size: SIZE.body, color: BRAND.text, italics: true }));
    } else if (match[5]) {
      runs.push(new TextRun({ text: match[5], font: FONT.code, size: SIZE.code, color: BRAND.primary }));
    } else if (match[6]) {
      runs.push(new TextRun({ text: match[6], font: FONT.body, size: SIZE.body, color: BRAND.text, bold: forceBold }));
    }
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ text, font: FONT.body, size: SIZE.body, color: BRAND.text, bold: forceBold }));
  }
  return runs;
}

// Parse bullet text with bold lead-in: **text**: rest
function parseBulletRuns(text: string): TextRun[] {
  const leadMatch = text.match(/^\*\*(.+?)\*\*:\s*(.*)/);
  if (leadMatch) {
    return [
      new TextRun({ text: leadMatch[1] + ": ", font: FONT.body, size: SIZE.body, color: BRAND.text, bold: true }),
      new TextRun({ text: leadMatch[2], font: FONT.body, size: SIZE.body, color: BRAND.text }),
    ];
  }
  return parseInlineFormatting(text);
}

// ── Main markdown to paragraphs parser ────────────────────────────────
function markdownToParagraphs(md: string): (Paragraph | Table)[] {
  // Strip exec summary JSON block (handled separately)
  let sanitized = sanitizeMarkdown(md);
  sanitized = sanitized.replace(/<!--EXEC_SUMMARY_JSON-->[\s\S]*?<!--\/EXEC_SUMMARY_JSON-->/, "");

  const lines = sanitized.split("\n");
  const elements: (Paragraph | Table)[] = [];
  let isFirstH1 = true;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Callout detection ──
    if (/^\[PENDIENTE:/i.test(trimmed)) {
      let calloutText = trimmed;
      // Consume multi-line callout until ]
      while (i + 1 < lines.length && !calloutText.endsWith("]")) {
        i++;
        calloutText += " " + lines[i].trim();
      }
      calloutText = calloutText.replace(/^\[PENDIENTE:\s*/i, "PENDIENTE: ").replace(/\]$/, "");
      elements.push(new Paragraph({ spacing: { before: 120 }, children: [] }));
      elements.push(createCalloutBox(calloutText, "pendiente"));
      elements.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      i++;
      continue;
    }
    if (/^\[ALERTA:/i.test(trimmed)) {
      let calloutText = trimmed;
      while (i + 1 < lines.length && !calloutText.endsWith("]")) { i++; calloutText += " " + lines[i].trim(); }
      calloutText = calloutText.replace(/^\[ALERTA:\s*/i, "ALERTA: ").replace(/\]$/, "");
      elements.push(new Paragraph({ spacing: { before: 120 }, children: [] }));
      elements.push(createCalloutBox(calloutText, "alerta"));
      elements.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      i++;
      continue;
    }
    if (/^\[CONFIRMADO:/i.test(trimmed)) {
      let calloutText = trimmed;
      while (i + 1 < lines.length && !calloutText.endsWith("]")) { i++; calloutText += " " + lines[i].trim(); }
      calloutText = calloutText.replace(/^\[CONFIRMADO:\s*/i, "CONFIRMADO: ").replace(/\]$/, "");
      elements.push(new Paragraph({ spacing: { before: 120 }, children: [] }));
      elements.push(createCalloutBox(calloutText, "confirmado"));
      elements.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      i++;
      continue;
    }

    // ── Markdown tables (| format) ──
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 3) {
        elements.push(new Paragraph({ spacing: { before: 160 }, children: [] }));
        elements.push(parseMarkdownTable(tableLines));
        elements.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
      }
      continue;
    }

    // ── ASCII tables (+---+ format) ──
    if (trimmed.startsWith("+") && /^\+[-=+]+\+$/.test(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith("+") || lines[i].trim().startsWith("|"))) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 3) {
        const table = parseAsciiTable(tableLines);
        if (table) {
          elements.push(new Paragraph({ spacing: { before: 160 }, children: [] }));
          elements.push(table);
          elements.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
        }
      }
      continue;
    }

    // ── Headings ──
    if (line.startsWith("# ")) {
      if (!isFirstH1) {
        elements.push(new Paragraph({ children: [new PageBreak()] }));
      }
      isFirstH1 = false;

      let headingText = line.slice(2).trim();
      // Strip leading number if present (we don't re-add here, content keeps its numbering)
      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 480, after: 240 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: BRAND.primary, space: 4 } },
        children: [new TextRun({ text: headingText, font: FONT.heading, size: SIZE.h1, color: BRAND.primary, bold: true })],
      }));

    } else if (line.startsWith("## ")) {
      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 160 },
        children: [new TextRun({ text: line.slice(3).trim(), font: FONT.heading, size: SIZE.h2, color: BRAND.text, bold: true })],
      }));
    } else if (line.startsWith("### ")) {
      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: line.slice(4).trim(), font: FONT.heading, size: SIZE.h3, color: BRAND.muted, bold: true })],
      }));
    } else if (line.startsWith("#### ")) {
      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_4,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: line.slice(5).trim(), font: FONT.heading, size: SIZE.h3, color: BRAND.muted, bold: true, italics: true })],
      }));

    // ── Bullets ──
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(new Paragraph({
        bullet: { level: 0 },
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 80, line: 276 },
        children: parseBulletRuns(line.slice(2)),
      }));
    } else if (/^ {6,}[-*] /.test(line)) {
      elements.push(new Paragraph({
        bullet: { level: 2 },
        spacing: { after: 40, line: 276 },
        children: parseBulletRuns(line.replace(/^ {6,}[-*] /, "")),
      }));
    } else if (/^ {2,5}[-*] /.test(line)) {
      elements.push(new Paragraph({
        bullet: { level: 1 },
        spacing: { after: 50, line: 276 },
        children: parseBulletRuns(line.replace(/^ {2,5}[-*] /, "")),
      }));
    } else if (line.match(/^\d+\.\s/)) {
      const text = line.replace(/^\d+\.\s/, "");
      elements.push(new Paragraph({
        numbering: { reference: "default-numbering", level: 0 },
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 80, line: 276 },
        children: [new TextRun({ text, font: FONT.body, size: SIZE.body, color: BRAND.text })],
      }));

    // ── Blockquote ──
    } else if (line.startsWith("> ")) {
      elements.push(new Paragraph({
        indent: { left: 720 },
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 60, after: 100, line: 276 },
        shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.light },
        children: [new TextRun({ text: line.slice(2), font: FONT.body, size: SIZE.body, color: BRAND.muted, italics: true })],
      }));

    // ── Empty line ──
    } else if (trimmed === "") {
      elements.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

    // ── Bold-only line ──
    } else if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 100, line: 276 },
        children: [new TextRun({ text: line.slice(2, -2), font: FONT.body, size: SIZE.body, color: BRAND.text, bold: true })],
      }));

    // ── Normal paragraph ──
    } else {
      elements.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120, line: 276 },
        children: parseInlineFormatting(line),
      }));
    }
    i++;
  }
  return elements;
}

// ── JSON to paragraphs (generic) ──────────────────────────────────────
function jsonToParagraphs(data: any, stepNumber: number): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  const addSection = (title: string, content: any) => {
    paragraphs.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 360, after: 160 },
      children: [new TextRun({ text: title, font: FONT.heading, size: SIZE.h2, color: BRAND.text, bold: true })],
    }));

    if (typeof content === "string") {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120, line: 276 },
        children: [new TextRun({ text: sanitizeMarkdown(content), font: FONT.body, size: SIZE.body, color: BRAND.text })],
      }));
    } else if (Array.isArray(content)) {
      content.forEach((item: any) => {
        const text = typeof item === "string" ? sanitizeMarkdown(item) : Object.entries(item).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
        paragraphs.push(new Paragraph({
          bullet: { level: 0 },
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 80, line: 276 },
          children: [new TextRun({ text: sanitizeMarkdown(text), font: FONT.body, size: SIZE.body, color: BRAND.text })],
        }));
      });
      paragraphs.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
    } else if (typeof content === "object" && content !== null) {
      Object.entries(content).forEach(([k, v]) => {
        paragraphs.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 80, line: 276 },
          children: [
            new TextRun({ text: `${k}: `, font: FONT.body, size: SIZE.body, color: BRAND.text, bold: true }),
            new TextRun({ text: sanitizeMarkdown(typeof v === "object" ? JSON.stringify(v) : String(v)), font: FONT.body, size: SIZE.body, color: BRAND.text }),
          ],
        }));
      });
    }
  };

  if (typeof data === "object" && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      if (key === "parse_error" || key === "raw_text") continue;
      addSection(key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), value);
    }
  } else {
    paragraphs.push(new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: JSON.stringify(data, null, 2), font: FONT.code, size: SIZE.code, color: BRAND.text })],
    }));
  }

  return paragraphs;
}

// ── Build document ────────────────────────────────────────────────────
function buildDocx(
  title: string,
  projectName: string,
  company: string,
  date: string,
  version: string,
  contentElements: (Paragraph | Table)[],
  logoData: Uint8Array | null,
  rawMarkdown: string,
  stepNumber: number,
  author?: string
): Document {
  const isClientFacing = [3, 5].includes(stepNumber);

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT.body, size: SIZE.body, color: BRAND.text },
          paragraph: { spacing: { after: 120, line: 276 }, alignment: AlignmentType.JUSTIFIED },
        },
      },
      paragraphStyles: [
        {
          id: "ManIASHeading1", name: "ManIAS Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: FONT.heading, size: SIZE.h1, color: BRAND.primary, bold: true },
          paragraph: { spacing: { before: 480, after: 240 } },
        },
        {
          id: "ManIASHeading2", name: "ManIAS Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: FONT.heading, size: SIZE.h2, color: BRAND.text, bold: true },
          paragraph: { spacing: { before: 360, after: 160 } },
        },
        {
          id: "ManIASBody", name: "ManIAS Body", basedOn: "Normal",
          run: { font: FONT.body, size: SIZE.body, color: BRAND.text },
          paragraph: { spacing: { after: 120, line: 276 }, alignment: AlignmentType.JUSTIFIED },
        },
      ],
    },
    numbering: {
      config: [{
        reference: "default-numbering",
        levels: [{ level: 0, format: "decimal" as any, text: "%1.", alignment: AlignmentType.START }],
      }],
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, bottom: 1440, left: 1200, right: 1200 } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
                spacing: { after: 40 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: BRAND.border, space: 4 } },
                children: [
                  new TextRun({ text: projectName, font: FONT.heading, size: 16, color: BRAND.muted }),
                  new TextRun({ text: "\t", font: FONT.heading, size: 16 }),
                  new TextRun({ text: "CONFIDENCIAL", font: FONT.heading, size: 14, color: BRAND.alertRed, bold: true }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
                border: { top: { style: BorderStyle.SINGLE, size: 1, color: BRAND.border, space: 4 } },
                children: [
                  new TextRun({ text: "ManIAS Lab. | Consultora Tecnológica", font: FONT.heading, size: 14, color: BRAND.muted }),
                  new TextRun({ text: "\t", font: FONT.heading, size: 14 }),
                  new TextRun({ text: "Página ", font: FONT.body, size: 14, color: BRAND.muted }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT.body, size: 14, color: BRAND.muted }),
                  new TextRun({ text: " de ", font: FONT.body, size: 14, color: BRAND.muted }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT.body, size: 14, color: BRAND.muted }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...createCoverPage(title, projectName, company, date, version, logoData, author),
          ...createExecutiveSummary(rawMarkdown),
          ...createManualTOC(rawMarkdown),
          ...contentElements,
          ...(isClientFacing ? createSignaturePage(company, date, author) : []),
        ],
      },
    ],
  });
}

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

    const logoData = await fetchLogo();

    let contentElements: (Paragraph | Table)[];
    let rawMarkdown = "";
    if (contentType === "markdown" || typeof content === "string") {
      rawMarkdown = typeof content === "string" ? content : JSON.stringify(content, null, 2);
      contentElements = markdownToParagraphs(rawMarkdown);
    } else {
      rawMarkdown = JSON.stringify(content, null, 2);
      contentElements = jsonToParagraphs(content, stepNumber);
    }

    const doc = buildDocx(title, projectName || "Proyecto", company || "", dateStr, ver, contentElements, logoData, rawMarkdown, stepNumber, author);
    const buffer = await Packer.toBuffer(doc);

    const supabase = getSupabaseAdmin();
    const filePath = `${projectId}/${stepNumber}/v${ver}.docx`;

    const { error: uploadError } = await supabase.storage
      .from("project-documents")
      .upload(filePath, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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

    const { error: dbError } = await supabase
      .from("project_documents")
      .upsert({
        project_id: projectId,
        step_number: stepNumber,
        version: parseInt(ver.replace("v", "")) || 1,
        file_url: signedUrlData.signedUrl,
        file_format: "docx",
        is_client_facing: [3, 5, 7].includes(stepNumber),
        updated_at: new Date().toISOString(),
      }, { onConflict: "project_id,step_number,version" })
      .select()
      .single();

    return new Response(JSON.stringify({
      url: signedUrlData.signedUrl,
      filePath,
      fileName: `${title.replace(/\s+/g, "-").toLowerCase()}-${ver}.docx`,
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

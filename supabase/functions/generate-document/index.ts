import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, Footer, Header, ShadingType, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, PageNumber, TabStopPosition, TabStopType, TableOfContents, StyleLevel } from "npm:docx@9.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BRAND = {
  primary: "0A3039",
  accent: "7ED957",
  text: "1E293B",
  muted: "64748B",
  white: "FFFFFF",
  light: "F1F5F9",
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
    if (error || !data) {
      console.warn("Could not fetch logo:", error?.message);
      return null;
    }
    const arrayBuffer = await data.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (e) {
    console.warn("Logo fetch failed:", e);
    return null;
  }
}

// ── Sanitize markdown ─────────────────────────────────────────────────
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

// ── Cover page ─────────────────────────────────────────────────────────
function createCoverPage(
  title: string,
  projectName: string,
  company: string,
  date: string,
  version: string,
  logoData: Uint8Array | null
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  // Top spacer
  elements.push(new Paragraph({ spacing: { after: 600 }, children: [] }));

  // Teal background block
  for (let i = 0; i < 3; i++) {
    elements.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.primary },
      children: [new TextRun({ text: " ", font: "Arial", size: 12, color: BRAND.primary })],
    }));
  }

  // Logo in teal block
  if (logoData) {
    elements.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.primary },
      children: [
        new ImageRun({
          data: logoData,
          transformation: { width: 220, height: 70 },
          type: "png",
        }),
      ],
    }));
  } else {
    elements.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.primary },
      children: [
        new TextRun({ text: "Man", font: "Arial", size: 36, color: BRAND.white, bold: true }),
        new TextRun({ text: "IAS", font: "Arial", size: 36, color: BRAND.accent, bold: true }),
        new TextRun({ text: " Lab.", font: "Arial", size: 36, color: BRAND.white, bold: true }),
      ],
    }));
  }

  // More teal block rows
  for (let i = 0; i < 3; i++) {
    elements.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.primary },
      children: [new TextRun({ text: " ", font: "Arial", size: 12, color: BRAND.primary })],
    }));
  }

  // Spacer after teal block
  elements.push(new Paragraph({ spacing: { after: 1000 }, children: [] }));

  // Document title
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [
      new TextRun({ text: title.toUpperCase(), font: "Arial", size: 40, color: BRAND.primary, bold: true }),
    ],
  }));

  // Green accent line
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.accent },
    children: [new TextRun({ text: " ", font: "Arial", size: 4 })],
  }));

  // Project name
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 800 },
    children: [
      new TextRun({ text: projectName, font: "Arial", size: 28, color: BRAND.accent, bold: true }),
    ],
  }));

  // Spacer
  elements.push(new Paragraph({ spacing: { after: 800 }, children: [] }));

  // ── Metadata in invisible table ──────────────────────────────────────
  const noBorder = { style: BorderStyle.NONE, size: 0, color: BRAND.white };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

  const metaRows = [
    ["Cliente", company || "—"],
    ["Fecha", date],
    ["Versión", version],
  ];

  const metaTable = new Table({
    width: { size: 50, type: WidthType.PERCENTAGE },
    rows: metaRows.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          borders: noBorders,
          width: { size: 30, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: label.toUpperCase(), font: "Arial", size: 18, color: BRAND.muted, bold: true })],
          })],
        }),
        new TableCell({
          borders: noBorders,
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            spacing: { before: 40, after: 40 },
            indent: { left: 200 },
            children: [new TextRun({ text: value, font: "Arial", size: 20, color: BRAND.text })],
          })],
        }),
      ],
    })),
  });

  elements.push(metaTable);

  // Spacer
  elements.push(new Paragraph({ spacing: { after: 600 }, children: [] }));

  // CONFIDENCIAL
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: "CONFIDENCIAL", font: "Arial", size: 20, color: BRAND.primary, bold: true, allCaps: true }),
    ],
  }));

  // Page break after cover
  elements.push(new Paragraph({ children: [new PageBreak()] }));

  return elements;
}

// ── Manual Table of Contents ──────────────────────────────────────────
function createManualTOC(markdownContent: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  // TOC Title
  elements.push(new Paragraph({
    spacing: { before: 200, after: 400 },
    alignment: AlignmentType.LEFT,
    children: [
      new TextRun({ text: "ÍNDICE DE CONTENIDOS", font: "Arial", size: 32, color: BRAND.primary, bold: true }),
    ],
  }));

  // Thin accent line under title
  elements.push(new Paragraph({
    spacing: { after: 300 },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.accent },
    children: [new TextRun({ text: " ", font: "Arial", size: 4 })],
  }));

  // Scan markdown for headings
  const lines = markdownContent.split("\n");
  let h1Counter = 0;
  let h2Counter = 0;

  for (const line of lines) {
    if (line.startsWith("# ")) {
      h1Counter++;
      h2Counter = 0;
      const title = line.slice(2).trim();
      elements.push(new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({ text: `${h1Counter}.  ${title}`, font: "Arial", size: 22, color: BRAND.primary, bold: true }),
        ],
      }));
    } else if (line.startsWith("## ")) {
      h2Counter++;
      const title = line.slice(3).trim();
      elements.push(new Paragraph({
        spacing: { before: 40, after: 40 },
        indent: { left: 480 },
        children: [
          new TextRun({ text: `${h1Counter}.${h2Counter}  ${title}`, font: "Arial", size: 20, color: BRAND.text }),
        ],
      }));
    }
  }

  // Spacer + page break after TOC
  elements.push(new Paragraph({ spacing: { before: 200 }, children: [new PageBreak()] }));

  return elements;
}

// ── Parse markdown table to docx Table ─────────────────────────────────
function parseMarkdownTable(tableLines: string[]): Table {
  const parseCells = (line: string): string[] =>
    line.split("|").slice(1, -1).map(c => c.trim());

  const headerCells = parseCells(tableLines[0]);
  const dataLines = tableLines.slice(2);

  const tableBorder = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: "D1D5DB",
  };
  const borders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder };

  const headerRow = new TableRow({
    tableHeader: true,
    children: headerCells.map(cell => new TableCell({
      shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.primary },
      borders,
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        spacing: { before: 60, after: 60 },
        children: parseInlineFormatting(cell).map(r => new TextRun({ ...r, font: "Arial", size: 18, color: BRAND.white, bold: true } as any)),
      })],
    })),
  });

  const dataRows = dataLines
    .filter(l => l.trim().startsWith("|"))
    .map((line, rowIdx) => {
      const cells = parseCells(line);
      const isZebra = rowIdx % 2 === 1;
      return new TableRow({
        children: headerCells.map((_, colIdx) => new TableCell({
          shading: isZebra ? { type: ShadingType.CLEAR, color: "auto", fill: BRAND.light } : undefined,
          borders,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            spacing: { before: 50, after: 50 },
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

// ── Parse markdown to docx paragraphs ──────────────────────────────────
function markdownToParagraphs(md: string): (Paragraph | Table)[] {
  const sanitized = sanitizeMarkdown(md);
  const lines = sanitized.split("\n");
  const elements: (Paragraph | Table)[] = [];
  let isFirstH1 = true;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect table blocks
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 3) {
        // Extra spacing before table
        elements.push(new Paragraph({ spacing: { before: 160, after: 80 }, children: [] }));
        elements.push(parseMarkdownTable(tableLines));
        // Extra spacing after table
        elements.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
      }
      continue;
    }

    if (line.startsWith("# ")) {
      if (!isFirstH1) {
        elements.push(new Paragraph({ children: [new PageBreak()] }));
      }
      isFirstH1 = false;

      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        style: "ManIASHeading1",
        spacing: { before: 400, after: 0 },
        shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.primary },
        children: [new TextRun({ text: "  " + line.slice(2) + "  ", font: "Arial", size: 28, color: BRAND.white, bold: true })],
      }));
      // Spacing after H1 (no green accent line)

    } else if (line.startsWith("## ")) {
      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        style: "ManIASHeading2",
        spacing: { before: 360, after: 180 },
        children: [new TextRun({ text: line.slice(3), font: "Arial", size: 24, color: BRAND.primary, bold: true })],
      }));
    } else if (line.startsWith("### ")) {
      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 280, after: 140 },
        children: [new TextRun({ text: line.slice(4), font: "Arial", size: 22, color: BRAND.text, bold: true })],
      }));
    } else if (line.startsWith("#### ")) {
      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_4,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: line.slice(5), font: "Arial", size: 20, color: BRAND.text, bold: true, italics: true })],
      }));
    } else if (line.startsWith("##### ")) {
      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_5,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: line.slice(6), font: "Arial", size: 20, color: BRAND.text, bold: true })],
      }));
    } else if (line.startsWith("###### ")) {
      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_6,
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: line.slice(7), font: "Arial", size: 18, color: BRAND.muted, bold: true, italics: true })],
      }));
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const bulletText = line.slice(2);
      const runs = parseBulletRuns(bulletText);
      elements.push(new Paragraph({
        bullet: { level: 0 },
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 80 },
        children: runs,
      }));
    } else if (line.match(/^\d+\.\s/)) {
      const text = line.replace(/^\d+\.\s/, "");
      elements.push(new Paragraph({
        numbering: { reference: "default-numbering", level: 0 },
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 80 },
        children: [new TextRun({ text, font: "Montserrat", size: 20, color: BRAND.text })],
      }));
    } else if (/^ {6,}[-*] /.test(line)) {
      const bulletText = line.replace(/^ {6,}[-*] /, "");
      const runs = parseBulletRuns(bulletText);
      elements.push(new Paragraph({
        bullet: { level: 2 },
        spacing: { after: 40 },
        children: runs,
      }));
    } else if (/^ {2,5}[-*] /.test(line)) {
      const bulletText = line.replace(/^ {2,5}[-*] /, "");
      const runs = parseBulletRuns(bulletText);
      elements.push(new Paragraph({
        bullet: { level: 1 },
        spacing: { after: 50 },
        children: runs,
      }));
    } else if (line.trim() === "") {
      elements.push(new Paragraph({ spacing: { after: 140 }, children: [] }));
    } else if (line.startsWith("> ")) {
      elements.push(new Paragraph({
        indent: { left: 720 },
        spacing: { before: 60, after: 100 },
        shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.light },
        children: [new TextRun({ text: line.slice(2), font: "Arial", size: 20, color: BRAND.muted, italics: true })],
      }));
    } else if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: line.slice(2, -2), font: "Arial", size: 20, color: BRAND.text, bold: true })],
      }));
    } else {
      const runs = parseInlineFormatting(line);
      elements.push(new Paragraph({
        spacing: { after: 100 },
        children: runs,
      }));
    }
    i++;
  }
  return elements;
}

// Parse bullet text with bold lead-in pattern: **text**: rest
function parseBulletRuns(text: string): TextRun[] {
  const leadMatch = text.match(/^\*\*(.+?)\*\*:\s*(.*)/);
  if (leadMatch) {
    return [
      new TextRun({ text: leadMatch[1] + ": ", font: "Arial", size: 20, color: BRAND.text, bold: true }),
      new TextRun({ text: leadMatch[2], font: "Arial", size: 20, color: BRAND.text }),
    ];
  }
  return parseInlineFormatting(text);
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], font: "Arial", size: 20, color: BRAND.text, bold: true, italics: true }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], font: "Arial", size: 20, color: BRAND.text, bold: true }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], font: "Arial", size: 20, color: BRAND.text, italics: true }));
    } else if (match[5]) {
      runs.push(new TextRun({ text: match[5], font: "Courier New", size: 18, color: BRAND.accent }));
    } else if (match[6]) {
      runs.push(new TextRun({ text: match[6], font: "Arial", size: 20, color: BRAND.text }));
    }
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ text, font: "Arial", size: 20, color: BRAND.text }));
  }
  return runs;
}

// ── JSON to paragraphs (generic) ──────────────────────────────────────
function jsonToParagraphs(data: any, stepNumber: number): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  const addSection = (title: string, content: any) => {
    paragraphs.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      style: "ManIASHeading2",
      spacing: { before: 360, after: 180 },
      children: [new TextRun({ text: title, font: "Arial", size: 24, color: BRAND.primary, bold: true })],
    }));

    if (typeof content === "string") {
      const sanitized = sanitizeMarkdown(content);
      paragraphs.push(new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: sanitized, font: "Arial", size: 20, color: BRAND.text })],
      }));
    } else if (Array.isArray(content)) {
      content.forEach((item: any) => {
        if (typeof item === "string") {
          paragraphs.push(new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 80 },
            children: [new TextRun({ text: sanitizeMarkdown(item), font: "Arial", size: 20, color: BRAND.text })],
          }));
        } else if (typeof item === "object") {
          const summary = Object.entries(item).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
          paragraphs.push(new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 80 },
            children: [new TextRun({ text: sanitizeMarkdown(summary), font: "Arial", size: 20, color: BRAND.text })],
          }));
        }
      });
      // Extra spacing after bullet block
      paragraphs.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
    } else if (typeof content === "object" && content !== null) {
      Object.entries(content).forEach(([k, v]) => {
        paragraphs.push(new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: `${k}: `, font: "Arial", size: 20, color: BRAND.text, bold: true }),
            new TextRun({ text: sanitizeMarkdown(typeof v === "object" ? JSON.stringify(v) : String(v)), font: "Arial", size: 20, color: BRAND.text }),
          ],
        }));
      });
    }
  };

  if (typeof data === "object" && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      if (key === "parse_error" || key === "raw_text") continue;
      const title = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      addSection(title, value);
    }
  } else {
    paragraphs.push(new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: JSON.stringify(data, null, 2), font: "Courier New", size: 18, color: BRAND.text })],
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
  logoData: Uint8Array | null
): Document {
  return new Document({
    // ── Document-level styles ──────────────────────────────────────────
    styles: {
      paragraphStyles: [
        {
          id: "ManIASHeading1",
          name: "ManIAS Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            font: "Arial",
            size: 28,
            color: BRAND.white,
            bold: true,
          },
          paragraph: {
            spacing: { before: 400, after: 0 },
          },
        },
        {
          id: "ManIASHeading2",
          name: "ManIAS Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            font: "Arial",
            size: 24,
            color: BRAND.primary,
            bold: true,
          },
          paragraph: {
            spacing: { before: 360, after: 180 },
          },
        },
        {
          id: "ManIASBody",
          name: "ManIAS Body",
          basedOn: "Normal",
          run: {
            font: "Arial",
            size: 20,
            color: BRAND.text,
          },
          paragraph: {
            spacing: { after: 100, line: 276 },
          },
        },
      ],
    },
    numbering: {
      config: [{
        reference: "default-numbering",
        levels: [{
          level: 0,
          format: "decimal" as any,
          text: "%1.",
          alignment: AlignmentType.START,
        }],
      }],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1200, right: 1200 },
          },
        },
        // ── Header with dual alignment via tab stops ────────────────────
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: [
                  { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
                ],
                spacing: { after: 40 },
                children: [
                  new TextRun({ text: projectName, font: "Arial", size: 16, color: BRAND.primary, bold: true }),
                  new TextRun({ text: "\t", font: "Arial", size: 16 }),
                  new TextRun({ text: "CONFIDENCIAL", font: "Arial", size: 14, color: BRAND.accent, bold: true }),
                ],
              }),
              // Thin separator line below header
              new Paragraph({
                spacing: { after: 0 },
                shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.primary },
                children: [new TextRun({ text: " ", font: "Arial", size: 2 })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              // Thin separator line above footer
              new Paragraph({
                spacing: { after: 60 },
                shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.light },
                children: [new TextRun({ text: " ", font: "Arial", size: 2 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Man", font: "Arial", size: 14, color: BRAND.muted }),
                  new TextRun({ text: "IAS", font: "Arial", size: 14, color: BRAND.accent, bold: true }),
                  new TextRun({ text: " Lab.  ·  Pág. ", font: "Arial", size: 14, color: BRAND.muted }),
                  new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 14, color: BRAND.muted }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...createCoverPage(title, projectName, company, date, version, logoData),
          ...createTableOfContents(),
          ...contentElements,
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
    const { projectId, stepNumber, content, contentType, projectName, company, date, version } = await req.json();

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
    if (contentType === "markdown" || typeof content === "string") {
      contentElements = markdownToParagraphs(typeof content === "string" ? content : JSON.stringify(content, null, 2));
    } else {
      contentElements = jsonToParagraphs(content, stepNumber);
    }

    const doc = buildDocx(title, projectName || "Proyecto", company || "", dateStr, ver, contentElements, logoData);
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

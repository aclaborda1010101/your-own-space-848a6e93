import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, TabStopPosition, TabStopType, Footer, Header, TableOfContents, Table, TableRow, TableCell, WidthType, BorderStyle } from "npm:docx@9.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BRAND = {
  primary: "6366F1",
  secondary: "8B5CF6",
  text: "1E293B",
  muted: "64748B",
  light: "F1F5F9",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── Cover page ─────────────────────────────────────────────────────────
function createCoverPage(title: string, projectName: string, company: string, date: string, version: string): Paragraph[] {
  return [
    new Paragraph({ spacing: { after: 4000 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "AGUSTITO", font: "Arial", size: 28, color: BRAND.primary, bold: true, allCaps: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: "Consultora Tecnológica", font: "Arial", size: 20, color: BRAND.muted, italics: true }),
      ],
    }),
    new Paragraph({ spacing: { after: 1200 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({ text: title.toUpperCase(), font: "Arial", size: 36, color: BRAND.text, bold: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
      children: [
        new TextRun({ text: projectName, font: "Arial", size: 28, color: BRAND.primary }),
      ],
    }),
    new Paragraph({ spacing: { after: 1600 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: `Cliente: ${company || "—"}`, font: "Arial", size: 22, color: BRAND.muted }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: `Fecha: ${date}`, font: "Arial", size: 22, color: BRAND.muted }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: `Versión: ${version}`, font: "Arial", size: 22, color: BRAND.muted }),
      ],
    }),
    new Paragraph({ spacing: { after: 800 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "CONFIDENCIAL", font: "Arial", size: 18, color: BRAND.primary, bold: true, allCaps: true }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── Parse markdown to docx paragraphs ──────────────────────────────────
function markdownToParagraphs(md: string): Paragraph[] {
  const lines = md.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    if (line.startsWith("# ")) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [new TextRun({ text: line.slice(2), font: "Arial", size: 28, color: BRAND.text, bold: true })],
      }));
    } else if (line.startsWith("## ")) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
        children: [new TextRun({ text: line.slice(3), font: "Arial", size: 24, color: BRAND.primary, bold: true })],
      }));
    } else if (line.startsWith("### ")) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: line.slice(4), font: "Arial", size: 22, color: BRAND.text, bold: true })],
      }));
    } else if (line.startsWith("#### ")) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_4,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: line.slice(5), font: "Arial", size: 20, color: BRAND.text, bold: true, italics: true })],
      }));
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      paragraphs.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: [new TextRun({ text: line.slice(2), font: "Arial", size: 20, color: BRAND.text })],
      }));
    } else if (line.match(/^\d+\.\s/)) {
      const text = line.replace(/^\d+\.\s/, "");
      paragraphs.push(new Paragraph({
        numbering: { reference: "default-numbering", level: 0 },
        spacing: { after: 60 },
        children: [new TextRun({ text, font: "Arial", size: 20, color: BRAND.text })],
      }));
    } else if (line.startsWith("  - ") || line.startsWith("  * ")) {
      paragraphs.push(new Paragraph({
        bullet: { level: 1 },
        spacing: { after: 40 },
        children: [new TextRun({ text: line.slice(4), font: "Arial", size: 20, color: BRAND.text })],
      }));
    } else if (line.trim() === "") {
      paragraphs.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    } else if (line.startsWith("> ")) {
      paragraphs.push(new Paragraph({
        indent: { left: 720 },
        spacing: { after: 80 },
        children: [new TextRun({ text: line.slice(2), font: "Arial", size: 20, color: BRAND.muted, italics: true })],
      }));
    } else if (line.startsWith("**") && line.endsWith("**")) {
      paragraphs.push(new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: line.slice(2, -2), font: "Arial", size: 20, color: BRAND.text, bold: true })],
      }));
    } else {
      // Parse inline bold/italic
      const runs = parseInlineFormatting(line);
      paragraphs.push(new Paragraph({
        spacing: { after: 80 },
        children: runs,
      }));
    }
  }
  return paragraphs;
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
      runs.push(new TextRun({ text: match[5], font: "Courier New", size: 18, color: BRAND.primary }));
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
      spacing: { before: 300, after: 150 },
      children: [new TextRun({ text: title, font: "Arial", size: 24, color: BRAND.primary, bold: true })],
    }));

    if (typeof content === "string") {
      paragraphs.push(new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: content, font: "Arial", size: 20, color: BRAND.text })],
      }));
    } else if (Array.isArray(content)) {
      content.forEach((item: any) => {
        if (typeof item === "string") {
          paragraphs.push(new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [new TextRun({ text: item, font: "Arial", size: 20, color: BRAND.text })],
          }));
        } else if (typeof item === "object") {
          const summary = Object.entries(item).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
          paragraphs.push(new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [new TextRun({ text: summary, font: "Arial", size: 20, color: BRAND.text })],
          }));
        }
      });
    } else if (typeof content === "object" && content !== null) {
      Object.entries(content).forEach(([k, v]) => {
        paragraphs.push(new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `${k}: `, font: "Arial", size: 20, color: BRAND.text, bold: true }),
            new TextRun({ text: typeof v === "object" ? JSON.stringify(v) : String(v), font: "Arial", size: 20, color: BRAND.text }),
          ],
        }));
      });
    }
  };

  // Iterate top-level keys
  if (typeof data === "object" && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      if (key === "parse_error" || key === "raw_text") continue;
      const title = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      addSection(title, value);
    }
  } else {
    paragraphs.push(new Paragraph({
      spacing: { after: 80 },
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
  contentParagraphs: Paragraph[]
): Document {
  return new Document({
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
        properties: {},
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `${projectName} · `, font: "Arial", size: 16, color: BRAND.muted }),
                  new TextRun({ text: "CONFIDENCIAL", font: "Arial", size: 16, color: BRAND.primary, bold: true }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Agustito · Consultora Tecnológica · Confidencial", font: "Arial", size: 14, color: BRAND.muted }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...createCoverPage(title, projectName, company, date, version),
          ...contentParagraphs,
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

    // Parse content
    let contentParagraphs: Paragraph[];
    if (contentType === "markdown" || typeof content === "string") {
      contentParagraphs = markdownToParagraphs(typeof content === "string" ? content : JSON.stringify(content, null, 2));
    } else {
      contentParagraphs = jsonToParagraphs(content, stepNumber);
    }

    // Build and pack DOCX
    const doc = buildDocx(title, projectName || "Proyecto", company || "", dateStr, ver, contentParagraphs);
    const buffer = await Packer.toBuffer(doc);

    // Upload to storage
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

    // Get signed URL (valid 1 hour)
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

    // Update project_documents record
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

    // Ignore DB errors silently — download still works

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

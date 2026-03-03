import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ── Parse files ─────────────────────────────────────────────────────────────

interface ParsedFile {
  headers: string[];
  rows: string[][];
  rowCount: number;
  rawText?: string;
}

function parseCSV(text: string): ParsedFile {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [], rowCount: 0 };

  // Detect separator
  const firstLine = lines[0];
  const sep = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";

  const headers = firstLine.split(sep).map(h => h.replace(/^"|"$/g, "").trim());
  const rows = lines.slice(1).map(line =>
    line.split(sep).map(cell => cell.replace(/^"|"$/g, "").trim())
  );

  return { headers, rows, rowCount: rows.length };
}

function parseJSON(text: string): ParsedFile {
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      const rows = data.map((item: Record<string, unknown>) =>
        headers.map(h => String(item[h] ?? ""))
      );
      return { headers, rows, rowCount: rows.length };
    }
    // Single object
    const headers = Object.keys(data);
    return { headers, rows: [headers.map(h => String(data[h] ?? ""))], rowCount: 1 };
  } catch {
    return { headers: [], rows: [], rowCount: 0, rawText: text.substring(0, 5000) };
  }
}

function parseTXT(text: string): ParsedFile {
  const lines = text.split("\n").filter(l => l.trim());
  return {
    headers: ["line"],
    rows: lines.map(l => [l]),
    rowCount: lines.length,
    rawText: text.substring(0, 10000),
  };
}

async function parseFileContent(buffer: Uint8Array, fileName: string): Promise<ParsedFile> {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  const decoder = new TextDecoder();

  if (ext === "csv" || ext === "tsv") {
    return parseCSV(decoder.decode(buffer));
  }

  if (ext === "json") {
    return parseJSON(decoder.decode(buffer));
  }

  if (ext === "txt" || ext === "md") {
    return parseTXT(decoder.decode(buffer));
  }

  if (ext === "xlsx" || ext === "xls") {
    // For XLSX in Deno, we parse as text-like structure
    // The edge function receives the file; we extract what we can
    // We'll use a simplified approach: read as binary, send raw sample to LLM
    return {
      headers: [],
      rows: [],
      rowCount: 0,
      rawText: `[Archivo Excel: ${fileName}, ${buffer.length} bytes. Análisis basado en nombre y tamaño.]`,
    };
  }

  if (ext === "pdf") {
    return {
      headers: [],
      rows: [],
      rowCount: 0,
      rawText: `[Archivo PDF: ${fileName}, ${buffer.length} bytes. Análisis basado en nombre y tamaño.]`,
    };
  }

  // Fallback: try as text
  try {
    const text = decoder.decode(buffer);
    return parseTXT(text);
  } catch {
    return { headers: [], rows: [], rowCount: 0, rawText: `[Archivo binario: ${fileName}]` };
  }
}

// ── LLM Analysis ────────────────────────────────────────────────────────────

async function analyzeWithLLM(fileName: string, parsed: ParsedFile): Promise<Record<string, unknown>> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  // Build sample: headers + first 100 rows
  let sampleText = "";
  if (parsed.headers.length > 0) {
    sampleText += `Columnas: ${parsed.headers.join(", ")}\n\n`;
    const sampleRows = parsed.rows.slice(0, 100);
    sampleText += `Primeras ${sampleRows.length} filas (de ${parsed.rowCount} totales):\n`;
    for (const row of sampleRows) {
      sampleText += row.join(" | ") + "\n";
    }
  } else if (parsed.rawText) {
    sampleText = `Contenido del archivo (muestra):\n${parsed.rawText.substring(0, 8000)}`;
  } else {
    sampleText = `Archivo vacío o no parseado: ${fileName}`;
  }

  const systemPrompt = `Eres un analista de datos experto. Analiza la estructura y contenido de un archivo de datos del negocio de un cliente. Identifica variables, entidades, cobertura temporal/geográfica y calidad.

Responde SOLO con JSON válido con esta estructura exacta:
{
  "column_types": {"col_name": "numeric|categorical|date|text|boolean", ...},
  "variables_detected": [
    {"name": "nombre_variable", "type": "numeric|categorical|date|text|boolean", "records": 500, "quality": 92, "description": "descripción corta"}
  ],
  "entities_detected": ["Aldi", "Mercadona", ...],
  "temporal_coverage": {"from": "2020-01", "to": "2025-12"} | null,
  "geographic_coverage": ["Madrid", "Barcelona"] | [],
  "quality_score": 85,
  "quality_issues": ["12% de campos vacíos en motivo_salida"],
  "business_context": "Descripción de 2-3 frases del contexto de negocio que representan estos datos"
}`;

  const userPrompt = `Archivo: ${fileName}\nTotal filas: ${parsed.rowCount}\n\n${sampleText}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: "application/json" },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  try {
    return JSON.parse(text);
  } catch {
    return { error: "Failed to parse LLM response", raw: text.substring(0, 500) };
  }
}

// ── Actions ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    // ── Upload & Analyze (FormData) ──
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const projectId = formData.get("projectId") as string;
      const authHeader = req.headers.get("Authorization") || "";

      if (!projectId) throw new Error("projectId required");

      const supabase = getSupabaseAdmin();

      // Get user from auth header
      const token = authHeader.replace("Bearer ", "");
      const { data: authData, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !authData?.user) throw new Error("Unauthorized");
      const userId = authData.user.id;

      const results = [];

      // Process each file
      for (const [key, value] of formData.entries()) {
        if (key === "projectId") continue;
        if (!(value instanceof File)) continue;

        const file = value as File;
        const buffer = new Uint8Array(await file.arrayBuffer());
        const fileName = file.name;
        const storagePath = `${projectId}/raw/${fileName}`;

        console.log(`[analyze-client-data] Processing file: ${fileName} (${buffer.length} bytes)`);

        // 0. Dedup by SHA-256 hash
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const fileHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

        const { data: existing } = await supabase
          .from("client_data_files")
          .select("id, file_name")
          .eq("project_id", projectId)
          .eq("file_hash", fileHash)
          .maybeSingle();

        if (existing) {
          console.log(`[analyze-client-data] Duplicate detected: ${fileName} matches ${existing.file_name}`);
          results.push({ name: fileName, status: "duplicate", existing_file: existing.file_name, message: "Este archivo ya fue subido" });
          continue;
        }

        // 1. Upload to storage
        const { error: uploadErr } = await supabase.storage
          .from("project-data")
          .upload(storagePath, buffer, {
            contentType: file.type || "application/octet-stream",
            upsert: true,
          });

        if (uploadErr) {
          console.error(`[analyze-client-data] Upload error for ${fileName}:`, uploadErr.message);
          await supabase.from("client_data_files").insert({
            project_id: projectId,
            user_id: userId,
            file_name: fileName,
            file_type: file.type,
            storage_path: storagePath,
            source_mode: "upload",
            status: "error",
            file_hash: fileHash,
            business_context: `Upload failed: ${uploadErr.message}`,
          });
          results.push({ name: fileName, status: "error", error: uploadErr.message });
          continue;
        }

        // 2. Create record in analyzing status
        const { data: record } = await supabase.from("client_data_files").insert({
          project_id: projectId,
          user_id: userId,
          file_name: fileName,
          file_type: file.type,
          storage_path: storagePath,
          source_mode: "upload",
          status: "analyzing",
          file_hash: fileHash,
        }).select().single();

        // 3. Parse file
        const parsed = await parseFileContent(buffer, fileName);

        // 4. Analyze with LLM
        let analysis: Record<string, unknown> = {};
        try {
          analysis = await analyzeWithLLM(fileName, parsed);
        } catch (llmErr) {
          console.error(`[analyze-client-data] LLM analysis error for ${fileName}:`, llmErr);
          analysis = { error: "LLM analysis failed", quality_score: 0 };
        }

        // 5. Update record with analysis
        await supabase.from("client_data_files").update({
          row_count: parsed.rowCount,
          columns: parsed.headers,
          column_types: analysis.column_types || {},
          variables_detected: analysis.variables_detected || [],
          entities_detected: (analysis.entities_detected as string[]) || [],
          temporal_coverage: analysis.temporal_coverage || null,
          geographic_coverage: (analysis.geographic_coverage as string[]) || [],
          quality_score: (analysis.quality_score as number) || 0,
          quality_issues: (analysis.quality_issues as string[]) || [],
          business_context: (analysis.business_context as string) || "",
          status: "analyzed",
        }).eq("id", record!.id);

        results.push({
          file_id: record!.id,
          name: fileName,
          rows: parsed.rowCount,
          columns: parsed.headers,
          analysis,
        });

        console.log(`[analyze-client-data] File analyzed: ${fileName} → ${parsed.rowCount} rows, quality=${analysis.quality_score}`);
      }

      return new Response(JSON.stringify({ files: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── JSON actions ──
    const body = await req.json();
    const { action, projectId } = body;
    const supabase = getSupabaseAdmin();

    // Auth check
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) throw new Error("Unauthorized");
    const userId = authData.user.id;

    // ── get_data_profile ──
    if (action === "get_data_profile") {
      const { data: files } = await supabase
        .from("client_data_files")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "analyzed");

      if (!files || files.length === 0) {
        return new Response(JSON.stringify({
          data_profile: { has_client_data: false },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Aggregate variables across files
      const allVariables: Record<string, unknown>[] = [];
      const allEntities = new Set<string>();
      let totalRows = 0;
      let minDate: string | null = null;
      let maxDate: string | null = null;
      const allGeo = new Set<string>();
      let totalQuality = 0;
      const allIssues: string[] = [];
      const allContexts: string[] = [];
      const sourceModes = new Set<string>();

      for (const f of files) {
        totalRows += f.row_count || 0;
        sourceModes.add(f.source_mode);

        if (Array.isArray(f.variables_detected)) {
          for (const v of f.variables_detected as Record<string, unknown>[]) {
            allVariables.push(v);
          }
        }

        if (Array.isArray(f.entities_detected)) {
          for (const e of f.entities_detected) allEntities.add(e);
        }

        if (f.temporal_coverage) {
          const tc = f.temporal_coverage as Record<string, string>;
          if (tc.from && (!minDate || tc.from < minDate)) minDate = tc.from;
          if (tc.to && (!maxDate || tc.to > maxDate)) maxDate = tc.to;
        }

        if (Array.isArray(f.geographic_coverage)) {
          for (const g of f.geographic_coverage) allGeo.add(g);
        }

        totalQuality += f.quality_score || 0;

        if (Array.isArray(f.quality_issues)) {
          allIssues.push(...f.quality_issues);
        }

        if (f.business_context) allContexts.push(f.business_context);
      }

      const dataProfile = {
        has_client_data: true,
        total_files: files.length,
        total_rows: totalRows,
        source_modes_used: [...sourceModes],
        detected_variables: allVariables,
        detected_entities: [...allEntities],
        temporal_coverage: minDate && maxDate ? { from: minDate, to: maxDate } : null,
        geographic_coverage: [...allGeo],
        data_quality_score: Math.round(totalQuality / files.length),
        quality_issues: allIssues,
        business_context: allContexts.join(" "),
        user_corrections: null,
      };

      return new Response(JSON.stringify({
        data_profile: dataProfile,
        files: files.map(f => ({
          id: f.id,
          name: f.file_name,
          rows: f.row_count,
          columns: f.columns,
          quality: f.quality_score,
          status: f.status,
        })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── update_corrections ──
    if (action === "update_corrections") {
      const { corrections } = body;
      // Store corrections as a special record or update data_profile
      // For now, store in the step output when the wizard saves the data profile
      return new Response(JSON.stringify({ status: "ok", corrections }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── delete_file ──
    if (action === "delete_file") {
      const { fileId } = body;
      const { data: file } = await supabase
        .from("client_data_files")
        .select("storage_path")
        .eq("id", fileId)
        .eq("user_id", userId)
        .single();

      if (file?.storage_path) {
        await supabase.storage.from("project-data").remove([file.storage_path]);
      }

      await supabase.from("client_data_files").delete().eq("id", fileId).eq("user_id", userId);

      return new Response(JSON.stringify({ status: "deleted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[analyze-client-data] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

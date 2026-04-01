import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- Google Auth ----------
async function getAccessToken(serviceAccountKey: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = btoa(JSON.stringify({
    iss: serviceAccountKey.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));

  const textEncoder = new TextEncoder();
  const inputData = textEncoder.encode(`${header}.${claim}`);

  // Import the private key
  const pemContent = serviceAccountKey.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, inputData);
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${header}.${claim}.${signatureBase64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(`Google auth failed: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

// ---------- Drive API helpers ----------
function extractFolderId(url: string): string | null {
  // Handle formats: /folders/ID, /drive/folders/ID, ?id=ID
  const m1 = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  // Plain folder ID
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) return url.trim();
  return null;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}

async function listFolderFiles(folderId: string, token: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken = "";
  const supportedMimes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "application/json",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.google-apps.folder",
  ];

  do {
    const q = `'${folderId}' in parents and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,mimeType,size)&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Drive API error: ${res.status} ${err}`);
    }
    const data = await res.json();
    for (const f of data.files || []) {
      if (f.mimeType === "application/vnd.google-apps.folder") {
        // Recurse into subfolders
        const subFiles = await listFolderFiles(f.id, token);
        files.push(...subFiles);
      } else if (supportedMimes.includes(f.mimeType)) {
        files.push(f);
      }
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return files;
}

async function downloadFileContent(fileId: string, mimeType: string, token: string): Promise<string> {
  let url: string;
  let exportMime: string | null = null;

  // Google Docs/Sheets need export
  if (mimeType.startsWith("application/vnd.google-apps.")) {
    exportMime = "text/plain";
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`;
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  // For text-based formats, return directly
  if (["text/csv", "text/plain", "application/json"].includes(mimeType) || exportMime) {
    return (await res.text()).slice(0, 100000); // Cap at 100K chars
  }

  // For binary formats (PDF, XLSX, DOCX), extract text
  if (mimeType === "application/pdf") {
    // Simple text extraction from PDF - get raw bytes and find text strings
    const buffer = await res.arrayBuffer();
    return extractTextFromPDFBuffer(buffer);
  }

  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    // For Excel, just note the type - full parsing would need a library
    return "[Archivo Excel - se requiere análisis detallado de columnas y datos]";
  }

  if (mimeType.includes("wordprocessingml")) {
    const buffer = await res.arrayBuffer();
    return extractTextFromDOCXBuffer(buffer);
  }

  return "[Formato no soportado para extracción de texto]";
}

function extractTextFromPDFBuffer(buffer: ArrayBuffer): string {
  // Simple text extraction - find text between parentheses in PDF streams
  const bytes = new Uint8Array(buffer);
  const str = new TextDecoder("latin1").decode(bytes);
  const textParts: string[] = [];
  
  // Extract text from Tj and TJ operators
  const tjMatches = str.match(/\(([^)]{2,})\)\s*Tj/g) || [];
  for (const m of tjMatches) {
    const inner = m.replace(/^\(/, "").replace(/\)\s*Tj$/, "");
    if (inner.length > 1) textParts.push(inner);
  }

  if (textParts.length < 10) {
    // Fallback: try to find readable text sequences
    const readable = str.match(/[A-Za-zÀ-ÿ0-9\s.,;:!?€$%]{20,}/g) || [];
    textParts.push(...readable.slice(0, 200));
  }

  return textParts.join(" ").slice(0, 100000);
}

function extractTextFromDOCXBuffer(buffer: ArrayBuffer): string {
  // Basic DOCX text extraction via XML parsing
  const bytes = new Uint8Array(buffer);
  const str = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const matches = str.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  return matches.map(m => m.replace(/<[^>]+>/g, "")).join(" ").slice(0, 100000);
}

// ---------- LLM Classification ----------
async function classifyFileRelevance(
  fileName: string,
  mimeType: string,
  textSample: string,
  sector: string,
  businessObjective: string,
  geminiKey: string
): Promise<{ score: number; reason: string; classification: string }> {
  const prompt = `Analiza este archivo y determina su relevancia para un estudio de detección de patrones en el sector "${sector}".
Objetivo de negocio: ${businessObjective || "análisis general del sector"}

Archivo: ${fileName} (${mimeType})
Muestra de contenido (primeros 3000 caracteres):
${textSample.slice(0, 3000)}

Responde SOLO en JSON:
{
  "relevance_score": 0.00-1.00,
  "reason": "explicación breve de por qué es o no relevante",
  "classification": "una de: financial_report | lease_contract | traffic_study | market_analysis | tenant_data | demographic_data | competitor_analysis | operational_data | legal_document | marketing_material | other"
}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512, responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    return { score: 0, reason: "Error al clasificar", classification: "other" };
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      score: Math.min(1, Math.max(0, parsed.relevance_score || 0)),
      reason: parsed.reason || "",
      classification: parsed.classification || "other",
    };
  } catch {
    return { score: 0, reason: "Error parsing LLM response", classification: "other" };
  }
}

// ---------- Main handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, run_id, source_url, sector, business_objective, user_id, batch_offset } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_KEY") || "";
    const serviceAccountRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey) as any;

    // ---- LIST FOLDER ----
    if (action === "list_folder") {
      if (!serviceAccountRaw) {
        return new Response(JSON.stringify({
          error: "GOOGLE_SERVICE_ACCOUNT_KEY no configurado",
          setup_instructions: "Necesitas crear una Service Account en Google Cloud Console con acceso a Drive API y guardar su JSON key como secreto GOOGLE_SERVICE_ACCOUNT_KEY en Supabase."
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const serviceAccount = JSON.parse(serviceAccountRaw);
      const folderId = extractFolderId(source_url || "");
      if (!folderId) {
        return new Response(JSON.stringify({ error: "URL de carpeta de Drive no válida" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const token = await getAccessToken(serviceAccount);
      const files = await listFolderFiles(folderId, token);

      // Insert all files as pending into the datasets table
      if (files.length > 0 && run_id && user_id) {
        const rows = files.map(f => ({
          run_id,
          user_id,
          source_url: source_url,
          file_name: f.name,
          file_mime_type: f.mimeType,
          file_size_bytes: f.size ? parseInt(f.size) : null,
          drive_file_id: f.id,
          status: "pending",
        }));
        await supabase.from("pattern_detector_datasets").insert(rows);
      }

      return new Response(JSON.stringify({
        folder_id: folderId,
        total_files: files.length,
        files: files.map(f => ({ id: f.id, name: f.name, type: f.mimeType, size: f.size })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- CLASSIFY FILES (batch) ----
    if (action === "classify_files") {
      if (!serviceAccountRaw) {
        return new Response(JSON.stringify({ error: "GOOGLE_SERVICE_ACCOUNT_KEY no configurado" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const serviceAccount = JSON.parse(serviceAccountRaw);
      const token = await getAccessToken(serviceAccount);

      // Get pending files for this run
      const offset = batch_offset || 0;
      const batchSize = 5;
      const { data: pendingFiles } = await supabase
        .from("pattern_detector_datasets")
        .select("*")
        .eq("run_id", run_id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .range(0, batchSize - 1);

      if (!pendingFiles || pendingFiles.length === 0) {
        return new Response(JSON.stringify({ status: "complete", processed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      let processed = 0;
      for (const file of pendingFiles) {
        try {
          // Update status to processing
          await supabase.from("pattern_detector_datasets")
            .update({ status: "processing" })
            .eq("id", file.id);

          // Download and extract text
          const text = await downloadFileContent(file.drive_file_id, file.file_mime_type || "", token);

          // Classify with LLM
          const classification = await classifyFileRelevance(
            file.file_name,
            file.file_mime_type || "",
            text,
            sector || "",
            business_objective || "",
            geminiKey
          );

          const finalStatus = classification.score >= 0.5 ? "relevant" : "irrelevant";

          await supabase.from("pattern_detector_datasets")
            .update({
              extracted_text: text.slice(0, 200000), // Cap stored text
              relevance_score: classification.score,
              relevance_reason: classification.reason,
              classification: classification.classification,
              status: finalStatus,
            })
            .eq("id", file.id);

          processed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await supabase.from("pattern_detector_datasets")
            .update({ status: "error", error_message: msg })
            .eq("id", file.id);
        }
      }

      // Check if there are more pending files - self-invoke if so
      const { count } = await supabase
        .from("pattern_detector_datasets")
        .select("id", { count: "exact", head: true })
        .eq("run_id", run_id)
        .eq("status", "pending");

      if (count && count > 0) {
        // Fire-and-forget self-invocation for next batch
        fetch(`${supabaseUrl}/functions/v1/drive-folder-ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            action: "classify_files",
            run_id,
            sector,
            business_objective,
            batch_offset: offset + batchSize,
          }),
        }).catch(() => {});
      }

      return new Response(JSON.stringify({
        status: count && count > 0 ? "processing" : "complete",
        processed,
        remaining: count || 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- GET STATUS ----
    if (action === "get_status") {
      const { data: allFiles } = await supabase
        .from("pattern_detector_datasets")
        .select("id, file_name, file_mime_type, file_size_bytes, relevance_score, relevance_reason, classification, status, error_message")
        .eq("run_id", run_id)
        .order("relevance_score", { ascending: false, nullsFirst: false });

      const stats = {
        total: allFiles?.length || 0,
        pending: allFiles?.filter((f: any) => f.status === "pending").length || 0,
        processing: allFiles?.filter((f: any) => f.status === "processing").length || 0,
        relevant: allFiles?.filter((f: any) => f.status === "relevant").length || 0,
        irrelevant: allFiles?.filter((f: any) => f.status === "irrelevant").length || 0,
        error: allFiles?.filter((f: any) => f.status === "error").length || 0,
      };

      return new Response(JSON.stringify({ stats, files: allFiles || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ---- TOGGLE RELEVANCE (manual override) ----
    if (action === "toggle_relevance") {
      const { file_id, new_status } = await req.json().catch(() => ({ file_id: null, new_status: null }));
      // Re-read since we already consumed the body
      if (file_id && new_status) {
        await supabase.from("pattern_detector_datasets")
          .update({ status: new_status })
          .eq("id", file_id);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Acción no reconocida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("drive-folder-ingest error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

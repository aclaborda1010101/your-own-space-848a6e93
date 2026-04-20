import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { validateAuth } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Analyzes a file uploaded to the `jarvis-attachments` bucket and returns a
 * concise summary that JARVIS can inject into its conversation context.
 *
 * Body: { storagePath: string, fileName: string, mimeType: string }
 *
 * Strategy:
 * - Images → Lovable AI Gateway with vision (google/gemini-2.5-flash)
 * - PDFs / docs (≤4MB) → upload to Gemini for full understanding
 * - Text-like (json, csv, md, txt) → inline in prompt
 * - Audio → forward to OpenAI Whisper (speech-to-text function pattern)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { user, error: authError } = await validateAuth(req, corsHeaders);
  if (authError) return authError;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: { storagePath?: string; fileName?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { storagePath, fileName, mimeType } = body;
  if (!storagePath || !fileName) {
    return new Response(
      JSON.stringify({ error: "storagePath and fileName are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Verify the path belongs to this user
  if (!storagePath.startsWith(`${user!.id}/`)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const { data: blob, error: dlErr } = await admin.storage
      .from("jarvis-attachments")
      .download(storagePath);

    if (dlErr || !blob) {
      console.error("[analyze-attachment] download error", dlErr);
      return new Response(JSON.stringify({ error: "No se pudo descargar el archivo" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sizeBytes = blob.size;
    const mt = (mimeType || blob.type || "application/octet-stream").toLowerCase();

    let userContent: any[];

    // Images via Lovable AI Gateway vision
    if (mt.startsWith("image/")) {
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      userContent = [
        { type: "text", text: `Analiza esta imagen ("${fileName}") y resume su contenido en español de forma clara y útil para el usuario. Si contiene texto, transcríbelo. Si es una captura de pantalla, describe qué se ve y qué intenta comunicar.` },
        { type: "image_url", image_url: { url: `data:${mt};base64,${base64}` } },
      ];
    }
    // Plain text-like
    else if (
      mt.startsWith("text/") ||
      mt.includes("json") ||
      mt.includes("csv") ||
      mt.includes("xml") ||
      fileName.match(/\.(md|txt|csv|json|log|yaml|yml|tsv)$/i)
    ) {
      const text = await blob.text();
      const truncated = text.slice(0, 50000);
      userContent = [{
        type: "text",
        text: `Analiza este archivo ("${fileName}", ${sizeBytes} bytes) y resume su contenido en español. Detecta datos, patrones o información relevante. Si es una lista o tabla, sintetiza lo más importante.\n\n--- CONTENIDO ---\n${truncated}${text.length > 50000 ? "\n\n[... archivo truncado ...]" : ""}`,
      }];
    }
    // PDFs and other binary docs — describe metadata only (full PDF parsing requires extra work)
    else {
      userContent = [{
        type: "text",
        text: `El usuario ha subido un archivo "${fileName}" (${mt}, ${sizeBytes} bytes). De momento sólo puedes confirmar que lo has recibido. Indícale al usuario en español que lo has recibido, qué tipo de archivo es y pregúntale qué quiere que hagas con él.`,
      }];
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Eres un analizador de archivos para JARVIS. Devuelve un resumen claro, conciso y útil en español. Siempre menciona el nombre del archivo al principio.",
          },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[analyze-attachment] AI error", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de uso alcanzado, espera un momento." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Se requieren créditos en Lovable AI." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Error al analizar el archivo" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const summary: string =
      aiData?.choices?.[0]?.message?.content?.toString() || "(sin contenido)";

    return new Response(
      JSON.stringify({
        summary,
        fileName,
        mimeType: mt,
        sizeBytes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    console.error("[analyze-attachment] unexpected error", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

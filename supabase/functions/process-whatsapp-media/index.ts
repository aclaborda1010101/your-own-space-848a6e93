import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const MAX_BASE64_BYTES = 8 * 1024 * 1024; // ~6 MB raw
const FETCH_TIMEOUT_MS = 60_000;

async function fetchWithTimeout(url: string, init: RequestInit, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchWithTimeout(url, init);
      if (res.ok || res.status === 400 || res.status === 404) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}

async function getMediaBase64(instance: string, messageKey: any): Promise<{ base64: string; mimetype?: string }> {
  const url = `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${instance}`;
  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY!,
    },
    body: JSON.stringify({ message: { key: messageKey }, convertToMp4: false }),
  });
  if (!res.ok) throw new Error(`Evolution media fetch failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  // Evolution returns { base64: "...", mimetype: "..." } or sometimes plain string
  if (typeof json === "string") return { base64: json };
  return { base64: json.base64 || json.media || "", mimetype: json.mimetype };
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function transcribeAudio(base64: string, mimetype: string): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY missing");
  const bytes = base64ToBytes(base64);
  const ext = mimetype.includes("mp4") ? "m4a" : mimetype.includes("wav") ? "wav" : "ogg";
  const blob = new Blob([bytes], { type: mimetype || "audio/ogg" });
  const form = new FormData();
  form.append("file", blob, `audio.${ext}`);
  form.append("model", "whisper-large-v3");
  form.append("language", "es");
  form.append("response_format", "json");

  const res = await fetchWithTimeout("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Groq Whisper failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return (j.text || "").trim();
}

async function describeImage(base64: string, mimetype: string, caption: string): Promise<string> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  const dataUrl = `data:${mimetype || "image/jpeg"};base64,${base64.replace(/^data:[^;]+;base64,/, "")}`;
  const userText = caption
    ? `Describe esta imagen en 1-2 frases y extrae cualquier texto visible (OCR). El usuario añadió este pie de foto: "${caption}".`
    : `Describe esta imagen en 1-2 frases y extrae cualquier texto visible (OCR).`;

  const res = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Vision failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content || "").trim();
}

async function extractPdfText(base64: string, fileName: string): Promise<string> {
  // Use Gemini Vision via Lovable Gateway for PDF (multimodal supports PDFs as inline_data)
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  const dataUrl = `data:application/pdf;base64,${base64.replace(/^data:[^;]+;base64,/, "")}`;
  const res = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extrae el texto principal y un resumen de 2-4 frases de este PDF llamado "${fileName}". Responde en formato: "RESUMEN: ...\nTEXTO: ...".`,
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`PDF extract failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content || "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let messageId = "";
  try {
    const body = await req.json();
    messageId = body.messageId;
    const { instance, messageKey, mediaKind, mimeType, fileName, caption } = body;

    if (!messageId || !mediaKind || !messageKey) {
      return new Response(JSON.stringify({ ok: false, error: "missing_params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error("Evolution API not configured");
    }

    console.log(`[process-whatsapp-media] ${mediaKind} for message ${messageId}`);

    // 1. Fetch base64 from Evolution
    const { base64, mimetype: realMime } = await getMediaBase64(instance, messageKey);
    if (!base64) throw new Error("empty_base64");

    // Size guard
    const approxBytes = Math.floor((base64.length * 3) / 4);
    if (approxBytes > MAX_BASE64_BYTES) {
      await supabase
        .from("contact_messages")
        .update({ content: `[⚠️ ${mediaKind} demasiado grande para procesar]` })
        .eq("id", messageId);
      return new Response(JSON.stringify({ ok: true, skipped: "too_large" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mt = realMime || mimeType || "";
    let finalContent = "";

    if (mediaKind === "audio") {
      const text = await transcribeAudio(base64, mt);
      finalContent = text ? `[🎙️ Audio] ${text}` : "[🎙️ Audio sin contenido reconocible]";
    } else if (mediaKind === "image") {
      const desc = await describeImage(base64, mt, caption || "");
      finalContent = `[🖼️ Imagen] ${desc}`;
    } else if (mediaKind === "document") {
      if (mt.includes("pdf") || (fileName || "").toLowerCase().endsWith(".pdf")) {
        const text = await extractPdfText(base64, fileName || "documento.pdf");
        finalContent = `[📎 PDF: ${fileName || "documento"}]\n${text}`;
      } else {
        finalContent = `[📎 Documento: ${fileName || "archivo"}${caption ? ` — ${caption}` : ""}]`;
      }
    } else {
      finalContent = `[${mediaKind} recibido]`;
    }

    // Truncate to a safe size for the column
    if (finalContent.length > 12000) finalContent = finalContent.slice(0, 12000) + "…";

    const { error: updErr } = await supabase
      .from("contact_messages")
      .update({ content: finalContent })
      .eq("id", messageId);
    if (updErr) console.error("[process-whatsapp-media] update failed:", updErr);

    console.log(`[process-whatsapp-media] OK ${mediaKind} → ${finalContent.slice(0, 80)}`);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[process-whatsapp-media] error:", err);
    if (messageId) {
      await supabase
        .from("contact_messages")
        .update({ content: `[⚠️ Multimedia no procesable: ${err instanceof Error ? err.message.slice(0, 100) : "error"}]` })
        .eq("id", messageId)
        .catch(() => {});
    }
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

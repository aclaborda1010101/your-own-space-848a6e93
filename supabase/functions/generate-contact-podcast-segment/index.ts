// generate-contact-podcast-segment
// Generates ONE incremental podcast segment of 100 messages for a contact.
// Format: 'narrator' (OpenAI TTS, voice "nova") OR 'dialogue' (ElevenLabs, Sarah + Brian).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SEGMENT_SIZE = 100;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

// ElevenLabs voices (Sarah + Brian)
const VOICE_A = "EXAVITQu4vr4xnSDxMaL"; // Sarah
const VOICE_B = "nPczCjzI2devNBz1zQrb"; // Brian

interface RequestBody {
  contactId: string;
  userId?: string;
  format?: "narrator" | "dialogue";
  force_full_regenerate?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = (await req.json()) as RequestBody;
    const { contactId, force_full_regenerate = false } = body;
    let { userId, format } = body;

    if (!contactId) {
      return jsonResp({ error: "contactId required" }, 400);
    }

    // Resolve user from auth header if not provided
    if (!userId) {
      const auth = req.headers.get("Authorization") || "";
      if (auth.startsWith("Bearer ")) {
        const { data } = await supabase.auth.getUser(auth.slice(7));
        userId = data.user?.id;
      }
    }
    if (!userId) {
      // Look up contact owner
      const { data: c } = await supabase
        .from("people_contacts")
        .select("user_id")
        .eq("id", contactId)
        .maybeSingle();
      userId = c?.user_id;
    }
    if (!userId) return jsonResp({ error: "no user" }, 400);

    // Load or create podcast row
    let { data: podcast } = await supabase
      .from("contact_podcasts")
      .select("*")
      .eq("contact_id", contactId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!podcast) {
      const { data: created, error } = await supabase
        .from("contact_podcasts")
        .insert({
          contact_id: contactId,
          user_id: userId,
          format: format || "narrator",
          status: "idle",
        })
        .select("*")
        .single();
      if (error) throw error;
      podcast = created;
    }

    const effectiveFormat = (format || podcast.format || "narrator") as
      | "narrator"
      | "dialogue";

    // Force full regeneration: wipe segments + storage, reset counters
    if (force_full_regenerate && podcast.total_segments > 0) {
      const { data: oldSegs } = await supabase
        .from("contact_podcast_segments")
        .select("audio_storage_path")
        .eq("podcast_id", podcast.id);
      if (oldSegs && oldSegs.length) {
        const paths = oldSegs.map((s) => s.audio_storage_path);
        await supabase.storage.from("contact-podcasts").remove(paths);
      }
      await supabase
        .from("contact_podcast_segments")
        .delete()
        .eq("podcast_id", podcast.id);
      await supabase
        .from("contact_podcasts")
        .update({
          total_segments: 0,
          last_message_count: 0,
          total_duration_seconds: 0,
          status: "idle",
          format: effectiveFormat,
        })
        .eq("id", podcast.id);
      podcast.total_segments = 0;
      podcast.last_message_count = 0;
      podcast.total_duration_seconds = 0;
    }

    // Count current total messages
    const { count: totalMessages } = await supabase
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", contactId)
      .eq("user_id", userId);

    const total = totalMessages || 0;
    const last = podcast.last_message_count || 0;
    const delta = total - last;

    // First segment requires >= 100 msgs total
    if (podcast.total_segments === 0 && total < SEGMENT_SIZE) {
      await supabase
        .from("contact_podcasts")
        .update({ status: "idle" })
        .eq("id", podcast.id);
      return jsonResp({
        ok: true,
        skipped: "not_enough_messages",
        total,
      });
    }
    // Subsequent segments require delta >= 100
    if (podcast.total_segments > 0 && delta < SEGMENT_SIZE) {
      return jsonResp({
        ok: true,
        skipped: "no_new_segment_needed",
        total,
        last,
      });
    }

    // Mark generating
    await supabase
      .from("contact_podcasts")
      .update({
        status: "generating",
        format: effectiveFormat,
        error_message: null,
      })
      .eq("id", podcast.id);

    // Range: load messages [last+1 .. last+SEGMENT_SIZE] (1-indexed)
    // Order chronologically and offset.
    const startIdx = last + 1;
    const endIdx = last + SEGMENT_SIZE;

    const { data: msgs } = await supabase
      .from("contact_messages")
      .select("direction, sender, content, message_date")
      .eq("contact_id", contactId)
      .eq("user_id", userId)
      .order("message_date", { ascending: true })
      .range(last, endIdx - 1); // range is inclusive [from..to], 0-indexed

    if (!msgs || msgs.length === 0) {
      await supabase
        .from("contact_podcasts")
        .update({ status: "idle" })
        .eq("id", podcast.id);
      return jsonResp({ ok: true, skipped: "no_messages_in_range" });
    }

    // Get contact + owner names
    const { data: contact } = await supabase
      .from("people_contacts")
      .select("name")
      .eq("id", contactId)
      .maybeSingle();
    const contactName = contact?.name || "tu contacto";
    const ownerName = "tú";

    // Accumulated summary from previous segments (last 2 scripts truncated)
    let accumulated = "";
    if (podcast.total_segments > 0) {
      const { data: prev } = await supabase
        .from("contact_podcast_segments")
        .select("script, segment_number")
        .eq("podcast_id", podcast.id)
        .order("segment_number", { ascending: false })
        .limit(2);
      if (prev) {
        accumulated = prev
          .reverse()
          .map(
            (p) =>
              `--- Segmento ${p.segment_number} (resumen) ---\n${p.script.slice(0, 800)}`,
          )
          .join("\n\n");
      }
    }

    // Build messages text (limit to ~30k chars)
    const messagesText = msgs
      .map((m) => {
        const who =
          m.direction === "outgoing" ? ownerName : (m.sender || contactName);
        return `${who}: ${m.content}`;
      })
      .join("\n")
      .slice(0, 30000);

    // ============================
    // Generate script via Lovable AI
    // ============================
    const segmentNumber = podcast.total_segments + 1;
    const script = await generateScript({
      format: effectiveFormat,
      ownerName,
      contactName,
      accumulated,
      messagesText,
      messagesCount: msgs.length,
      segmentNumber,
    });

    // ============================
    // TTS
    // ============================
    let mp3Buffer: Uint8Array;
    let durationEstimate = 0;
    if (effectiveFormat === "narrator") {
      if (!OPENAI_API_KEY) {
        await markError(supabase, podcast.id, "OPENAI_API_KEY missing");
        return jsonResp({ error: "OPENAI_API_KEY missing" }, 500);
      }
      mp3Buffer = await openaiTTS(script);
      durationEstimate = Math.round(script.split(/\s+/).length / 2.5); // ~150 wpm
    } else {
      if (!ELEVENLABS_API_KEY) {
        await markError(supabase, podcast.id, "ELEVENLABS_API_KEY missing");
        return jsonResp({ error: "ELEVENLABS_API_KEY missing" }, 500);
      }
      mp3Buffer = await elevenLabsDialogueTTS(script);
      durationEstimate = Math.round(script.split(/\s+/).length / 2.3);
    }

    // ============================
    // Upload to Storage
    // ============================
    const path = `${userId}/${contactId}/segment-${segmentNumber}.mp3`;
    const { error: upErr } = await supabase.storage
      .from("contact-podcasts")
      .upload(path, mp3Buffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    if (upErr) {
      await markError(supabase, podcast.id, `storage upload: ${upErr.message}`);
      return jsonResp({ error: upErr.message }, 500);
    }

    // ============================
    // Insert segment + update podcast
    // ============================
    const { error: insErr } = await supabase
      .from("contact_podcast_segments")
      .insert({
        podcast_id: podcast.id,
        segment_number: segmentNumber,
        message_range_start: startIdx,
        message_range_end: last + msgs.length,
        message_count: msgs.length,
        format: effectiveFormat,
        script,
        audio_storage_path: path,
        duration_seconds: durationEstimate,
      });
    if (insErr) {
      await markError(supabase, podcast.id, `insert segment: ${insErr.message}`);
      return jsonResp({ error: insErr.message }, 500);
    }

    await supabase
      .from("contact_podcasts")
      .update({
        status: "ready",
        total_segments: segmentNumber,
        last_message_count: last + msgs.length,
        total_duration_seconds:
          (podcast.total_duration_seconds || 0) + durationEstimate,
        last_generated_at: new Date().toISOString(),
        format: effectiveFormat,
      })
      .eq("id", podcast.id);

    return jsonResp({
      ok: true,
      podcast_id: podcast.id,
      segment_number: segmentNumber,
      duration: durationEstimate,
      messages_covered: msgs.length,
    });
  } catch (err) {
    console.error("generate-contact-podcast-segment error:", err);
    return jsonResp({ error: String(err) }, 500);
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function markError(
  supabase: ReturnType<typeof createClient>,
  podcastId: string,
  msg: string,
) {
  await supabase
    .from("contact_podcasts")
    .update({ status: "error", error_message: msg.slice(0, 500) })
    .eq("id", podcastId);
}

async function generateScript(params: {
  format: "narrator" | "dialogue";
  ownerName: string;
  contactName: string;
  accumulated: string;
  messagesText: string;
  messagesCount: number;
  segmentNumber: number;
}) {
  const {
    format,
    ownerName,
    contactName,
    accumulated,
    messagesText,
    messagesCount,
    segmentNumber,
  } = params;

  const systemPrompt =
    format === "narrator"
      ? `Eres un biógrafo íntimo escribiendo un brief de audio (~500 palabras) sobre la relación entre ${ownerName} y ${contactName}. Tono cálido, observador, en español. NO uses fórmulas tipo "en este episodio". Habla como si resumieras esta relación al oyente.`
      : `Eres dos presentadores estilo NotebookLM (Locutor A enérgico, Locutor B reflexivo) que conversan en español sobre la relación entre ${ownerName} y ${contactName}. Formato OBLIGATORIO: cada línea empieza con "A: " o "B: ". Diálogo natural, alternando observaciones y preguntas, citas breves, ~900 palabras. NO menciones "podcast" ni "episodio".`;

  const userPrompt = `Contexto previo (segmentos anteriores ya narrados):
${accumulated || "(este es el primer segmento, no hay contexto previo)"}

Mensajes nuevos (${messagesCount} mensajes) que debes narrar AHORA. NO repitas contenido del contexto previo:
${messagesText}

Escribe el guion del segmento ${segmentNumber}. ${
    format === "narrator"
      ? "Incluye: 1 titular de apertura, 2-3 momentos concretos, 1 observación de evolución, 1 cierre con qué vigilar."
      : 'Diálogo de 5-7 minutos. Termina con una pregunta abierta de B.'
  }`;

  const resp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    },
  );
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway error ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  const script = data.choices?.[0]?.message?.content?.trim() || "";
  if (!script) throw new Error("AI returned empty script");
  return script;
}

async function openaiTTS(text: string): Promise<Uint8Array> {
  // Trim to OpenAI TTS limit (~4096 chars)
  const safeText = text.slice(0, 4000);
  const resp = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: "nova",
      input: safeText,
      response_format: "mp3",
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenAI TTS error ${resp.status}: ${t.slice(0, 300)}`);
  }
  const buf = new Uint8Array(await resp.arrayBuffer());
  return buf;
}

async function elevenLabsDialogueTTS(script: string): Promise<Uint8Array> {
  // Parse "A: ..." / "B: ..." lines and synthesize each with corresponding voice,
  // then concatenate raw MP3 bytes.
  const lines = script
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[AB]\s*:/i.test(l));
  if (lines.length === 0) {
    // Fallback: single voice
    return await elevenLabsSingle(script.slice(0, 2500), VOICE_A);
  }
  const chunks: Uint8Array[] = [];
  for (const line of lines) {
    const isA = /^A\s*:/i.test(line);
    const text = line.replace(/^[AB]\s*:\s*/i, "").trim();
    if (!text) continue;
    const buf = await elevenLabsSingle(text.slice(0, 1500), isA ? VOICE_A : VOICE_B);
    chunks.push(buf);
  }
  // Concat
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function elevenLabsSingle(
  text: string,
  voiceId: string,
): Promise<Uint8Array> {
  const resp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.4,
          use_speaker_boost: true,
        },
      }),
    },
  );
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`ElevenLabs error ${resp.status}: ${t.slice(0, 200)}`);
  }
  return new Uint8Array(await resp.arrayBuffer());
}

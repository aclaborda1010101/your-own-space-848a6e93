// generate-contact-podcast-segment
// On-demand: produces ONE single audio summarizing the WHOLE relationship
// with a contact. Three formats:
//  - "informative": telediario-style brief (informative news bulletin)
//  - "narrator":    intimate narrator (warm biographer)
//  - "dialogue":    two-voice NotebookLM-style conversation
// Output is always stored as segment_number=1 (upsert-style).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

// ElevenLabs voices (used only for dialogue)
const VOICE_A = "EXAVITQu4vr4xnSDxMaL"; // Sarah
const VOICE_B = "nPczCjzI2devNBz1zQrb"; // Brian

// Hierarchical summarization
const CHUNK_THRESHOLD = 500;
const CHUNK_SIZE = 200;

type Format = "informative" | "narrator" | "dialogue";

interface RequestBody {
  contactId: string;
  userId?: string;
  format?: Format;
  force_full_regenerate?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = (await req.json()) as RequestBody;
    const { contactId } = body;
    let { userId, format } = body;

    if (!contactId) return jsonResp({ error: "contactId required" }, 400);

    if (!userId) {
      const auth = req.headers.get("Authorization") || "";
      if (auth.startsWith("Bearer ")) {
        const { data } = await supabase.auth.getUser(auth.slice(7));
        userId = data.user?.id;
      }
    }
    if (!userId) {
      const { data: c } = await supabase
        .from("people_contacts")
        .select("user_id")
        .eq("id", contactId)
        .maybeSingle();
      userId = c?.user_id;
    }
    if (!userId) return jsonResp({ error: "no user" }, 400);

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
          format: format || "informative",
          status: "idle",
        })
        .select("*")
        .single();
      if (error) throw error;
      podcast = created;
    }

    const effectiveFormat = (format || podcast.format || "informative") as Format;

    await supabase
      .from("contact_podcasts")
      .update({
        status: "generating",
        format: effectiveFormat,
        error_message: null,
      })
      .eq("id", podcast.id);

    const { data: msgs } = await supabase
      .from("contact_messages")
      .select("direction, sender, content, message_date")
      .eq("contact_id", contactId)
      .eq("user_id", userId)
      .order("message_date", { ascending: true })
      .limit(5000);

    if (!msgs || msgs.length === 0) {
      await supabase
        .from("contact_podcasts")
        .update({ status: "idle" })
        .eq("id", podcast.id);
      return jsonResp({ ok: true, skipped: "no_messages" });
    }

    const { data: contact } = await supabase
      .from("people_contacts")
      .select("name, personality_profile")
      .eq("id", contactId)
      .maybeSingle();
    const contactName = contact?.name || "tu contacto";
    const ownerName = "tú";

    // Build digest
    let globalDigest: string;
    if (msgs.length <= CHUNK_THRESHOLD) {
      globalDigest = msgs
        .map((m) => {
          const who = m.direction === "outgoing" ? ownerName : (m.sender || contactName);
          return `${who}: ${m.content}`;
        })
        .join("\n")
        .slice(0, 60000);
    } else {
      const chunks: typeof msgs[] = [];
      for (let i = 0; i < msgs.length; i += CHUNK_SIZE) {
        chunks.push(msgs.slice(i, i + CHUNK_SIZE));
      }
      console.log(`[podcast] Hierarchical: ${chunks.length} chunks (${msgs.length} msgs)`);
      const miniSummaries: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i]
          .map((m) => {
            const who = m.direction === "outgoing" ? ownerName : (m.sender || contactName);
            return `${who}: ${m.content}`;
          })
          .join("\n")
          .slice(0, 20000);
        const firstDate = chunks[i][0].message_date?.slice(0, 10) || "";
        const lastDate = chunks[i][chunks[i].length - 1].message_date?.slice(0, 10) || "";
        const summary = await summarizeChunk({
          chunkText,
          ownerName,
          contactName,
          chunkIndex: i + 1,
          totalChunks: chunks.length,
          dateRange: `${firstDate} → ${lastDate}`,
        });
        miniSummaries.push(`--- Periodo ${i + 1} (${firstDate} → ${lastDate}) ---\n${summary}`);
      }
      globalDigest = miniSummaries.join("\n\n").slice(0, 60000);
    }

    // Optionally enrich with personality_profile facts
    const profileSnapshot = stringifyProfile(contact?.personality_profile);

    const script = await generateScript({
      format: effectiveFormat,
      ownerName,
      contactName,
      digest: globalDigest,
      profileSnapshot,
      totalMessages: msgs.length,
    });

    let mp3Buffer: Uint8Array;
    let durationEstimate = 0;
    if (effectiveFormat === "dialogue") {
      if (!ELEVENLABS_API_KEY) {
        await markError(supabase, podcast.id, "ELEVENLABS_API_KEY missing");
        return jsonResp({ error: "ELEVENLABS_API_KEY missing" }, 500);
      }
      mp3Buffer = await elevenLabsDialogueTTS(script);
      durationEstimate = Math.round(script.split(/\s+/).length / 2.3);
    } else {
      // informative + narrator both use OpenAI TTS (different voice)
      if (!OPENAI_API_KEY) {
        await markError(supabase, podcast.id, "OPENAI_API_KEY missing");
        return jsonResp({ error: "OPENAI_API_KEY missing" }, 500);
      }
      const voice = effectiveFormat === "informative" ? "onyx" : "nova";
      mp3Buffer = await openaiTTS(script, voice);
      durationEstimate = Math.round(script.split(/\s+/).length / 2.5);
    }

    // Wipe previous segments and store new
    const { data: oldSegs } = await supabase
      .from("contact_podcast_segments")
      .select("audio_storage_path")
      .eq("podcast_id", podcast.id);
    if (oldSegs && oldSegs.length) {
      const paths = oldSegs.map((s) => s.audio_storage_path);
      await supabase.storage.from("contact-podcasts").remove(paths);
      await supabase.from("contact_podcast_segments").delete().eq("podcast_id", podcast.id);
    }

    const path = `${userId}/${contactId}/relationship-${Date.now()}.mp3`;
    const { error: upErr } = await supabase.storage
      .from("contact-podcasts")
      .upload(path, mp3Buffer, { contentType: "audio/mpeg", upsert: true });
    if (upErr) {
      await markError(supabase, podcast.id, `storage upload: ${upErr.message}`);
      return jsonResp({ error: upErr.message }, 500);
    }

    const { error: insErr } = await supabase
      .from("contact_podcast_segments")
      .insert({
        podcast_id: podcast.id,
        segment_number: 1,
        message_range_start: 1,
        message_range_end: msgs.length,
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
        total_segments: 1,
        last_message_count: msgs.length,
        total_duration_seconds: durationEstimate,
        last_generated_at: new Date().toISOString(),
        format: effectiveFormat,
      })
      .eq("id", podcast.id);

    return jsonResp({
      ok: true,
      podcast_id: podcast.id,
      duration: durationEstimate,
      messages_covered: msgs.length,
      format: effectiveFormat,
    });
  } catch (err) {
    console.error("generate-contact-podcast-segment error:", err);
    return jsonResp({ error: String(err) }, 500);
  }
});

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function markError(supabase: any, podcastId: string, msg: string) {
  await supabase
    .from("contact_podcasts")
    .update({ status: "error", error_message: msg.slice(0, 500) })
    .eq("id", podcastId);
}

function stringifyProfile(profile: unknown): string {
  if (!profile || typeof profile !== "object") return "";
  try {
    const flat = JSON.stringify(profile);
    return flat.slice(0, 4000);
  } catch {
    return "";
  }
}

async function summarizeChunk(params: {
  chunkText: string;
  ownerName: string;
  contactName: string;
  chunkIndex: number;
  totalChunks: number;
  dateRange: string;
}): Promise<string> {
  const { chunkText, ownerName, contactName, dateRange } = params;
  const prompt = `Resume en español los mensajes intercambiados entre ${ownerName} y ${contactName} (periodo ${dateRange}).
Devuelve 6-10 bullets densos: temas, decisiones, momentos emocionales, asuntos pendientes, tono. NO inventes.

MENSAJES:
${chunkText}`;
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway (chunk) error ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function generateScript(params: {
  format: Format;
  ownerName: string;
  contactName: string;
  digest: string;
  profileSnapshot: string;
  totalMessages: number;
}) {
  const { format, ownerName, contactName, digest, profileSnapshot, totalMessages } = params;

  let systemPrompt = "";
  let structureHint = "";

  if (format === "informative") {
    systemPrompt = `Eres un presentador de boletín informativo (estilo telediario) en español. Tu única misión: dar al oyente, en 3-4 minutos, un parte FACTUAL y útil sobre el estado actual de la relación entre ${ownerName} y ${contactName}. Tono profesional, directo, sin adornos literarios. NUNCA digas "podcast" ni "episodio". Habla como un informador serio.`;
    structureHint = `Estructura OBLIGATORIA:
1. Titular de apertura (1 frase): titular del estado actual de la relación.
2. Datos clave: nº de mensajes, frecuencia, último contacto, ámbito (profesional/personal/familiar).
3. Asuntos pendientes (lo que está sin resolver, quién mueve ficha, fechas).
4. Alertas y riesgos (si los hay).
5. Próxima acción recomendada.
6. Cierre: 1 frase con la conclusión accionable.
~500 palabras. Sin metáforas, sin frases largas. Datos > emociones.`;
  } else if (format === "narrator") {
    systemPrompt = `Eres un biógrafo íntimo en español escribiendo un brief de audio (~600 palabras) sobre TODA la relación entre ${ownerName} y ${contactName}. Tono cálido, observador, narrativo. NO uses fórmulas tipo "en este episodio" ni "podcast". Cuenta cómo es esta relación, qué ha pasado, qué destaca, qué vigilar.`;
    structureHint = `Estructura: titular de apertura, contexto general, 3-4 momentos concretos a lo largo del tiempo, evolución del tono, asuntos pendientes, cierre con qué vigilar.`;
  } else {
    systemPrompt = `Eres dos presentadores estilo NotebookLM (Locutor A enérgico, Locutor B reflexivo) que conversan en español sobre TODA la relación entre ${ownerName} y ${contactName}. Formato OBLIGATORIO: cada línea empieza con "A: " o "B: ". Diálogo natural alternando observaciones, citas breves y preguntas, ~1000 palabras. NO menciones "podcast" ni "episodio".`;
    structureHint = `Diálogo de 6-8 minutos. Empieza A presentando la relación, alternad observaciones, citad momentos concretos, terminad con una pregunta abierta de B sobre el futuro.`;
  }

  const userPrompt = `Resumen completo de la relación (${totalMessages} mensajes intercambiados):

${digest}

${profileSnapshot ? `\n\nDatos estructurados conocidos del contacto (perfil):\n${profileSnapshot}\n` : ""}

Escribe ahora el guion. ${structureHint}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway error ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  const script = data.choices?.[0]?.message?.content?.trim() || "";
  if (!script) throw new Error("AI returned empty script");
  return script;
}

async function openaiTTS(text: string, voice: string): Promise<Uint8Array> {
  const safeText = text.slice(0, 4000);
  const resp = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice,
      input: safeText,
      response_format: "mp3",
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenAI TTS error ${resp.status}: ${t.slice(0, 300)}`);
  }
  return new Uint8Array(await resp.arrayBuffer());
}

async function elevenLabsDialogueTTS(script: string): Promise<Uint8Array> {
  const lines = script
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[AB]\s*:/i.test(l));
  if (lines.length === 0) {
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
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function elevenLabsSingle(text: string, voiceId: string): Promise<Uint8Array> {
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

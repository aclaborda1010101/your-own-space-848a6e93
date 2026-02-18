import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

const SEGMENTATION_PROMPT = `Eres un analizador de transcripciones. Tu trabajo es detectar TODAS las conversaciones independientes dentro de un texto largo y separarlas.

REGLA PRINCIPAL: Si cambian las personas que hablan, es una conversación DIFERENTE.

Criterios para SEPARAR (basta con que se cumpla UNO):
- Cambio de interlocutores: si en un tramo hablan A y B, y luego hablan A y C, son DOS conversaciones
- Cambio de contexto: de una reunión de trabajo a una comida social, de una llamada a otra
- Saltos temporales grandes (timestamps que saltan más de 15-20 minutos)
- Cambio de lugar evidente (oficina -> restaurante -> casa)
- Llamadas telefónicas: cada llamada es un hilo independiente
- Cambio de idioma o registro (formal a informal, trabajo a familia)

Criterios para MANTENER JUNTOS (deben cumplirse TODOS):
- Mismas personas hablando del mismo tema sin interrupción
- Continuación natural de la misma reunión
- Sin cambio de lugar ni de contexto

IMPORTANTE: Es MUCHO mejor separar de más que de menos. En caso de duda, SEPARA.
Cada momento del día (una llamada, una comida, un rato con la familia, una reunión) debe ser un hilo independiente.

Para cada segmento, identifica SOLO las personas que realmente hablan o participan en ESE segmento.

FORMATO DE RESPUESTA CRÍTICO:
NO incluyas el texto completo de cada segmento. Solo devuelve MARCADORES de posición: las primeras 8-10 palabras y las últimas 8-10 palabras de cada segmento. El sistema cortará el texto programáticamente.

Devuelve un JSON con este formato:
{
  "segments": [
    {
      "segment_id": 1,
      "title": "Título descriptivo corto",
      "participants": ["Nombre1", "Nombre2"],
      "start_words": "Las primeras 8-10 palabras exactas del segmento tal como aparecen",
      "end_words": "Las últimas 8-10 palabras exactas del segmento tal como aparecen",
      "context_clue": "Qué indica el cambio (ej: cambio de participantes, cambio de lugar)"
    }
  ]
}

Si el texto es una ÚNICA conversación con las mismas personas y tema, devuelve un solo segmento.
Responde SOLO con JSON válido. Sin explicaciones ni markdown.`;

const EXTRACTION_PROMPT_BASE = `Eres el motor de procesamiento de JARVIS, un asistente personal de IA. Tu trabajo es analizar transcripciones de reuniones, conversaciones o notas y extraer información estructurada.

PRIMERO, determina si el contenido es una CONVERSACIÓN REAL del usuario o RUIDO AMBIENTAL:
- **RUIDO AMBIENTAL**: TV, radio, podcasts, series, películas, audiolibros, noticias de fondo, presentaciones ajenas, entrevistas donde el usuario NO participa, audio unidireccional sin interacción del usuario, patrones narrativos/ficticios, nombres de personajes ficticios, narración en tercera persona continua.
- **CONVERSACIÓN REAL**: El usuario habla activamente con alguien, o dicta notas propias.

Si es RUIDO AMBIENTAL, devuelve: { "is_ambient": true, "ambient_type": "tv|radio|podcast|audiobook|news|other", "brain": "personal", "title": "Descripción breve del contenido detectado", "summary": "Resumen de lo detectado como ruido", "tasks": [], "commitments": [], "speakers": [], "people": [], "follow_ups": [], "events": [], "ideas": [], "suggestions": [] }

Si es CONVERSACIÓN REAL (is_ambient: false), clasifica en uno de los "3 Cerebros":
- **professional**: Trabajo, proyectos, clientes, negocio, tecnología, carrera
- **personal**: Familia, amigos, salud, hobbies, viajes, planes personales  
- **bosco**: Todo relacionado con Bosco (hijo del usuario), crianza, actividades infantiles, colegio

**REGLA OBLIGATORIA**: Si entre los speakers (interlocutores que hablan) aparece "Juany" o "Bosco", el brain DEBE ser "bosco" sin excepción, independientemente del tema de la conversación.

Para cada transcripción, extrae:
1. **is_ambient**: false (ya determinado)
2. **brain**: El cerebro dominante (professional/personal/bosco)
3. **title**: Un título descriptivo corto (max 60 chars)
4. **summary**: Resumen ejecutivo de 2-3 frases
5. **tasks**: Tareas o acciones pendientes detectadas, con prioridad (high/medium/low)
6. **commitments**: Compromisos detectados (propios o de terceros), con persona y plazo si se menciona
7. **speakers**: SOLO las personas que HABLAN activamente en la conversación (los interlocutores reales).
   IMPORTANTE: Este campo es CRÍTICO. Debes devolver SIEMPRE al menos 1 speaker.
   NO incluyas personas mencionadas de pasada, ni "Speaker X", ni nombres que aparecen en noticias de fondo o televisión.
   Solo quienes PARTICIPAN hablando. Si solo detectas un interlocutor además del usuario, pon solo ese nombre.
   Ejemplo: si Agustín habla con Raúl y mencionan a 20 personas, speakers = ["Agustín", "Raúl"].
8. **people**: TODAS las personas mencionadas (incluidas las que no hablan pero se mencionan), con su relación, contexto, empresa y rol si se detectan
9. **follow_ups**: Temas que requieren seguimiento futuro
10. **events**: Citas o eventos mencionados con fecha si está disponible
11. **ideas**: Ideas de proyectos, negocios o iniciativas mencionadas. Para cada una: name (nombre corto), description (descripción breve), category (business/tech/personal/family/investment)
12. **suggestions**: Acciones sugeridas para el usuario. Cada una con: type (task/event/person/idea/follow_up), label (descripción corta legible), data (objeto con los datos relevantes para crear la entidad)
13. **sentiment**: Sentimiento general de la conversación: "positive", "neutral", "negative" o "mixed"

Responde SOLO con JSON válido. Sin explicaciones ni markdown.`;

function buildExtractionPrompt(userName: string | null, myIdentifiers: string[]): string {
  if (!userName && myIdentifiers.length === 0) return EXTRACTION_PROMPT_BASE;
  
  const names = userName ? [userName, ...myIdentifiers] : myIdentifiers;
  const uniqueNames = [...new Set(names.filter(Boolean))];
  
  const userContext = `\n\nCONTEXTO DEL USUARIO: El usuario se llama ${userName || uniqueNames[0]}. Sus identificadores son: ${uniqueNames.join(", ")}.
REGLA CRÍTICA: NUNCA incluyas al propio usuario en el array "people". Solo incluye a las OTRAS personas que NO son el usuario. El usuario es quien graba y participa, pero no es un "contacto" externo.
Si el título de la grabación contiene patrones como "llamada con X", "reunión con X", "café con X", entonces X es el interlocutor externo y el usuario es la otra persona.`;
  
  return EXTRACTION_PROMPT_BASE + userContext;
}

interface ExtractedData {
  is_ambient?: boolean;
  ambient_type?: string;
  brain: "professional" | "personal" | "bosco";
  title: string;
  summary: string;
  tasks: Array<{ title: string; priority: string; brain: string }>;
  commitments: Array<{ description: string; type: string; person_name?: string; deadline?: string }>;
  speakers?: string[];
  people: Array<{ name: string; relationship?: string; brain?: string; context?: string; company?: string; role?: string }>;
  follow_ups: Array<{ topic: string; resolve_by?: string }>;
  events: Array<{ title: string; date?: string }>;
  ideas: Array<{ name: string; description: string; category?: string }>;
  suggestions: Array<{ type: string; label: string; data: Record<string, unknown> }>;
  sentiment?: "positive" | "neutral" | "negative" | "mixed";
}

interface SegmentMarker {
  segment_id: number;
  title: string;
  participants: string[];
  start_words: string;
  end_words: string;
  context_clue: string;
}

interface Segment {
  segment_id: number;
  title: string;
  participants: string[];
  text: string;
  context_clue: string;
}

// ── Helpers ──

function parseJsonResponse(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return JSON.parse(cleaned.trim());
}

async function callGemini(systemPrompt: string, userMessage: string, retries = 3): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_AI_API_KEY}`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (res.ok) {
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    const errText = await res.text();
    console.error(`[callGemini] Attempt ${attempt + 1}/${retries} failed: ${res.status}`, errText.substring(0, 300));

    // Retry on rate limit (429) or server errors (500+), not on client errors
    if (res.status === 429 || res.status >= 500) {
      const delay = Math.pow(2, attempt + 1) * 1000 + Math.random() * 1000;
      console.log(`[callGemini] Retrying in ${Math.round(delay)}ms...`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    // Non-retryable error
    throw new Error(`Gemini API error (${res.status}): ${errText.substring(0, 200)}`);
  }

  throw new Error("Gemini API error: max retries exceeded");
}

/**
 * Find text between start_words and end_words markers in the source text.
 * Uses fuzzy matching: normalizes whitespace and lowercases for comparison.
 */
function sliceTextByMarkers(sourceText: string, startWords: string, endWords: string): string | null {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedSource = normalize(sourceText);
  const normalizedStart = normalize(startWords);
  const normalizedEnd = normalize(endWords);

  const startIdx = normalizedSource.indexOf(normalizedStart);
  if (startIdx === -1) return null;

  // Find end_words AFTER start position
  const endSearchFrom = startIdx + normalizedStart.length;
  const endIdx = normalizedSource.indexOf(normalizedEnd, endSearchFrom);
  if (endIdx === -1) {
    // If end not found, take from start to end of text
    return sourceText.substring(startIdx).trim();
  }

  return sourceText.substring(startIdx, endIdx + endWords.length).trim();
}

/**
 * Convert marker-based segments from Gemini into text segments by slicing the original text.
 */
function resolveMarkers(markers: SegmentMarker[], blockText: string): Segment[] {
  const segments: Segment[] = [];

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    let segmentText: string | null = null;

    // Try slicing by start_words -> end_words
    if (marker.start_words && marker.end_words) {
      segmentText = sliceTextByMarkers(blockText, marker.start_words, marker.end_words);
    }

    // Fallback: slice from this start_words to next segment's start_words
    if (!segmentText && marker.start_words) {
      const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const normalizedSource = normalize(blockText);
      const startIdx = normalizedSource.indexOf(normalize(marker.start_words));
      if (startIdx !== -1) {
        if (i + 1 < markers.length && markers[i + 1].start_words) {
          const nextStartIdx = normalizedSource.indexOf(normalize(markers[i + 1].start_words), startIdx + 1);
          if (nextStartIdx !== -1) {
            segmentText = blockText.substring(startIdx, nextStartIdx).trim();
          }
        }
        if (!segmentText) {
          segmentText = blockText.substring(startIdx).trim();
        }
      }
    }

    // Ultimate fallback for single-segment blocks
    if (!segmentText && markers.length === 1) {
      segmentText = blockText;
    }

    if (segmentText && segmentText.length > 20) {
      segments.push({
        segment_id: marker.segment_id,
        title: marker.title,
        participants: marker.participants || [],
        text: segmentText,
        context_clue: marker.context_clue || "",
      });
    }
  }

  // If no segments resolved, return the whole block as one
  if (segments.length === 0) {
    return [{ segment_id: 1, title: "", participants: [], text: blockText, context_clue: "fallback" }];
  }

  return segments;
}

async function segmentText(text: string): Promise<Segment[]> {
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 200) return [{ segment_id: 1, title: "", participants: [], text, context_clue: "single" }];

  // Para textos muy largos, dividir en bloques antes de segmentar
  const MAX_WORDS_PER_BLOCK = 6000;
  if (wordCount > MAX_WORDS_PER_BLOCK) {
    console.log(`[process-transcription] Text too long (${wordCount} words), splitting into blocks of ${MAX_WORDS_PER_BLOCK}`);
    const words = text.split(/\s+/);
    const blocks: string[] = [];
    for (let i = 0; i < words.length; i += MAX_WORDS_PER_BLOCK) {
      blocks.push(words.slice(i, i + MAX_WORDS_PER_BLOCK).join(" "));
    }
    console.log(`[process-transcription] Created ${blocks.length} blocks`);

    const allSegments: Segment[] = [];
    let segId = 1;
    for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
      const block = blocks[blockIdx];
      console.log(`[process-transcription] Segmenting block ${blockIdx + 1}/${blocks.length}...`);
      try {
        const raw = await callGemini(SEGMENTATION_PROMPT, `Analiza y segmenta esta transcripción (bloque ${blockIdx + 1} de ${blocks.length}):\n\n${block}`);
        console.log(`[process-transcription] Block ${blockIdx + 1} raw response length: ${raw.length} chars`);
        const parsed = parseJsonResponse(raw) as { segments: SegmentMarker[] };
        if (parsed.segments?.length) {
          console.log(`[process-transcription] Block ${blockIdx + 1} returned ${parsed.segments.length} marker(s)`);
          const resolved = resolveMarkers(parsed.segments, block);
          for (const seg of resolved) {
            seg.segment_id = segId++;
            allSegments.push(seg);
          }
          console.log(`[process-transcription] Block ${blockIdx + 1} resolved to ${resolved.length} segment(s)`);
        } else {
          allSegments.push({ segment_id: segId++, title: `Bloque ${blockIdx + 1}`, participants: [], text: block, context_clue: "block" });
        }
      } catch (blockError) {
        console.error(`[process-transcription] Error segmenting block ${blockIdx + 1}:`, blockError);
        allSegments.push({ segment_id: segId++, title: `Bloque ${blockIdx + 1}`, participants: [], text: block, context_clue: "block-error" });
      }
    }
    console.log(`[process-transcription] Total segments from all blocks: ${allSegments.length}`);
    return allSegments;
  }

  // Texto normal (<6000 palabras) - also uses markers
  const raw = await callGemini(SEGMENTATION_PROMPT, `Analiza y segmenta esta transcripción:\n\n${text}`);
  try {
    const parsed = parseJsonResponse(raw) as { segments: SegmentMarker[] };
    if (parsed.segments?.length) {
      return resolveMarkers(parsed.segments, text);
    }
  } catch (e) {
    console.error("[process-transcription] Error parsing segmentation response:", e);
  }
  return [{ segment_id: 1, title: "", participants: [], text, context_clue: "single" }];
}

async function extractFromText(text: string, segmentHint?: { title: string; participants: string[] }, userContext?: { userName: string | null; myIdentifiers: string[] }): Promise<ExtractedData> {
  let userMsg = `Analiza esta transcripción:\n\n${text}`;
  if (segmentHint?.participants?.length) {
    userMsg = `[CONTEXTO: Este segmento trata sobre "${segmentHint.title}". Los participantes detectados son: ${segmentHint.participants.join(", ")}. Solo incluye en "people" a quienes participan en ESTE fragmento, no a otras personas de otras conversaciones.]\n\n${userMsg}`;
  }
  const prompt = userContext 
    ? buildExtractionPrompt(userContext.userName, userContext.myIdentifiers)
    : EXTRACTION_PROMPT_BASE;
  const raw = await callGemini(prompt, userMsg);
  const extracted = parseJsonResponse(raw) as ExtractedData;
  extracted.ideas = extracted.ideas || [];
  extracted.suggestions = extracted.suggestions || [];
  return extracted;
}

async function saveTranscriptionAndEntities(
  supabase: any,
  userId: string,
  source: string,
  rawText: string,
  extracted: ExtractedData,
  groupId: string | null,
  segmentParticipants?: string[],
) {
  // Sanitize brain to allowed values
  const allowedBrains = ["professional", "personal", "bosco"];
  let safeBrain = allowedBrains.includes(extracted.brain) ? extracted.brain : "personal";

  // Force family brain if Juany or Bosco appear in speakers, title, summary, or people
  const speakerNames = (extracted.speakers || []).map((s: string) => s.toLowerCase());
  const peopleNames = (extracted.people || []).map((p: any) => (p.name || "").toLowerCase());
  const titleAndSummary = `${extracted.title || ""} ${extracted.summary || ""}`.toLowerCase();
  const allTextToCheck = [...speakerNames, ...peopleNames, titleAndSummary];
  if (allTextToCheck.some((s: string) => s.includes("juany") || s.includes("bosco"))) {
    safeBrain = "bosco";
  }

  // Save transcription
  const isAmbient = extracted.is_ambient === true;
  const { data: transcription, error: txError } = await supabase
    .from("transcriptions")
    .insert({
      user_id: userId,
      source,
      raw_text: rawText,
      brain: safeBrain,
      title: extracted.title,
      summary: extracted.summary,
      sentiment: extracted.sentiment || null,
      entities_json: extracted,
      processed_at: new Date().toISOString(),
      group_id: groupId,
      is_ambient: isAmbient,
    })
    .select()
    .single();

  if (txError) {
    console.error("Error saving transcription:", txError);
    throw new Error("Error guardando transcripción");
  }

  // Skip entity extraction for ambient content
  if (isAmbient) {
    console.log(`[process-transcription] Ambient content detected (${extracted.ambient_type}), skipping entity extraction`);
    return { transcription, extracted };
  }

  // Save commitments
  if (extracted.commitments?.length) {
    const rows = extracted.commitments.map((c) => ({
      user_id: userId,
      description: c.description,
      commitment_type: c.type === "third_party" ? "third_party" : "own",
      person_name: c.person_name || null,
      deadline: c.deadline || null,
      source_transcription_id: transcription.id,
    }));
    await supabase.from("commitments").insert(rows);
  }

  // Save/update people contacts
  if (extracted.people?.length) {
    for (const person of extracted.people) {
      const { data: existing } = await supabase
        .from("people_contacts")
        .select("id, interaction_count")
        .eq("user_id", userId)
        .ilike("name", person.name)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("people_contacts")
          .update({
            interaction_count: (existing.interaction_count || 0) + 1,
            last_contact: new Date().toISOString(),
            context: person.context || undefined,
            company: person.company || undefined,
            role: person.role || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("people_contacts").insert({
          user_id: userId,
          name: person.name,
          relationship: person.relationship || null,
          brain: person.brain || extracted.brain,
          context: person.context || null,
          company: person.company || null,
          role: person.role || null,
          last_contact: new Date().toISOString(),
          interaction_count: 1,
        });
      }
    }
  }

  // Save follow-ups
  if (extracted.follow_ups?.length) {
    const rows = extracted.follow_ups.map((f) => ({
      user_id: userId,
      topic: f.topic,
      resolve_by: f.resolve_by || null,
      source_transcription_id: transcription.id,
    }));
    await supabase.from("follow_ups").insert(rows);
  }

  // Save ideas/projects
  if (extracted.ideas?.length) {
    for (const idea of extracted.ideas) {
      const { data: existingIdea } = await supabase
        .from("ideas_projects")
        .select("id, mention_count, notes, maturity_state")
        .eq("user_id", userId)
        .ilike("name", idea.name)
        .maybeSingle();

      if (existingIdea) {
        const newCount = (existingIdea.mention_count || 1) + 1;
        const existingNotes = Array.isArray(existingIdea.notes) ? existingIdea.notes : [];
        const updatedNotes = [...existingNotes, { text: idea.description, date: new Date().toISOString(), source: transcription.id }];
        await supabase
          .from("ideas_projects")
          .update({
            mention_count: newCount,
            notes: updatedNotes,
            maturity_state: newCount >= 3 && existingIdea.maturity_state === "seed" ? "exploring" : existingIdea.maturity_state,
          })
          .eq("id", existingIdea.id);
      } else {
        await supabase.from("ideas_projects").insert({
          user_id: userId,
          name: idea.name,
          description: idea.description,
          category: idea.category || null,
          origin: source === "manual" ? "manual" : source,
          source_transcription_id: transcription.id,
        });
      }
    }
  }

  // Save suggestions
  if (extracted.suggestions?.length) {
    const rows = extracted.suggestions.map((s) => ({
      user_id: userId,
      suggestion_type: s.type,
      content: { label: s.label, data: s.data },
      source_transcription_id: transcription.id,
    }));
    await supabase.from("suggestions").insert(rows);
  }

  // Insert tasks
  if (extracted.tasks?.length) {
    const rows = extracted.tasks.map((t) => ({
      user_id: userId,
      title: t.title,
      type: t.brain === "bosco" ? "life" : t.brain === "professional" ? "work" : "life",
      priority: t.priority === "high" ? "P1" : t.priority === "medium" ? "P2" : "P3",
      duration: 30,
      completed: false,
      source,
      description: `Extraída de: ${extracted.title}. ${extracted.summary}`,
      due_date: null,
    }));
    const { error: taskInsertError } = await supabase.from("tasks").insert(rows);
    if (taskInsertError) console.error("[process-transcription] Task insert error:", taskInsertError);
    else console.log(`[process-transcription] Inserted ${rows.length} tasks`);
  }

  // Generate embeddings
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (OPENAI_API_KEY) {
    try {
      // Priority: segmentParticipants > extracted.speakers > empty (NEVER use extracted.people)
      const embeddingPeople = segmentParticipants?.length
        ? segmentParticipants
        : (extracted.speakers?.length ? extracted.speakers : []);
      const chunks = [{ content: `${extracted.title}. ${extracted.summary}`, summary: extracted.summary, brain: extracted.brain, people: embeddingPeople }];
      const maxChunkLen = 1500;
      if (rawText.length > maxChunkLen) {
        const sentences = rawText.split(/(?<=[.!?])\s+/);
        let currentChunk = "";
        for (const sentence of sentences) {
          if ((currentChunk + " " + sentence).length > maxChunkLen && currentChunk.length > 100) {
            chunks.push({ content: currentChunk.trim(), summary: currentChunk.trim().substring(0, 200), brain: extracted.brain, people: embeddingPeople });
            currentChunk = sentence;
          } else {
            currentChunk += " " + sentence;
          }
        }
        if (currentChunk.trim().length > 50) {
          chunks.push({ content: currentChunk.trim(), summary: currentChunk.trim().substring(0, 200), brain: extracted.brain, people: embeddingPeople });
        }
      }

      const textsToEmbed = chunks.map(c => c.content);
      const embResponse = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "text-embedding-ada-002", input: textsToEmbed }),
      });

      if (embResponse.ok) {
        const embData = await embResponse.json();
        const embeddingRows = embData.data.map((emb: any, i: number) => ({
          user_id: userId, transcription_id: transcription.id, date: new Date().toISOString().split("T")[0],
          brain: chunks[i].brain, people: chunks[i].people, summary: chunks[i].summary, content: chunks[i].content,
          embedding: emb.embedding, metadata: { source, title: extracted.title },
        }));
        const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { error: embInsertError } = await adminClient.from("conversation_embeddings").insert(embeddingRows);
        if (embInsertError) console.error("[process-transcription] Embedding insert error:", embInsertError);
        else console.log(`[process-transcription] Saved ${embeddingRows.length} embeddings`);
      }
    } catch (embError) {
      console.error("[process-transcription] Embedding generation error:", embError);
    }
  }

  // Save interactions
  if (extracted.people?.length) {
    try {
      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      for (const person of extracted.people) {
        const { data: contact } = await adminClient.from("people_contacts").select("id").eq("user_id", userId).ilike("name", person.name).maybeSingle();
        if (contact) {
          await adminClient.from("interactions").insert({
            user_id: userId, contact_id: contact.id, date: new Date().toISOString().split("T")[0],
            channel: source === "plaud" ? "plaud" : source === "whatsapp" ? "whatsapp" : "manual",
            interaction_type: "conversation", summary: extracted.summary?.substring(0, 300), sentiment: null,
            commitments: extracted.commitments?.filter(c => c.person_name?.toLowerCase() === person.name.toLowerCase()).map(c => ({ description: c.description, deadline: c.deadline })) || [],
          });
        }
      }
    } catch (interactionError) {
      console.error("[process-transcription] Interaction save error:", interactionError);
    }
  }

  return { transcription, extracted };
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const { text: rawInputText, source = "manual", reprocess_transcription_id } = await req.json();

    // ── Reprocessing support ──
    let textToProcess = rawInputText;
    if (reprocess_transcription_id) {
      console.log(`[process-transcription] Reprocessing transcription: ${reprocess_transcription_id}`);
      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      
      const { data: original } = await adminClient
        .from("transcriptions")
        .select("raw_text, source, group_id")
        .eq("id", reprocess_transcription_id)
        .single();

      if (!original) {
        return new Response(JSON.stringify({ error: "Transcripción no encontrada" }), { status: 404, headers: corsHeaders });
      }

      // Delete related data
      await adminClient.from("conversation_embeddings").delete().eq("transcription_id", reprocess_transcription_id);
      await adminClient.from("commitments").delete().eq("source_transcription_id", reprocess_transcription_id);
      await adminClient.from("follow_ups").delete().eq("source_transcription_id", reprocess_transcription_id);
      await adminClient.from("suggestions").delete().eq("source_transcription_id", reprocess_transcription_id);
      await adminClient.from("transcriptions").delete().eq("id", reprocess_transcription_id);
      console.log(`[process-transcription] Deleted old data for ${reprocess_transcription_id}`);

      textToProcess = original.raw_text;
    }

    const text = textToProcess;
    if (!text || typeof text !== "string" || text.trim().length < 10) {
      return new Response(JSON.stringify({ error: "El texto es demasiado corto" }), { status: 400, headers: corsHeaders });
    }

    if (!GOOGLE_AI_API_KEY) {
      return new Response(JSON.stringify({ error: "GOOGLE_AI_API_KEY not configured" }), { status: 500, headers: corsHeaders });
    }

    // ── Load user profile for self-exclusion ──
    const adminClientForProfile = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userProfile } = await adminClientForProfile
      .from("user_profile")
      .select("name, my_identifiers")
      .eq("user_id", userId)
      .maybeSingle();

    const myNames = new Set<string>();
    if (userProfile?.name) myNames.add(userProfile.name.toLowerCase());
    const ids = (userProfile?.my_identifiers && typeof userProfile.my_identifiers === 'object' && !Array.isArray(userProfile.my_identifiers))
      ? userProfile.my_identifiers as Record<string, unknown>
      : {};
    for (const n of (Array.isArray(ids.whatsapp_names) ? ids.whatsapp_names : []) as string[]) myNames.add(n.toLowerCase());
    for (const n of (Array.isArray(ids.plaud_speaker_labels) ? ids.plaud_speaker_labels : []) as string[]) myNames.add(n.toLowerCase());

    const userContext = { userName: userProfile?.name || null, myIdentifiers: [...myNames] };
    console.log(`[process-transcription] Self-exclusion names: ${[...myNames].join(", ")}`);

    // ── Step 1: Segment ──
    console.log(`[process-transcription] Received ${text.split(/\s+/).length} words, segmenting...`);
    const segments = await segmentText(text);
    console.log(`[process-transcription] Detected ${segments.length} segment(s)`);

    // ── Step 2: Process each segment ──
    if (segments.length <= 1) {
      // Single segment – original behavior
      const extracted = await extractFromText(text, undefined, userContext);
      // Filter self from people
      if (extracted.people?.length) {
        extracted.people = extracted.people.filter(p => !myNames.has(p.name.toLowerCase()));
      }
      const result = await saveTranscriptionAndEntities(supabase, userId, source, text, extracted, null);

      // WhatsApp notification
      notifyWhatsApp(userId, extracted);

      return new Response(JSON.stringify({
        transcription: result.transcription,
        extracted: result.extracted,
        message: "Transcripción procesada correctamente",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Multiple segments
    const groupId = crypto.randomUUID();
    const results: Array<{ transcription: any; extracted: ExtractedData }> = [];

    for (const segment of segments) {
      console.log(`[process-transcription] Processing segment ${segment.segment_id}: "${segment.title}"`);
      const extracted = await extractFromText(segment.text, {
        title: segment.title,
        participants: segment.participants,
      }, userContext);
      // Filter self from people
      if (extracted.people?.length) {
        extracted.people = extracted.people.filter(p => !myNames.has(p.name.toLowerCase()));
      }
      // Use segment title if extraction didn't produce one
      if (!extracted.title && segment.title) extracted.title = segment.title;
      const result = await saveTranscriptionAndEntities(supabase, userId, source, segment.text, extracted, groupId, segment.participants);
      results.push(result);
    }

    // Single WhatsApp notification for all segments
    const allSuggestions = results.flatMap(r => r.extracted.suggestions || []);
    if (allSuggestions.length > 0) {
      const summaryMsg = `🧠 *JARVIS - ${results.length} conversaciones procesadas*\n\n${results.map((r, i) => `${i + 1}. ${r.extracted.title} (${r.extracted.brain})`).join("\n")}\n\n📌 ${allSuggestions.length} sugerencia(s) total.\nRevisa en la app.`;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, message: summaryMsg }),
      }).catch(e => console.error("[process-transcription] WA notify failed:", e));
    }

    return new Response(JSON.stringify({
      segmented: true,
      group_id: groupId,
      segments: results.map(r => ({ transcription: r.transcription, extracted: r.extracted })),
      message: `${results.length} conversaciones detectadas y procesadas`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("process-transcription error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── WhatsApp notification helper ──

function notifyWhatsApp(userId: string, extracted: ExtractedData) {
  if (!extracted.suggestions?.length) return;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const summaryMsg = `🧠 *JARVIS - Transcripción procesada*\n\n📋 ${extracted.title}\n🧩 Cerebro: ${extracted.brain}\n\n📌 ${extracted.suggestions.length} sugerencia(s):\n${extracted.suggestions.slice(0, 5).map(s => `• ${s.label}`).join("\n")}\n\nRevisa en la app para aprobar/rechazar.`;
    fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, message: summaryMsg }),
    }).catch(e => console.error("[process-transcription] WA notify failed:", e));
  } catch { /* non-critical */ }
}

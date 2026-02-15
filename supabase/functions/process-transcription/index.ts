import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const SYSTEM_PROMPT = `Eres el motor de procesamiento de JARVIS, un asistente personal de IA. Tu trabajo es analizar transcripciones de reuniones, conversaciones o notas y extraer información estructurada.

Debes clasificar el contenido en uno de los "3 Cerebros":
- **professional**: Trabajo, proyectos, clientes, negocio, tecnología, carrera
- **personal**: Familia, amigos, salud, hobbies, viajes, planes personales  
- **bosco**: Todo relacionado con Bosco (hijo del usuario), crianza, actividades infantiles, colegio

Para cada transcripción, extrae:
1. **brain**: El cerebro dominante (professional/personal/bosco)
2. **title**: Un título descriptivo corto (max 60 chars)
3. **summary**: Resumen ejecutivo de 2-3 frases
4. **tasks**: Tareas o acciones pendientes detectadas, con prioridad (high/medium/low)
5. **commitments**: Compromisos detectados (propios o de terceros), con persona y plazo si se menciona
6. **people**: Personas mencionadas con su relación, contexto, empresa y rol si se detectan
7. **follow_ups**: Temas que requieren seguimiento futuro
8. **events**: Citas o eventos mencionados con fecha si está disponible
9. **ideas**: Ideas de proyectos, negocios o iniciativas mencionadas. Para cada una: name (nombre corto), description (descripción breve), category (business/tech/personal/family/investment)
10. **suggestions**: Acciones sugeridas para el usuario. Cada una con: type (task/event/person/idea/follow_up), label (descripción corta legible), data (objeto con los datos relevantes para crear la entidad)

Responde SOLO con JSON válido. Sin explicaciones ni markdown.`;

interface ExtractedData {
  brain: "professional" | "personal" | "bosco";
  title: string;
  summary: string;
  tasks: Array<{ title: string; priority: string; brain: string }>;
  commitments: Array<{ description: string; type: string; person_name?: string; deadline?: string }>;
  people: Array<{ name: string; relationship?: string; brain?: string; context?: string; company?: string; role?: string }>;
  follow_ups: Array<{ topic: string; resolve_by?: string }>;
  events: Array<{ title: string; date?: string }>;
  ideas: Array<{ name: string; description: string; category?: string }>;
  suggestions: Array<{ type: string; label: string; data: Record<string, unknown> }>;
}

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

    const { text, source = "manual" } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length < 10) {
      return new Response(JSON.stringify({ error: "El texto es demasiado corto" }), { status: 400, headers: corsHeaders });
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), { status: 500, headers: corsHeaders });
    }

    // Call Claude for extraction
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Analiza esta transcripción:\n\n${text}` }],
      }),
    });

    if (!claudeResponse.ok) {
      const err = await claudeResponse.text();
      console.error("Claude API error:", claudeResponse.status, err);
      return new Response(JSON.stringify({ error: "Error procesando con IA" }), { status: 500, headers: corsHeaders });
    }

    const claudeData = await claudeResponse.json();
    const rawContent = claudeData.content?.find((b: any) => b.type === "text")?.text || "";

    let extracted: ExtractedData;
    try {
      let cleaned = rawContent.trim();
      if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
      if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
      if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
      extracted = JSON.parse(cleaned.trim());
    } catch {
      console.error("Failed to parse Claude response:", rawContent);
      return new Response(JSON.stringify({ error: "Error parseando respuesta de IA", raw: rawContent }), { status: 500, headers: corsHeaders });
    }

    // Ensure arrays exist
    extracted.ideas = extracted.ideas || [];
    extracted.suggestions = extracted.suggestions || [];

    // Save transcription
    const { data: transcription, error: txError } = await supabase
      .from("transcriptions")
      .insert({
        user_id: userId,
        source,
        raw_text: text,
        brain: extracted.brain,
        title: extracted.title,
        summary: extracted.summary,
        entities_json: extracted,
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (txError) {
      console.error("Error saving transcription:", txError);
      return new Response(JSON.stringify({ error: "Error guardando transcripción" }), { status: 500, headers: corsHeaders });
    }

    // Save commitments
    if (extracted.commitments?.length) {
      const commitmentRows = extracted.commitments.map((c) => ({
        user_id: userId,
        description: c.description,
        commitment_type: c.type === "third_party" ? "third_party" : "own",
        person_name: c.person_name || null,
        deadline: c.deadline || null,
        source_transcription_id: transcription.id,
      }));
      await supabase.from("commitments").insert(commitmentRows);
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
      const followUpRows = extracted.follow_ups.map((f) => ({
        user_id: userId,
        topic: f.topic,
        resolve_by: f.resolve_by || null,
        source_transcription_id: transcription.id,
      }));
      await supabase.from("follow_ups").insert(followUpRows);
    }

    // Save ideas/projects
    if (extracted.ideas?.length) {
      for (const idea of extracted.ideas) {
        // Check if similar idea exists
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
      const suggestionRows = extracted.suggestions.map((s) => ({
        user_id: userId,
        suggestion_type: s.type,
        content: { label: s.label, data: s.data },
        source_transcription_id: transcription.id,
      }));
      await supabase.from("suggestions").insert(suggestionRows);
    }

    // Insert extracted tasks directly into tasks table
    if (extracted.tasks?.length) {
      const taskRows = extracted.tasks.map((t) => ({
        user_id: userId,
        title: t.title,
        type: t.brain === "bosco" ? "life" : t.brain === "professional" ? "work" : "life",
        priority: t.priority === "high" ? "P1" : t.priority === "medium" ? "P2" : "P3",
        duration: 30,
        completed: false,
        source: source,
        description: `Extraída de: ${extracted.title}. ${extracted.summary}`,
        due_date: null,
      }));
      const { error: taskInsertError } = await supabase.from("tasks").insert(taskRows);
      if (taskInsertError) {
        console.error("[process-transcription] Task insert error:", taskInsertError);
      } else {
        console.log(`[process-transcription] Inserted ${taskRows.length} tasks directly`);
      }
    }

    // Generate conversation embeddings for RAG
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (OPENAI_API_KEY) {
      try {
        // Create chunks: summary + full content
        const chunks = [
          {
            content: `${extracted.title}. ${extracted.summary}`,
            summary: extracted.summary,
            brain: extracted.brain,
            people: extracted.people?.map(p => p.name) || [],
          },
        ];

        // If text is long, split into segments
        const maxChunkLen = 1500;
        if (text.length > maxChunkLen) {
          const sentences = text.split(/(?<=[.!?])\s+/);
          let currentChunk = "";
          for (const sentence of sentences) {
            if ((currentChunk + " " + sentence).length > maxChunkLen && currentChunk.length > 100) {
              chunks.push({
                content: currentChunk.trim(),
                summary: currentChunk.trim().substring(0, 200),
                brain: extracted.brain,
                people: extracted.people?.map(p => p.name) || [],
              });
              currentChunk = sentence;
            } else {
              currentChunk += " " + sentence;
            }
          }
          if (currentChunk.trim().length > 50) {
            chunks.push({
              content: currentChunk.trim(),
              summary: currentChunk.trim().substring(0, 200),
              brain: extracted.brain,
              people: extracted.people?.map(p => p.name) || [],
            });
          }
        }

        // Generate embeddings for all chunks
        const textsToEmbed = chunks.map(c => c.content);
        const embResponse = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-ada-002",
            input: textsToEmbed,
          }),
        });

        if (embResponse.ok) {
          const embData = await embResponse.json();
          const embeddingRows = embData.data.map((emb: any, i: number) => ({
            user_id: userId,
            transcription_id: transcription.id,
            date: new Date().toISOString().split("T")[0],
            brain: chunks[i].brain,
            people: chunks[i].people,
            summary: chunks[i].summary,
            content: chunks[i].content,
            embedding: emb.embedding,
            metadata: { source, title: extracted.title },
          }));

          // Use service role client for insert (RLS requires auth.uid match)
          const adminClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );
          const { error: embInsertError } = await adminClient.from("conversation_embeddings").insert(embeddingRows);
          if (embInsertError) {
            console.error("[process-transcription] Embedding insert error:", embInsertError);
          } else {
            console.log(`[process-transcription] Saved ${embeddingRows.length} embeddings`);
          }
        } else {
          console.error("[process-transcription] OpenAI embedding error:", await embResponse.text());
        }
      } catch (embError) {
        console.error("[process-transcription] Embedding generation error:", embError);
      }
    }

    // Save interactions for people mentioned
    if (extracted.people?.length) {
      try {
        const adminClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        
        for (const person of extracted.people) {
          const { data: contact } = await adminClient
            .from("people_contacts")
            .select("id")
            .eq("user_id", userId)
            .ilike("name", person.name)
            .maybeSingle();

          if (contact) {
            await adminClient.from("interactions").insert({
              user_id: userId,
              contact_id: contact.id,
              date: new Date().toISOString().split("T")[0],
              channel: source === "plaud" ? "plaud" : source === "whatsapp" ? "whatsapp" : "manual",
              interaction_type: "conversation",
              summary: extracted.summary?.substring(0, 300),
              sentiment: null,
              commitments: extracted.commitments
                ?.filter(c => c.person_name?.toLowerCase() === person.name.toLowerCase())
                .map(c => ({ description: c.description, deadline: c.deadline })) || [],
            });
          }
        }
      } catch (interactionError) {
        console.error("[process-transcription] Interaction save error:", interactionError);
      }
    }

    // Send WhatsApp notification with suggestions summary
    if (extracted.suggestions?.length > 0) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const summaryMsg = `🧠 *JARVIS - Transcripción procesada*\n\n📋 ${extracted.title}\n🧩 Cerebro: ${extracted.brain}\n\n📌 ${extracted.suggestions.length} sugerencia(s):\n${extracted.suggestions.slice(0, 5).map(s => `• ${s.label}`).join("\n")}\n\nRevisa en la app para aprobar/rechazar.`;
        
        await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, message: summaryMsg }),
        }).catch(e => console.error("[process-transcription] WA notify failed:", e));
      } catch {
        // Non-critical, ignore
      }
    }

    return new Response(JSON.stringify({
      transcription,
      extracted,
      message: "Transcripción procesada correctamente",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-transcription error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

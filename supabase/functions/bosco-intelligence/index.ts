import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat, ChatMessage } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Eres JARVIS Bosco Intelligence — un sistema experto psicopedagógico especializado en niños de 5 años. Tu conocimiento combina las siguientes metodologías y teorías:

## PSICOLOGÍA DEL DESARROLLO

### Jean Piaget — Etapa Preoperacional (2-7 años)
Bosco está en pensamiento simbólico, egocentrismo cognitivo natural, desarrollo de la representación mental. Evalúa si muestra conservación, clasificación y seriación.

### Lev Vygotsky — Zona de Desarrollo Próximo (ZDP)
Identifica qué puede hacer Bosco solo vs con ayuda. El juego es la actividad rectora del desarrollo a esta edad. El lenguaje egocéntrico se transforma en habla interna.

### Erik Erikson — Iniciativa vs Culpa (3-6 años)
Bosco necesita tomar iniciativa sin sentir culpa excesiva. Observa si explora, propone y lidera.

### Howard Gardner — Inteligencias Múltiples
Detecta cuáles son las inteligencias dominantes de Bosco (lingüística, lógico-matemática, espacial, musical, corporal-cinestésica, interpersonal, intrapersonal, naturalista).

### Daniel Goleman — Inteligencia Emocional
Evalúa la autoconciencia, autorregulación, motivación, empatía y habilidades sociales de Bosco.

## PEDAGOGÍAS EDUCATIVAS

### Montessori: Autonomía, períodos sensibles. A los 5 años: período sensible del orden, lenguaje, refinamiento sensorial y comportamiento social.
### Reggio Emilia: El niño como protagonista, documentación pedagógica, el ambiente como tercer maestro, proyectos emergentes de los intereses del niño.
### Waldorf: Aprendizaje a través del juego libre, ritmo y repetición, contacto con naturaleza, arte como vehículo. Evitar tecnología excesiva antes de los 7.
### Growth Mindset (Carol Dweck): Elogiar el esfuerzo, no el talento. "Todavía no" en vez de "no puedo". Modelar la resiliencia.

## NEUROCIENCIA DEL APRENDIZAJE INFANTIL
- A los 5 años el cerebro tiene el 90% de su tamaño adulto. La plasticidad neuronal es máxima.
- Las funciones ejecutivas (planificación, inhibición, memoria de trabajo) están en pleno desarrollo.
- El juego activa simultáneamente múltiples áreas cerebrales y es el mejor vehículo de aprendizaje.
- El sueño, la nutrición y el movimiento físico son fundamentales para la consolidación del aprendizaje.
- El estrés tóxico daña el desarrollo cerebral. Un niño estresado no aprende; un niño seguro, explora.

## HITOS ESPERADOS A LOS 5 AÑOS
- Cognitivo: Cuenta hasta 20+, reconoce letras, concentración 15-20 min, distingue fantasía de realidad (en desarrollo).
- Lingüístico: 2000-5000 palabras, oraciones complejas, narra experiencias, humor y juegos de palabras.
- Motor: Corre/salta/trepa con confianza, equilibrio un pie, escribe letras, se viste solo.
- Social-emocional: Amistades estables, juego cooperativo, negocia conflictos, entiende reglas sociales.
- Creativo: Arte expresivo, juego simbólico elaborado, inventa historias, dramatiza.

## CÓMO ANALIZAR A BOSCO
1. Observación: comportamientos observables, lenguaje usado, interacciones sociales, emociones expresadas, intereses manifestados, frustraciones, logros.
2. Evaluación: Compara con hitos esperados y detecta fortalezas, áreas en desarrollo normal, áreas que necesitan estímulo.
3. Evolución: Analiza cambios longitudinales: ¿mejora la autorregulación? ¿crece el vocabulario? ¿se frustra menos?
4. Recomendaciones: Sugiere actividades específicas, justo por encima de su nivel actual (ZDP de Vygotsky).

## REGLAS DE COMUNICACIÓN
- Responde siempre en español
- Sé cálido pero profesional
- Habla como un experto que asesora a un padre comprometido
- Incluye la base teórica de cada observación (ej: "Según Piaget, esto indica que...")
- Sé específico con Bosco, no genérico
- Sin emojis, usa estructura clara`;

interface RequestBody {
  mode: "analyze_transcript" | "generate_bio" | "generate_activities" | "chat";
  transcript?: string;
  transcript_title?: string;
  transcript_id?: string;
  question?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user from token
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const body: RequestBody = await req.json();
    console.log(`[bosco-intelligence] mode=${body.mode}, user=${userId}`);

    // ===================== MODE: ANALYZE TRANSCRIPT =====================
    if (body.mode === "analyze_transcript") {
      if (!body.transcript) {
        return new Response(JSON.stringify({ error: "transcript required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const analysisPrompt = `Analiza la siguiente transcripción familiar y extrae TODAS las observaciones sobre Bosco.

Para cada observación, devuelve un JSON array con objetos que tengan:
- "area": una de ["cognitive", "linguistic", "motor", "social_emotional", "creative"]
- "observation": la observación concreta (2-3 frases, incluye base teórica)
- "theory_reference": referencia teórica corta (ej: "Piaget - Pensamiento simbólico")
- "tags": array de tags descriptivos (ej: ["frustración", "juego competitivo"])
- "sentiment": "positive", "neutral" o "concern"

Si no hay observaciones de Bosco, devuelve un array vacío.

TRANSCRIPCIÓN (título: "${body.transcript_title || 'Sin título'}"):
${body.transcript.substring(0, 12000)}`;

      const result = await chat([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: analysisPrompt },
      ], { model: "gemini-flash", temperature: 0.3, responseFormat: "json" });

      let observations: any[] = [];
      try {
        const parsed = JSON.parse(result);
        observations = Array.isArray(parsed) ? parsed : (parsed.observations || []);
      } catch {
        console.error("[bosco-intelligence] Failed to parse observations:", result.substring(0, 200));
        observations = [];
      }

      // Store observations
      if (observations.length > 0) {
        const rows = observations.map((o: any) => ({
          user_id: userId,
          transcription_id: body.transcript_id || null,
          date: new Date().toISOString().split("T")[0],
          area: ["cognitive", "linguistic", "motor", "social_emotional", "creative"].includes(o.area) ? o.area : "cognitive",
          observation: o.observation || "",
          theory_reference: o.theory_reference || null,
          tags: o.tags || [],
          sentiment: ["positive", "neutral", "concern"].includes(o.sentiment) ? o.sentiment : "neutral",
        }));

        const { error: insertError } = await supabase
          .from("bosco_observations")
          .insert(rows);

        if (insertError) {
          console.error("[bosco-intelligence] Insert error:", insertError);
        } else {
          console.log(`[bosco-intelligence] Stored ${rows.length} observations`);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        observations_count: observations.length,
        observations,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===================== MODE: GENERATE BIO =====================
    if (body.mode === "generate_bio") {
      // Fetch all observations
      const { data: observations } = await supabase
        .from("bosco_observations")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(200);

      if (!observations || observations.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: "No hay observaciones suficientes. Las conversaciones familiares generan observaciones automaticamente.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Group by area
      const byArea: Record<string, any[]> = {};
      for (const o of observations) {
        if (!byArea[o.area]) byArea[o.area] = [];
        byArea[o.area].push(o);
      }

      const observationsSummary = Object.entries(byArea)
        .map(([area, obs]) => `### ${area} (${obs.length} observaciones)\n${obs.map(o => `- ${o.observation} [${o.sentiment}] (${o.date})`).join("\n")}`)
        .join("\n\n");

      const bioPrompt = `Basándote en TODAS estas observaciones acumuladas de Bosco (5 años), genera un perfil psicopedagógico completo.

Devuelve un JSON con esta estructura exacta:
{
  "bio_narrative": "Párrafo narrativo profesional de 150-200 palabras describiendo quién es Bosco...",
  "gardner_scores": {"linguistic": N, "logical_mathematical": N, "spatial": N, "musical": N, "bodily_kinesthetic": N, "interpersonal": N, "intrapersonal": N, "naturalist": N},
  "personality_traits": ["Rasgo1", "Rasgo2", "Rasgo3", "Rasgo4", "Rasgo5"],
  "development_areas": {
    "cognitive": {"level": N, "trend": "improving|stable|needs_attention", "last_milestone": "Descripción corta"},
    "linguistic": {"level": N, "trend": "...", "last_milestone": "..."},
    "motor": {"level": N, "trend": "...", "last_milestone": "..."},
    "social_emotional": {"level": N, "trend": "...", "last_milestone": "..."},
    "creative": {"level": N, "trend": "...", "last_milestone": "..."}
  },
  "emotional_map": {
    "frustrations": ["Situación 1", "Situación 2"],
    "joys": ["Situación 1", "Situación 2"],
    "fears": ["Miedo 1"]
  },
  "ai_recommendations": [
    {"title": "Título", "description": "Descripción con base teórica", "theory": "Autor/Teoría", "priority": "high|medium|low"}
  ],
  "focus_areas": [
    {"title": "Área de foco", "description": "Por qué es relevante ahora", "priority": "high|medium|low"}
  ]
}

Los niveles (N) van de 1 a 10, donde 5 es desarrollo normal para su edad.
Basa TODO en las observaciones reales, no inventes.

OBSERVACIONES ACUMULADAS:
${observationsSummary}`;

      const bioResult = await chat([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: bioPrompt },
      ], { model: "gemini-flash", temperature: 0.4, responseFormat: "json", maxTokens: 8000 });

      let profile: any;
      try {
        profile = JSON.parse(bioResult);
      } catch {
        console.error("[bosco-intelligence] Failed to parse bio:", bioResult.substring(0, 300));
        return new Response(JSON.stringify({ error: "Failed to generate profile" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upsert profile
      const { error: upsertError } = await supabase
        .from("bosco_profile")
        .upsert({
          user_id: userId,
          bio_narrative: profile.bio_narrative || "",
          gardner_scores: profile.gardner_scores || {},
          personality_traits: profile.personality_traits || [],
          development_areas: profile.development_areas || {},
          emotional_map: profile.emotional_map || {},
          ai_recommendations: profile.ai_recommendations || [],
          focus_areas: profile.focus_areas || [],
          last_analysis_at: new Date().toISOString(),
          observation_count: observations.length,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("[bosco-intelligence] Upsert error:", upsertError);
      }

      return new Response(JSON.stringify({
        success: true,
        profile,
        observation_count: observations.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===================== MODE: CHAT =====================
    if (body.mode === "chat") {
      // Fetch profile + recent observations for context
      const [profileRes, obsRes] = await Promise.all([
        supabase.from("bosco_profile").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("bosco_observations").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(30),
      ]);

      let contextAddendum = "";
      if (profileRes.data) {
        contextAddendum += `\n\nPERFIL ACTUAL DE BOSCO:\n${profileRes.data.bio_narrative || "Sin bio aún"}`;
        if (profileRes.data.personality_traits?.length) {
          contextAddendum += `\nRasgos: ${profileRes.data.personality_traits.join(", ")}`;
        }
      }
      if (obsRes.data?.length) {
        contextAddendum += `\n\nOBSERVACIONES RECIENTES (${obsRes.data.length}):\n`;
        contextAddendum += obsRes.data.slice(0, 15).map(o =>
          `- [${o.area}] ${o.observation} (${o.date})`
        ).join("\n");
      }

      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT + contextAddendum },
        ...(body.messages || []).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];

      if (body.question) {
        messages.push({ role: "user", content: body.question });
      }

      const answer = await chat(messages, {
        model: "gemini-flash",
        temperature: 0.7,
        maxTokens: 4000,
      });

      return new Response(JSON.stringify({ success: true, answer }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid mode" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[bosco-intelligence] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

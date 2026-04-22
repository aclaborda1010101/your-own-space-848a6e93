import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { chat, ChatMessage } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnglishRequest {
  action: "level_test" | "pronunciation_exercise" | "daily_practice" | "conversation_sim" | "vocabulary_pro" | "generate_shadowing" | "generate_chunks_practice" | "generate_roleplay_scenario" | "generate_mini_test";
  userLevel?: string; // A1, A2, B1, B2, C1, C2
  topic?: string;
  previousAnswers?: string[];
  focusArea?: "pronunciation" | "vocabulary" | "fluency" | "business";
}

async function resolveUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data } = await sb.auth.getClaims(token);
    return (data?.claims?.sub as string) || null;
  } catch { return null; }
}

// CEFR Level descriptors
const LEVEL_DESCRIPTORS = {
  A1: "Principiante - frases básicas",
  A2: "Elemental - situaciones cotidianas simples",
  B1: "Intermedio - viajes, trabajo básico, opiniones simples",
  B2: "Intermedio alto - discusiones, textos complejos, fluidez",
  C1: "Avanzado - expresión fluida, uso flexible, textos exigentes",
  C2: "Maestría - comprensión total, expresión precisa y natural"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, userLevel, topic, previousAnswers, focusArea }: EnglishRequest = await req.json();

    // ==================== LEVEL TEST ====================
    if (action === "level_test") {
      const testPhase = previousAnswers?.length || 0;
      
      if (testPhase === 0) {
        // Initial questions to gauge level
        return new Response(JSON.stringify({
          success: true,
          phase: "initial",
          questions: [
            {
              id: 1,
              type: "self_assessment",
              question: "¿Cómo describirías tu nivel actual de inglés?",
              options: [
                "Muy básico - solo palabras sueltas",
                "Básico - frases simples del día a día",
                "Intermedio - puedo mantener conversaciones",
                "Avanzado - me comunico bien pero quiero mejorar",
                "Casi nativo - quiero perfeccionar detalles"
              ]
            },
            {
              id: 2,
              type: "listening",
              question: "¿Entiendes películas/series en inglés sin subtítulos?",
              options: ["Nada", "Palabras sueltas", "La idea general", "Casi todo", "Todo perfectamente"]
            },
            {
              id: 3,
              type: "speaking",
              question: "¿Puedes mantener una conversación telefónica en inglés?",
              options: ["No", "Con mucha dificultad", "Sobre temas conocidos", "Sin problemas", "Como un nativo"]
            }
          ]
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Generate adaptive test based on estimated level
      const systemPrompt = `Eres un examinador de inglés CEFR certificado.
Genera preguntas de test adaptativo para evaluar nivel de inglés.

El usuario ha respondido: ${JSON.stringify(previousAnswers)}

Genera 5 preguntas de nivel apropiado (grammar, vocabulary, reading comprehension).
Si las respuestas previas indican nivel alto, aumenta la dificultad.

FORMATO JSON:
{
  "estimated_level": "B1/B2/C1/etc",
  "questions": [
    {
      "id": 1,
      "type": "grammar|vocabulary|comprehension",
      "difficulty": "easy|medium|hard",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": "B",
      "explanation_es": "Explicación en español"
    }
  ]
}`;

      const response = await chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: "Genera el test adaptativo basado en las respuestas previas." }
      ], { model: "gemini-flash", responseFormat: "json" });

      const testData = JSON.parse(response);
      return new Response(JSON.stringify({ success: true, phase: "testing", ...testData }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== PRONUNCIATION EXERCISE ====================
    if (action === "pronunciation_exercise") {
      const level = userLevel || "B2";
      
      const systemPrompt = `Eres un coach de pronunciación de inglés especializado en hispanohablantes.

PROBLEMAS COMUNES DE HISPANOHABLANTES:
1. Vocales: /ɪ/ vs /iː/ (ship/sheep), /æ/ vs /e/ (bad/bed), schwa /ə/
2. Consonantes: /v/ vs /b/, /θ/ y /ð/ (think/this), /h/ aspirada, /r/ americana
3. Clusters: /str/, /spl/, /sts/
4. Liaisons y connected speech
5. Word stress y sentence stress
6. Intonation patterns

Genera un ejercicio de pronunciación para nivel ${level}.

FORMATO JSON:
{
  "focus": "nombre del sonido/patrón",
  "ipa": "símbolo IPA",
  "explanation_es": "explicación en español de cómo producir el sonido",
  "minimal_pairs": [
    {"word1": "ship", "word2": "sheep", "ipa1": "/ʃɪp/", "ipa2": "/ʃiːp/"}
  ],
  "practice_words": [
    {"word": "...", "ipa": "...", "tip_es": "consejo específico"}
  ],
  "practice_sentences": [
    {"sentence": "...", "focus_words": ["..."], "tip_es": "..."}
  ],
  "tongue_twister": {
    "text": "...",
    "tip_es": "..."
  },
  "common_mistake_es": "Error típico de hispanohablantes y cómo evitarlo"
}`;

      const response = await chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Genera ejercicio de pronunciación para nivel ${level}. ${topic ? `Enfócate en: ${topic}` : "Elige un área problemática común."}` }
      ], { model: "gemini-flash", responseFormat: "json" });

      const exerciseData = JSON.parse(response);
      return new Response(JSON.stringify({ success: true, exercise: exerciseData }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== DAILY PRACTICE ====================
    if (action === "daily_practice") {
      const level = userLevel || "B2";
      const focus = focusArea || "fluency";
      
      const systemPrompt = `Eres un tutor de inglés profesional. Genera la práctica diaria personalizada.

Nivel: ${level}
Enfoque: ${focus}

FORMATO JSON:
{
  "greeting": "Saludo motivacional corto",
  "today_focus": "Tema del día",
  "warm_up": {
    "type": "tongue_twister|quick_vocab|listening",
    "content": "...",
    "duration_min": 2
  },
  "main_exercise": {
    "type": "shadowing|conversation|vocabulary|grammar",
    "instructions_es": "...",
    "content": "...",
    "duration_min": 10
  },
  "pronunciation_spotlight": {
    "sound": "...",
    "ipa": "...",
    "words": ["...", "...", "..."],
    "sentence": "..."
  },
  "vocabulary_boost": [
    {"word": "...", "definition": "...", "example": "...", "level": "B2"}
  ],
  "homework": {
    "task": "...",
    "why_es": "Por qué esto te ayudará"
  },
  "motivation_es": "Frase motivacional final"
}`;

      const response = await chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: "Genera la práctica diaria de hoy." }
      ], { model: "gemini-flash", responseFormat: "json" });

      const practiceData = JSON.parse(response);
      return new Response(JSON.stringify({ success: true, practice: practiceData }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== CONVERSATION SIMULATION ====================
    if (action === "conversation_sim") {
      const level = userLevel || "B2";
      const scenario = topic || "job interview";
      
      const systemPrompt = `Eres un hablante nativo de inglés en una simulación de conversación.

ESCENARIO: ${scenario}
NIVEL DEL USUARIO: ${level}

REGLAS:
1. Habla naturalmente como un nativo
2. Usa expresiones idiomáticas apropiadas al nivel
3. Si el usuario comete errores, NO corrijas inmediatamente - responde naturalmente
4. Al final de cada turno, añade [FEEDBACK] con correcciones sutiles
5. Adapta vocabulario al nivel pero NO simplifiques excesivamente

FORMATO:
{
  "scenario_setup_es": "Descripción del escenario en español",
  "your_role": "Tu rol en la conversación",
  "user_role": "Rol del usuario",
  "opening_line": "Tu primera línea para iniciar",
  "useful_phrases": [
    {"phrase": "...", "use_es": "Cuándo usarla"}
  ],
  "vocabulary_for_scenario": [
    {"word": "...", "meaning_es": "..."}
  ]
}`;

      const response = await chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Prepara una simulación de conversación: ${scenario}` }
      ], { model: "gemini-flash", responseFormat: "json" });

      const simData = JSON.parse(response);
      return new Response(JSON.stringify({ success: true, simulation: simData }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== PROFESSIONAL VOCABULARY ====================
    if (action === "vocabulary_pro") {
      const domain = topic || "business";
      const level = userLevel || "B2";
      
      const systemPrompt = `Genera vocabulario profesional de ${domain} para nivel ${level}.

FORMATO JSON:
{
  "domain": "${domain}",
  "words": [
    {
      "word": "...",
      "ipa": "...",
      "part_of_speech": "noun/verb/adj",
      "definition_en": "...",
      "definition_es": "...",
      "example": "...",
      "collocations": ["...", "..."],
      "register": "formal/neutral/informal",
      "frequency": "common/less_common"
    }
  ],
  "phrases": [
    {
      "phrase": "...",
      "meaning_es": "...",
      "context": "Cuándo usarla",
      "example": "..."
    }
  ],
  "pro_tip_es": "Consejo profesional para usar este vocabulario"
}`;

      const response = await chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Genera 10 palabras y 5 frases de vocabulario profesional de ${domain}.` }
      ], { model: "gemini-flash", responseFormat: "json" });

      const vocabData = JSON.parse(response);
      return new Response(JSON.stringify({ success: true, vocabulary: vocabData }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== GENERATE SHADOWING ====================
    if (action === "generate_shadowing") {
      const level = userLevel || "B2";
      const response = await chat([
        { role: "system", content: `Genera 5-8 frases para práctica de shadowing en inglés, nivel CEFR ${level}.
Frases naturales que un nativo diría en situaciones cotidianas y profesionales.
FORMATO JSON:
{
  "sentences": [
    {"text": "frase en inglés", "translation": "traducción al español"}
  ]
}` },
        { role: "user", content: `Genera frases de shadowing para nivel ${level}. ${topic ? `Contexto: ${topic}` : "Variadas."}` }
      ], { model: "gemini-flash", responseFormat: "json" });
      return new Response(JSON.stringify({ success: true, ...JSON.parse(response) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== GENERATE CHUNKS PRACTICE ====================
    if (action === "generate_chunks_practice") {
      const level = userLevel || "B2";
      const response = await chat([
        { role: "system", content: `Genera 10 chunks/expresiones idiomáticas en inglés para practicar, nivel CEFR ${level}.
Cada chunk debe ser una expresión natural con su traducción y ejemplo de uso.
FORMATO JSON:
{
  "chunks": [
    {"en": "expresión en inglés", "es": "traducción(es) en español", "example": "frase de ejemplo completa en inglés"}
  ]
}` },
        { role: "user", content: `Genera 10 chunks para nivel ${level}. ${topic ? `Tema: ${topic}` : "Variados y útiles."}` }
      ], { model: "gemini-flash", responseFormat: "json" });
      return new Response(JSON.stringify({ success: true, ...JSON.parse(response) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== GENERATE ROLEPLAY SCENARIO ====================
    if (action === "generate_roleplay_scenario") {
      const level = userLevel || "B2";
      const scenario = topic || "professional meeting";
      const response = await chat([
        { role: "system", content: `Genera un escenario de roleplay conversacional en inglés para nivel ${level}.
El escenario debe ser realista y basado en situaciones reales.
FORMATO JSON:
{
  "scenario": {
    "title": "título del escenario",
    "description_es": "descripción en español del contexto",
    "your_role": "rol del AI partner",
    "user_role": "rol del usuario",
    "opening_line": "primera línea del AI para iniciar",
    "useful_phrases": [{"phrase": "...", "use_es": "cuándo usarla"}],
    "vocabulary": [{"word": "...", "meaning_es": "..."}]
  }
}` },
        { role: "user", content: `Escenario de roleplay: ${scenario}, nivel ${level}` }
      ], { model: "gemini-flash", responseFormat: "json" });
      return new Response(JSON.stringify({ success: true, ...JSON.parse(response) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== GENERATE MINI TEST ====================
    if (action === "generate_mini_test") {
      const level = userLevel || "B2";
      const response = await chat([
        { role: "system", content: `Genera 10 preguntas de test adaptativo de inglés para nivel CEFR ${level}.
Mezcla gramática, vocabulario y comprensión. Preguntas variadas y retadoras.
FORMATO JSON:
{
  "questions": [
    {
      "question": "pregunta o frase a completar",
      "options": ["opción A", "opción B", "opción C", "opción D"],
      "correct": 0,
      "explanation_es": "explicación breve en español"
    }
  ]
}` },
        { role: "user", content: `Genera 10 preguntas de test para nivel ${level}. ${topic ? `Enfoque: ${topic}` : "Variadas."}` }
      ], { model: "gemini-flash", responseFormat: "json" });
      return new Response(JSON.stringify({ success: true, ...JSON.parse(response) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: level_test, pronunciation_exercise, daily_practice, conversation_sim, vocabulary_pro, generate_shadowing, generate_chunks_practice, generate_roleplay_scenario, generate_mini_test" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("English Pro error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

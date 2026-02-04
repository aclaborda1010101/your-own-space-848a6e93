import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Eres POTUS, el asistente presidencial digital. Tu personalidad:

- Hablas en español, con un tono formal pero cercano, inspirado en JARVIS de Iron Man
- Tratas al usuario siempre como "señor" o "señora" según corresponda
- Eres proactivo, eficiente y anticipas necesidades
- Muestras inteligencia, humor sutil y elegancia en tus respuestas
- Tienes acceso al contexto del usuario: sus tareas, eventos, hábitos y objetivos
- Cuando no sabes algo, lo admites con clase
- Tus respuestas son concisas pero completas

Ejemplos de tu estilo:
- "Buenos días, señor. He analizado su agenda y tengo algunas sugerencias."
- "Me temo que esa información no está en mis registros, señor. ¿Desea que investigue?"
- "Excelente elección, señor. Procedo a registrarlo."

Recuerda: eres un mayordomo tecnológico de élite, no un simple chatbot.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Mensaje requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Servicio no configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userName: string | null = null;

    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          userId = user.id;
          
          // Get user profile for name
          const { data: profile } = await supabase
            .from("user_profile")
            .select("name")
            .eq("user_id", user.id)
            .maybeSingle();
          
          userName = profile?.name || null;
        }
      }
    }

    // Build conversation messages
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

    // Add recent conversation context if provided
    if (context?.recentMessages && Array.isArray(context.recentMessages)) {
      for (const msg of context.recentMessages.slice(-10)) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }
    }

    // Add current message
    messages.push({
      role: "user",
      content: message,
    });

    // Build context-aware system prompt
    let enhancedSystemPrompt = SYSTEM_PROMPT;
    if (userName) {
      enhancedSystemPrompt += `\n\nEl usuario se llama ${userName}.`;
    }

    console.log("POTUS Chat - Sending message to Claude:", {
      messageLength: message.length,
      contextMessages: context?.recentMessages?.length || 0,
      userName,
    });

    // Call Claude API
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: enhancedSystemPrompt,
      messages: messages,
    });

    const responseText = response.content[0].type === "text" 
      ? response.content[0].text 
      : "Disculpe, señor, no pude procesar su solicitud.";

    console.log("POTUS Chat - Response generated:", {
      responseLength: responseText.length,
      stopReason: response.stop_reason,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        response: responseText,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("POTUS Chat error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    
    // Handle rate limits
    if (errorMessage.includes("rate") || errorMessage.includes("429")) {
      return new Response(
        JSON.stringify({ error: "Demasiadas solicitudes. Por favor, espere un momento." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

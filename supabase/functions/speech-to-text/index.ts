import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { recordCost } from "../_shared/cost-tracker.ts";
import { validateAuth } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const { user, error: authError } = await validateAuth(req, corsHeaders);
  if (authError) return authError;

  try {
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY not configured");
    }

    const formData = await req.formData();
    const audioFile = formData.get("file") as File;
    const language = formData.get("language") || "es";

    if (!audioFile) {
      throw new Error("No audio file provided");
    }

    console.log(`[speech-to-text] User ${user!.id} transcribing: ${audioFile.size} bytes`);

    const groqFormData = new FormData();
    groqFormData.append("file", audioFile);
    groqFormData.append("model", "whisper-large-v3");
    groqFormData.append("language", language as string);
    groqFormData.append("response_format", "json");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: groqFormData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Groq API error:", error);
      throw new Error("Transcription failed");
    }

    const result = await response.json();

    const audioSize = audioFile.size || 0;
    const estMinutes = Math.max(0.5, audioSize / (1024 * 1024));
    recordCost(null, {
      service: "whisper-large-v3",
      operation: "speech-to-text",
      tokensInput: 0,
      tokensOutput: 0,
      costUsd: estMinutes * 0.006,
      metadata: { audioSizeBytes: audioSize, estMinutes, userId: user!.id },
    }).catch(() => {});

    return new Response(JSON.stringify({ 
      text: result.text,
      language: result.language || language 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("STT Error:", error);
    return new Response(JSON.stringify({ 
      error: "Transcription failed" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

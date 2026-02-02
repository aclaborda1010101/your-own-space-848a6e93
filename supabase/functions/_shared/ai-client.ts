// Shared AI Client - Uses Lovable AI Gateway
// This provides access to Gemini and OpenAI models without requiring separate API keys

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}

export interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  style?: string;
}

// Model aliases - map old model names to Lovable AI Gateway models
const MODEL_ALIASES: Record<string, string> = {
  // Gemini models
  "gemini-2.0-flash": "google/gemini-2.5-flash",
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "gemini-flash": "google/gemini-2.5-flash",
  "gemini-pro": "google/gemini-2.5-pro",
  "gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite",
  // OpenAI models
  "gpt-4o": "openai/gpt-5",
  "gpt-4o-mini": "openai/gpt-5-mini",
  "gpt-4": "openai/gpt-5",
  // Direct Lovable AI Gateway models (no mapping needed)
  "google/gemini-2.5-flash": "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-pro": "google/gemini-2.5-pro",
  "google/gemini-3-flash-preview": "google/gemini-3-flash-preview",
  "google/gemini-3-pro-preview": "google/gemini-3-pro-preview",
  "openai/gpt-5": "openai/gpt-5",
  "openai/gpt-5-mini": "openai/gpt-5-mini",
  "openai/gpt-5-nano": "openai/gpt-5-nano",
};

// Default model for the gateway
const DEFAULT_MODEL = "google/gemini-2.5-flash";

/**
 * Resolve model name to Lovable AI Gateway model
 */
function resolveModel(modelKey?: string): string {
  if (!modelKey) return DEFAULT_MODEL;
  return MODEL_ALIASES[modelKey] || modelKey;
}

/**
 * Chat completion using Lovable AI Gateway
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const model = resolveModel(options.model);
  
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };

  // Note: Lovable AI Gateway uses OpenAI-compatible API
  // response_format for JSON mode
  if (options.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Lovable AI Gateway error:", response.status, error);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("Payment required. Please add credits to your Lovable workspace.");
    }
    
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Generate image (placeholder - use Lovable AI image generation models)
 */
export async function generateImage(options: ImageGenerationOptions): Promise<string | null> {
  // For image generation, would need to use google/gemini-2.5-flash-image or similar
  console.log("Image generation requested:", options.prompt.substring(0, 100) + "...");
  return null;
}

/**
 * Simple text generation (wrapper around chat)
 */
export async function generate(
  prompt: string,
  options: ChatOptions = {}
): Promise<string> {
  return chat([{ role: "user", content: prompt }], options);
}

/**
 * JSON generation (wrapper around chat with JSON format)
 */
export async function generateJSON<T = unknown>(
  prompt: string,
  options: ChatOptions = {}
): Promise<T> {
  const result = await chat(
    [{ role: "user", content: prompt }],
    { ...options, responseFormat: "json" }
  );
  return JSON.parse(result) as T;
}

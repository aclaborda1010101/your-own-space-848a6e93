// AI Client - Lovable AI Gateway (Google Gemini 3.1 / 3 models)
// All calls routed through https://ai.gateway.lovable.dev/v1/chat/completions

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

if (LOVABLE_API_KEY) {
  console.log("AI Client: Using Lovable AI Gateway (Gemini 3.1)");
} else {
  console.warn("AI Client: LOVABLE_API_KEY not configured");
}

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

// Model aliases → Lovable AI Gateway model names
const MODEL_ALIASES: Record<string, string> = {
  "gemini-flash":      "google/gemini-3-flash-preview",
  "gemini-flash-lite": "google/gemini-2.5-flash-lite",
  "gemini-pro":        "google/gemini-3.1-pro-preview",
  "gemini-pro-3":      "google/gemini-3.1-pro-preview",
  "gemini-pro-legacy": "google/gemini-2.5-pro",
};

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

/**
 * Clean JSON response from markdown formatting
 */
function cleanJsonResponse(content: string): string {
  let cleaned = content.trim();

  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);

  cleaned = cleaned.trim();

  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  return cleaned.trim();
}

/**
 * Chat completion via Lovable AI Gateway (OpenAI-compatible API)
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured. Enable Lovable AI in project settings.");
  }

  // Resolve model alias
  const modelAlias = options.model || "gemini-flash";
  const model = MODEL_ALIASES[modelAlias] || (modelAlias.startsWith("google/") || modelAlias.startsWith("openai/") ? modelAlias : DEFAULT_MODEL);

  const body: Record<string, unknown> = {
    model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };

  if (options.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Lovable AI Gateway error: ${response.status}`, errorText.substring(0, 500));

    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("Payment required. Add credits to your Lovable workspace.");
    }
    throw new Error(`AI Gateway error: ${response.status} - ${errorText.substring(0, 300)}`);
  }

  const data = await response.json();
  let result = data.choices?.[0]?.message?.content || "";

  if (!result) {
    console.error("AI Gateway returned empty content:", JSON.stringify(data).substring(0, 500));
    throw new Error("AI Gateway returned empty response");
  }

  if (options.responseFormat === "json") {
    result = cleanJsonResponse(result);
  }

  return result;
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
 * JSON generation (wrapper around chat with JSON instructions)
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

/**
 * Image generation placeholder
 */
export interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  style?: string;
}

export async function generateImage(options: ImageGenerationOptions): Promise<string | null> {
  console.log("Image generation requested:", options.prompt.substring(0, 100) + "...");
  return null;
}

// Shared AI Client - Uses direct APIs instead of Lovable Gateway
// Supports: Gemini (Google), OpenAI, Anthropic

const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

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

// Model mapping
const MODEL_MAP: Record<string, { provider: "google" | "openai" | "anthropic"; model: string }> = {
  // Gemini models
  "gemini-2.0-flash": { provider: "google", model: "gemini-2.0-flash-exp" },
  "gemini-2.5-flash": { provider: "google", model: "gemini-2.0-flash-exp" }, // Alias
  "gemini-flash": { provider: "google", model: "gemini-2.0-flash-exp" },
  "gemini-pro": { provider: "google", model: "gemini-1.5-pro" },
  // OpenAI models
  "gpt-4o": { provider: "openai", model: "gpt-4o" },
  "gpt-4o-mini": { provider: "openai", model: "gpt-4o-mini" },
  "gpt-4": { provider: "openai", model: "gpt-4-turbo" },
  // Anthropic models
  "claude-sonnet": { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  "claude-haiku": { provider: "anthropic", model: "claude-haiku-4-20250514" },
  // Lovable aliases (map to real models)
  "google/gemini-2.5-flash": { provider: "google", model: "gemini-2.0-flash-exp" },
  "google/gemini-3-flash-preview": { provider: "google", model: "gemini-2.0-flash-exp" },
  "google/gemini-3-pro-image-preview": { provider: "google", model: "gemini-2.0-flash-exp" },
};

// Default model
const DEFAULT_MODEL = "gemini-flash";

/**
 * Chat completion with automatic provider routing
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const modelKey = options.model || DEFAULT_MODEL;
  const config = MODEL_MAP[modelKey] || MODEL_MAP[DEFAULT_MODEL];
  
  switch (config.provider) {
    case "google":
      return chatWithGemini(messages, config.model, options);
    case "openai":
      return chatWithOpenAI(messages, config.model, options);
    case "anthropic":
      return chatWithAnthropic(messages, config.model, options);
    default:
      return chatWithGemini(messages, "gemini-2.0-flash-exp", options);
  }
}

/**
 * Chat with Gemini (Google AI)
 */
async function chatWithGemini(
  messages: ChatMessage[],
  model: string,
  options: ChatOptions
): Promise<string> {
  if (!GOOGLE_AI_KEY) {
    throw new Error("GOOGLE_AI_KEY not configured");
  }

  // Convert messages to Gemini format
  const systemInstruction = messages
    .filter(m => m.role === "system")
    .map(m => m.content)
    .join("\n");
  
  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 4096,
    }
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  if (options.responseFormat === "json") {
    body.generationConfig = {
      ...body.generationConfig as object,
      responseMimeType: "application/json"
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_AI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini API error:", response.status, error);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/**
 * Chat with OpenAI
 */
async function chatWithOpenAI(
  messages: ChatMessage[],
  model: string,
  options: ChatOptions
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };

  if (options.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("OpenAI API error:", response.status, error);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Chat with Anthropic
 */
async function chatWithAnthropic(
  messages: ChatMessage[],
  model: string,
  options: ChatOptions
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  // Extract system message
  const systemMessage = messages.find(m => m.role === "system")?.content;
  const chatMessages = messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role, content: m.content }));

  const body: Record<string, unknown> = {
    model,
    messages: chatMessages,
    max_tokens: options.maxTokens ?? 4096,
  };

  if (systemMessage) {
    body.system = systemMessage;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Anthropic API error:", response.status, error);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

/**
 * Generate image with Gemini Imagen (or fallback)
 * Note: Gemini's image generation is limited - this uses text-to-image via Gemini
 */
export async function generateImage(options: ImageGenerationOptions): Promise<string | null> {
  // For now, we can't generate images directly without Imagen API access
  // Return null and let the caller handle it (e.g., use placeholder or skip)
  console.log("Image generation requested but not available without Imagen API");
  console.log("Prompt:", options.prompt.substring(0, 100) + "...");
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

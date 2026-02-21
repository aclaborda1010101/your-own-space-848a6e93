// AI Client - Native API integrations (OpenAI, Anthropic Claude, Google Gemini)
// Priority: Google Gemini > OpenAI > Anthropic Claude

const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Determine which API to use
const USE_GEMINI = !!GOOGLE_AI_API_KEY;
const USE_OPENAI = !USE_GEMINI && !!OPENAI_API_KEY;
const USE_CLAUDE = !USE_GEMINI && !USE_OPENAI && !!ANTHROPIC_API_KEY;

// Log which API is being used
if (USE_GEMINI) {
  console.log("AI Client: Using Google Gemini");
} else if (USE_OPENAI) {
  console.log("AI Client: Using OpenAI GPT-4");
} else if (USE_CLAUDE) {
  console.log("AI Client: Using Anthropic Claude");
} else {
  console.warn("AI Client: No API keys configured. Set GOOGLE_AI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.");
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

// Model aliases -> real model names
const GEMINI_MODEL_ALIASES: Record<string, string> = {
  "gemini-flash": "gemini-2.0-flash",
  "gemini-pro": "gemini-2.5-pro",
  "gemini-pro-3": "gemini-2.5-pro",
  "gemini-pro-legacy": "gemini-1.5-pro",
};

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

/**
 * Clean JSON response from markdown formatting
 */
function cleanJsonResponse(content: string): string {
  let cleaned = content.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  cleaned = cleaned.trim();

  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  return cleaned.trim();
}

/**
 * Convert messages format for Claude API
 */
function formatMessagesForClaude(messages: ChatMessage[]): {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const systemMessages = messages.filter(m => m.role === "system");
  const conversationMessages = messages.filter(m => m.role !== "system");

  return {
    system: systemMessages.map(m => m.content).join("\n\n") || "You are a helpful assistant.",
    messages: conversationMessages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  };
}

/**
 * Chat completion using Google Gemini API
 */
async function chatWithGemini(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const modelAlias = options.model || "gemini-flash";
  const model = GEMINI_MODEL_ALIASES[modelAlias] || modelAlias;

  // Convert messages to Gemini format
  const systemMessages = messages.filter(m => m.role === "system");
  const conversationMessages = messages.filter(m => m.role !== "system");

  const systemInstruction = systemMessages.length > 0
    ? { parts: [{ text: systemMessages.map(m => m.content).join("\n\n") }] }
    : undefined;

  const contents = conversationMessages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 4096,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }

  if (options.responseFormat === "json") {
    body.generationConfig = {
      ...(body.generationConfig as Record<string, unknown>),
      responseMimeType: "application/json",
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_AI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini API error:", response.status, error);

    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("Invalid GOOGLE_AI_API_KEY. Please check your API key.");
    }

    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  let result = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (options.responseFormat === "json") {
    result = cleanJsonResponse(result);
  }

  return result;
}

/**
 * Chat completion using OpenAI GPT-4
 */
async function chatWithOpenAI(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const body: Record<string, unknown> = {
    model: "gpt-4o",
    messages: messages.map(m => ({ role: m.role, content: m.content })),
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("OpenAI API error:", response.status, error);
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again later.");
    if (response.status === 401) throw new Error("Invalid OPENAI_API_KEY. Please check your API key.");
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Chat completion using Anthropic Claude API
 */
async function chatWithClaude(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  let { system, messages: formattedMessages } = formatMessagesForClaude(messages);

  if (options.responseFormat === "json") {
    system += "\n\nCRITICAL: You MUST respond with ONLY valid JSON. No markdown code blocks, no explanations. Just the raw JSON object starting with { and ending with }.";
  }

  const body: Record<string, unknown> = {
    model: CLAUDE_MODEL,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    system,
    messages: formattedMessages,
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Anthropic API error:", response.status, error);
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again later.");
    if (response.status === 401) throw new Error("Invalid ANTHROPIC_API_KEY. Please check your API key.");
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const textContent = data.content?.find((block: { type: string }) => block.type === "text");
  let result = textContent?.text || "";

  if (options.responseFormat === "json") {
    result = cleanJsonResponse(result);
  }

  return result;
}

/**
 * Main chat function - routes to the available provider
 * If model contains "gemini" and GOOGLE_AI_API_KEY exists, always use Gemini
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  // If a Gemini model is explicitly requested and key exists, use Gemini
  const isGeminiModel = options.model && (
    options.model.includes("gemini") || GEMINI_MODEL_ALIASES[options.model]
  );

  if (isGeminiModel && GOOGLE_AI_API_KEY) {
    return chatWithGemini(messages, options);
  }

  // Default priority: Gemini > OpenAI > Claude
  if (USE_GEMINI) return chatWithGemini(messages, options);
  if (USE_OPENAI) return chatWithOpenAI(messages, options);
  if (USE_CLAUDE) return chatWithClaude(messages, options);

  throw new Error("No AI API configured. Set GOOGLE_AI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.");
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

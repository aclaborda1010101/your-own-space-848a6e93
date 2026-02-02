// AI Client - Uses Anthropic Claude API for portability
// This provides access to Claude models using the user's ANTHROPIC_API_KEY
// Falls back to Lovable AI Gateway if ANTHROPIC_API_KEY is not set

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// Determine which API to use
const USE_CLAUDE = !!ANTHROPIC_API_KEY;

// Log which API is being used
if (USE_CLAUDE) {
  console.log("AI Client: Using Anthropic Claude API");
} else if (LOVABLE_API_KEY) {
  console.log("AI Client: Fallback to Lovable AI Gateway (ANTHROPIC_API_KEY not found)");
} else {
  console.warn("AI Client: No API keys configured. AI functions will fail.");
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

// Claude model - using the latest Sonnet
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

// Lovable AI Gateway model aliases (fallback)
const LOVABLE_MODEL_ALIASES: Record<string, string> = {
  "gemini-flash": "google/gemini-2.5-flash",
  "gemini-pro": "google/gemini-2.5-pro",
  "gpt-5": "openai/gpt-5",
  "gpt-5-mini": "openai/gpt-5-mini",
};

const DEFAULT_LOVABLE_MODEL = "google/gemini-2.5-flash";

/**
 * Convert messages format for Claude API
 * Claude expects system message separately
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
 * Chat completion using Anthropic Claude API
 */
async function chatWithClaude(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const { system, messages: formattedMessages } = formatMessagesForClaude(messages);

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

    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 401) {
      throw new Error("Invalid ANTHROPIC_API_KEY. Please check your API key.");
    }
    if (response.status === 402) {
      throw new Error("Payment required. Please check your Anthropic account.");
    }

    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Claude returns content as an array of content blocks
  const textContent = data.content?.find((block: { type: string }) => block.type === "text");
  return textContent?.text || "";
}

/**
 * Chat completion using Lovable AI Gateway (fallback)
 */
async function chatWithLovable(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const model = options.model && LOVABLE_MODEL_ALIASES[options.model] 
    ? LOVABLE_MODEL_ALIASES[options.model] 
    : DEFAULT_LOVABLE_MODEL;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };

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
 * Main chat function - uses Claude if available, falls back to Lovable AI
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  if (USE_CLAUDE) {
    return chatWithClaude(messages, options);
  }
  
  if (LOVABLE_API_KEY) {
    return chatWithLovable(messages, options);
  }

  throw new Error("No AI API configured. Set ANTHROPIC_API_KEY for Claude or ensure LOVABLE_API_KEY is available.");
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
  // For Claude, we need to add JSON instructions in the prompt
  // For Lovable, we can use response_format
  const jsonPrompt = USE_CLAUDE 
    ? `${prompt}\n\nIMPORTANT: Respond ONLY with valid JSON. No explanations, no markdown code blocks, just the raw JSON object.`
    : prompt;

  const result = await chat(
    [{ role: "user", content: jsonPrompt }],
    { ...options, responseFormat: USE_CLAUDE ? "text" : "json" }
  );

  // Clean up potential markdown formatting
  let cleaned = result.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return JSON.parse(cleaned.trim()) as T;
}

/**
 * Image generation placeholder (not supported via Claude directly)
 */
export interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  style?: string;
}

export async function generateImage(options: ImageGenerationOptions): Promise<string | null> {
  console.log("Image generation requested:", options.prompt.substring(0, 100) + "...");
  console.log("Note: Image generation requires a separate service (e.g., Google Imagen 3)");
  return null;
}

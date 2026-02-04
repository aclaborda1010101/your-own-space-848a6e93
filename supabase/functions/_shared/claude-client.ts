// Claude AI Client - Uses Anthropic API directly for portability
// This provides access to Claude models using the user's ANTHROPIC_API_KEY

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Validate API key on module load
if (!ANTHROPIC_API_KEY) {
  console.warn("ANTHROPIC_API_KEY not found in environment. AI functions may fail.");
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

// Claude model aliases for convenience
const MODEL_ALIASES: Record<string, string> = {
  "claude": "claude-sonnet-4-20250514",
  "claude-sonnet": "claude-sonnet-4-20250514",
  "claude-opus": "claude-sonnet-4-20250514", // Fallback to sonnet
  "claude-haiku": "claude-sonnet-4-20250514", // Fallback to sonnet
  "claude-3-sonnet": "claude-sonnet-4-20250514",
  "claude-3-opus": "claude-sonnet-4-20250514",
  "claude-3-haiku": "claude-sonnet-4-20250514",
  "claude-sonnet-4-20250514": "claude-sonnet-4-20250514",
};

// Default model
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/**
 * Resolve model name to Claude model ID
 */
function resolveModel(modelKey?: string): string {
  if (!modelKey) return DEFAULT_MODEL;
  return MODEL_ALIASES[modelKey] || modelKey;
}

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
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const model = resolveModel(options.model);
  const { system, messages: formattedMessages } = formatMessagesForClaude(messages);

  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    system,
    messages: formattedMessages,
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
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
  const jsonPrompt = `${prompt}\n\nIMPORTANT: Respond ONLY with valid JSON. No explanations, no markdown code blocks, just the raw JSON object.`;
  
  const result = await chat(
    [{ role: "user", content: jsonPrompt }],
    options
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

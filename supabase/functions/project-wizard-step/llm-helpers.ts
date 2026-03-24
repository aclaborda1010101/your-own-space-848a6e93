/**
 * llm-helpers.ts — LLM call wrappers for Gemini Flash, Claude Sonnet, Gemini Pro
 * Extracted from index.ts to reduce bundle size.
 */

const FETCH_TIMEOUT_MS = 380_000;

function createTimeoutSignal(ms = FETCH_TIMEOUT_MS): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

export async function callGeminiFlash(systemPrompt: string, userPrompt: string) {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const { signal, clear } = createTimeoutSignal();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 65536, responseMimeType: "application/json" },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 404) {
        throw new Error(`Modelo Gemini no disponible. Verifica que tu API key tenga acceso al modelo solicitado. Detalle: ${err}`);
      }
      throw new Error(`Gemini API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const finishReason = data.candidates?.[0]?.finishReason || "UNKNOWN";
    const usage = data.usageMetadata || {};
    if (finishReason === "MAX_TOKENS") {
      console.warn(`[wizard] ⚠️ Gemini output TRUNCATED (finishReason=MAX_TOKENS). Output tokens: ${usage.candidatesTokenCount}`);
    }
    return {
      text,
      tokensInput: usage.promptTokenCount || 0,
      tokensOutput: usage.candidatesTokenCount || 0,
      finishReason,
    };
  } finally {
    clear();
  }
}

export async function callGeminiFlashMarkdown(systemPrompt: string, userPrompt: string) {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const { signal, clear } = createTimeoutSignal();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 16384 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const usage = data.usageMetadata || {};
    return {
      text,
      tokensInput: usage.promptTokenCount || 0,
      tokensOutput: usage.candidatesTokenCount || 0,
    };
  } finally {
    clear();
  }
}

export async function callClaudeSonnet(systemPrompt: string, userPrompt: string) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  const { signal, clear } = createTimeoutSignal();
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        temperature: 0.4,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const text = data.content?.find((b: { type: string }) => b.type === "text")?.text || "";
    return {
      text,
      tokensInput: data.usage?.input_tokens || 0,
      tokensOutput: data.usage?.output_tokens || 0,
    };
  } finally {
    clear();
  }
}

export async function callGeminiPro(systemPrompt: string, userPrompt: string) {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const model = "gemini-3.1-pro-preview";
  const { signal, clear } = createTimeoutSignal();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 16384 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 429) {
        console.warn(`[callGeminiPro] ${model} rate limited (429), falling back to Claude Sonnet 4...`);
        return await callClaudeSonnet(systemPrompt, userPrompt);
      }
      throw new Error(`Gemini API error (${model}): ${response.status} - ${err}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const usage = data.usageMetadata || {};
    return {
      text,
      tokensInput: usage.promptTokenCount || 0,
      tokensOutput: usage.candidatesTokenCount || 0,
    };
  } finally {
    clear();
  }
}

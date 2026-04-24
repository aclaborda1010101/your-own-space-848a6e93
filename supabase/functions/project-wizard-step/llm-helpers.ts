/**
 * llm-helpers.ts — LLM call wrappers via Lovable AI Gateway
 * Uses LOVABLE_API_KEY to call https://ai.gateway.lovable.dev/v1/chat/completions
 */

const FETCH_TIMEOUT_MS = 380_000;
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function createTimeoutSignal(ms = FETCH_TIMEOUT_MS): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function getApiKey(): string {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

interface LLMResult {
  text: string;
  tokensInput: number;
  tokensOutput: number;
  finishReason?: string;
}

const TRANSIENT_STATUSES = new Set([500, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1500;

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function callGateway(
  systemPrompt: string,
  userPrompt: string,
  opts: {
    model: string;
    temperature: number;
    maxTokens: number;
    jsonMode?: boolean;
  }
): Promise<LLMResult> {
  const apiKey = getApiKey();

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const { signal, clear } = createTimeoutSignal();
    try {
      const body: Record<string, unknown> = {
        model: opts.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
      };

      if (opts.jsonMode) {
        body.response_format = { type: "json_object" };
      }

      const response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 429) {
          throw Object.assign(new Error(`Rate limited (429): ${err}`), { status: 429 });
        }
        if (response.status === 402) {
          throw Object.assign(new Error(`Payment required (402): ${err}`), { status: 402 });
        }

        // Retry transient upstream errors (502/503/504/500) — typically Cloudflare/Gemini hiccups.
        if (TRANSIENT_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
          const wait = BASE_BACKOFF_MS * Math.pow(2, attempt);
          console.warn(
            `[wizard] AI Gateway transient ${response.status} on ${opts.model} (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${wait}ms...`,
          );
          lastError = new Error(`AI Gateway error (${opts.model}): ${response.status} - ${err.slice(0, 200)}`);
          await sleep(wait);
          continue;
        }

        throw new Error(`AI Gateway error (${opts.model}): ${response.status} - ${err}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";
      const finishReason = data.choices?.[0]?.finish_reason || "unknown";
      const usage = data.usage || {};

      if (finishReason === "length") {
        console.warn(`[wizard] ⚠️ Output TRUNCATED (finish_reason=length). Output tokens: ${usage.completion_tokens}`);
      }

      return {
        text,
        tokensInput: usage.prompt_tokens || 0,
        tokensOutput: usage.completion_tokens || 0,
        finishReason,
      };
    } catch (e) {
      // Network errors / aborts → retry too (but not auth/payment/rate-limit, which were thrown above).
      const status = (e as any)?.status;
      const isHardError = status === 429 || status === 402;
      if (!isHardError && attempt < MAX_RETRIES) {
        const wait = BASE_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(
          `[wizard] AI Gateway network/abort error on ${opts.model} (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${(e as Error).message}. Retrying in ${wait}ms...`,
        );
        lastError = e;
        await sleep(wait);
        continue;
      }
      throw e;
    } finally {
      clear();
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`AI Gateway error (${opts.model}): all retries exhausted`);
}


export async function callGeminiFlash(systemPrompt: string, userPrompt: string): Promise<LLMResult> {
  return callGateway(systemPrompt, userPrompt, {
    model: "google/gemini-2.5-flash",
    temperature: 0.2,
    maxTokens: 65536,
    jsonMode: true,
  });
}

export async function callGeminiFlashMarkdown(systemPrompt: string, userPrompt: string): Promise<LLMResult> {
  return callGateway(systemPrompt, userPrompt, {
    model: "google/gemini-2.5-flash",
    temperature: 0.3,
    maxTokens: 16384,
  });
}

export async function callClaudeSonnet(systemPrompt: string, userPrompt: string): Promise<LLMResult> {
  // Routed through gateway as flash equivalent
  return callGateway(systemPrompt, userPrompt, {
    model: "google/gemini-2.5-flash",
    temperature: 0.4,
    maxTokens: 8192,
  });
}

export async function callGeminiPro(systemPrompt: string, userPrompt: string): Promise<LLMResult> {
  try {
    return await callGateway(systemPrompt, userPrompt, {
      model: "google/gemini-2.5-pro",
      temperature: 0.4,
      maxTokens: 32768,
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 429) {
      console.warn(`[callGeminiPro] Pro rate limited (429), falling back to Flash...`);
      return await callGateway(systemPrompt, userPrompt, {
        model: "google/gemini-2.5-flash",
        temperature: 0.4,
        maxTokens: 32768,
      });
    }
    throw err;
  }
}

/** Low-temperature retry for JSON repair scenarios */
export async function callGatewayRetry(
  systemPrompt: string,
  userPrompt: string,
  model: "flash" | "pro"
): Promise<LLMResult> {
  return callGateway(systemPrompt, userPrompt, {
    model: model === "flash" ? "google/gemini-2.5-flash" : "google/gemini-2.5-pro",
    temperature: 0.1,
    maxTokens: 32768,
    jsonMode: model === "flash",
  });
}

export function extractEdgeFunctionMessage(payload: any, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;

  return payload.detail || payload.error || payload.message || fallback;
}

export async function getEdgeFunctionErrorMessage(error: unknown, fallback: string) {
  const candidate = error as any;

  const directMessage = extractEdgeFunctionMessage(candidate, "");
  if (directMessage) return directMessage;

  const context = candidate?.context;
  if (context && typeof context.text === "function") {
    try {
      const text = await context.text();
      if (!text) return fallback;

      try {
        const parsed = JSON.parse(text);
        return extractEdgeFunctionMessage(parsed, fallback);
      } catch {
        return text;
      }
    } catch {
      // Ignore parsing errors and continue to generic fallbacks
    }
  }

  if (candidate instanceof Error && candidate.message) {
    return candidate.message;
  }

  return fallback;
}

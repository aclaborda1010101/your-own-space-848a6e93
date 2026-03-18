export function extractEdgeFunctionMessage(payload: any, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;

  return payload.detail || payload.error || payload.message || fallback;
}

export async function getEdgeFunctionErrorMessage(error: unknown, fallback: string) {
  try {
    const candidate = error as any;

    // Direct properties on the error object
    const directMessage = extractEdgeFunctionMessage(candidate, "");
    if (directMessage) return directMessage;

    // Supabase FunctionsHttpError: context is a Response object
    const context = candidate?.context;
    if (context && typeof context === "object") {
      // If it's a Response object (has .json or .text methods)
      if (typeof context.json === "function") {
        try {
          // Clone to avoid "body already consumed" errors
          const cloned = typeof context.clone === "function" ? context.clone() : context;
          const json = await cloned.json();
          const msg = extractEdgeFunctionMessage(json, "");
          if (msg) return msg;
        } catch {
          // JSON parse failed, try text
          try {
            const cloned2 = typeof context.clone === "function" ? context.clone() : context;
            const text = typeof cloned2.text === "function" ? await cloned2.text() : null;
            if (text) return text;
          } catch {
            // ignore
          }
        }
      } else if (typeof context.text === "function") {
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
          // ignore
        }
      }
    }

    if (candidate instanceof Error && candidate.message) {
      return candidate.message;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

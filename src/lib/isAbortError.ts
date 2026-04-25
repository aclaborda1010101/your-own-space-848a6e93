export function isAbortError(error: unknown): boolean {
  const value = error as { name?: string; message?: string; details?: string; context?: unknown } | null | undefined;
  const message = `${value?.name ?? ""} ${value?.message ?? ""} ${value?.details ?? ""}`.toLowerCase();

  if (message.includes("aborterror") || message.includes("signal is aborted")) return true;

  const context = (value as any)?.context;
  if (context && typeof context === "object") {
    const nested = (context as any).value ?? context;
    return isAbortError(nested);
  }

  return false;
}
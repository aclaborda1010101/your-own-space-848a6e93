import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const JARVIS_SHELL = "v11-lime";
const JARVIS_STORAGE_KEYS = [
  "__jarvis_build_id",
  "__jarvis_reloaded",
  "__jarvis_preview_sw_reset_attempts",
  "__jarvis_preview_html_mismatch_attempts",
  "__jarvis_html_build_ts",
  "__jarvis_html_build_attempts",
  "__jarvis_active_shell",
  "__jarvis_shell_sentry_attempts",
  "__jarvis_auto_retry",
  "__jarvis_chunk_reload",
  "__jarvis_boot_auto_retry",
];

export const ForceRefreshButton = () => {
  const [loading, setLoading] = useState(false);

  const h = window.location.hostname;
  const show =
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.includes("lovableproject.com") ||
    h.includes("lovable.app");

  if (!show) return null;

  const handleForceRefresh = async () => {
    setLoading(true);
    try {
      // Nuke service workers
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      // Nuke cache storage
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {}

    // Clear all jarvis flags from both storages
    for (const key of JARVIS_STORAGE_KEYS) {
      try { localStorage.removeItem(key); } catch {}
      try { sessionStorage.removeItem(key); } catch {}
    }

    // Reload with canonical shell marker so the early guard doesn't loop.
    const url = new URL(window.location.href);
    url.searchParams.set("jarvis_shell", JARVIS_SHELL);
    url.searchParams.set("jarvis_cb", String(Date.now()));
    url.searchParams.delete("_cb");
    url.searchParams.delete("__jarvis_preview_bust");
    window.location.replace(url.toString());
  };

  return (
    <button
      onClick={handleForceRefresh}
      disabled={loading}
      title="Forzar actualización (limpia caché)"
      className={cn(
        "fixed bottom-40 right-4 z-50 lg:bottom-6 lg:right-20",
        "flex h-10 w-10 items-center justify-center rounded-full",
        "bg-primary/15 text-primary backdrop-blur-sm",
        "border border-primary/40 shadow-[0_0_12px_hsl(var(--primary)/0.35)]",
        "hover:bg-primary hover:text-primary-foreground",
        "transition-all duration-200",
        loading && "animate-spin"
      )}
    >
      <RefreshCw className="h-4 w-4" />
    </button>
  );
};

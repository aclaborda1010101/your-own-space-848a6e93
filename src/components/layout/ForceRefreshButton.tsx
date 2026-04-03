import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const JARVIS_STORAGE_KEYS = [
  "__jarvis_build_id",
  "__jarvis_reloaded",
  "__jarvis_preview_sw_reset_attempts",
  "__jarvis_auto_retry",
  "__jarvis_chunk_reload",
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

    // Reload with unified cache-buster
    const url = new URL(window.location.href);
    url.searchParams.set("_cb", String(Date.now()));
    url.searchParams.delete("__jarvis_preview_bust");
    window.location.replace(url.toString());
  };

  return (
    <button
      onClick={handleForceRefresh}
      disabled={loading}
      title="Forzar actualización"
      className={cn(
        "fixed bottom-24 right-4 z-50 lg:bottom-6",
        "flex h-10 w-10 items-center justify-center rounded-full",
        "bg-muted/80 text-muted-foreground backdrop-blur-sm",
        "border border-border shadow-md",
        "hover:bg-accent hover:text-accent-foreground",
        "transition-all duration-200",
        loading && "animate-spin"
      )}
    >
      <RefreshCw className="h-4 w-4" />
    </button>
  );
};

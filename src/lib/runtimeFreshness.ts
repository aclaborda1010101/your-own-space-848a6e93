/**
 * Runtime Freshness Guard v6 — SIMPLIFIED
 * Preview: nuke all SW/caches silently, never reload.
 * Published: one-time reload on build change, with anti-loop protection.
 */

declare const __APP_BUILD_ID__: string;

const BUILD_KEY = "__jarvis_build_id";
const RELOAD_DONE = "__jarvis_reloaded";

function isPreview(): boolean {
  try {
    const h = window.location.hostname;
    return (
      h === "localhost" ||
      h === "127.0.0.1" ||
      h.includes("lovableproject.com") ||
      h.includes("lovable.app") ||
      h.startsWith("preview--") ||
      h.startsWith("id-preview--")
    );
  } catch {
    return false;
  }
}

/** Nuke all service workers and caches. Fire-and-forget. */
function nukeSwAndCaches(): void {
  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((r) =>
        r.forEach((reg) => reg.unregister())
      ).catch(() => {});
    }
    if ("caches" in window) {
      caches.keys().then((k) => k.forEach((key) => caches.delete(key))).catch(() => {});
    }
  } catch {}
}

export function ensureRuntimeFreshness(): boolean {
  if (typeof window === "undefined") return false;

  try {
    // Preview: always nuke, never reload
    if (isPreview()) {
      nukeSwAndCaches();
      return false;
    }

    // Published: check build change
    const currentBuild =
      typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "";
    if (!currentBuild) return false;

    const savedBuild = localStorage.getItem(BUILD_KEY);
    localStorage.setItem(BUILD_KEY, currentBuild);

    // Same build or first visit — no action
    if (!savedBuild || savedBuild === currentBuild) return false;

    // Already reloaded for this transition — stop
    if (sessionStorage.getItem(RELOAD_DONE) === currentBuild) {
      sessionStorage.removeItem(RELOAD_DONE);
      return false;
    }

    // New build detected: nuke caches and reload once
    sessionStorage.setItem(RELOAD_DONE, currentBuild);
    nukeSwAndCaches();
    // Small delay to let SW unregister before reload
    setTimeout(() => window.location.reload(), 300);
    return true;
  } catch {
    return false;
  }
}

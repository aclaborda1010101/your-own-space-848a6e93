/**
 * Runtime Freshness Guard v7
 * Preview: nuke SW/caches and force one bypass reload only when an old SW controls the page.
 * Published: one-time reload on build change, with anti-loop protection.
 */

declare const __APP_BUILD_ID__: string;

const BUILD_KEY = "__jarvis_build_id";
const RELOAD_DONE = "__jarvis_reloaded";
const PREVIEW_RESET_ATTEMPTS_KEY = "__jarvis_preview_sw_reset_attempts";
const PREVIEW_RESET_MAX_ATTEMPTS = 2;

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
      navigator.serviceWorker
        .getRegistrations()
        .then((r) => r.forEach((reg) => reg.unregister()))
        .catch(() => {});
    }
    if ("caches" in window) {
      caches
        .keys()
        .then((k) => k.forEach((key) => caches.delete(key)))
        .catch(() => {});
    }
  } catch {
    // ignore
  }
}

function hasActiveSwController(): boolean {
  try {
    return !!navigator.serviceWorker?.controller;
  } catch {
    return false;
  }
}

function reloadWithPreviewBypass(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("__jarvis_preview_bust", Date.now().toString());
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

export function ensureRuntimeFreshness(): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (isPreview()) {
      const controlledBySw = hasActiveSwController();
      nukeSwAndCaches();

      if (!controlledBySw) {
        sessionStorage.removeItem(PREVIEW_RESET_ATTEMPTS_KEY);
        return false;
      }

      const attempts = Number(sessionStorage.getItem(PREVIEW_RESET_ATTEMPTS_KEY) || "0");
      if (attempts < PREVIEW_RESET_MAX_ATTEMPTS) {
        sessionStorage.setItem(PREVIEW_RESET_ATTEMPTS_KEY, String(attempts + 1));
        setTimeout(reloadWithPreviewBypass, 250);
        return true;
      }

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
    setTimeout(() => window.location.reload(), 300);
    return true;
  } catch {
    return false;
  }
}

/**
 * Runtime Freshness Guard v10
 * Non-destructive: never nukes auth tokens during background→foreground transitions.
 * Only nukes caches/SW when a *new build* is detected.
 * v10: Skip entirely on Capacitor native (reload blanks the WebView on iOS).
 */

declare const __APP_BUILD_ID__: string;

const BUILD_KEY = "__jarvis_build_id";
const RELOAD_DONE = "__jarvis_reloaded";
const PREVIEW_RESET_ATTEMPTS_KEY = "__jarvis_preview_sw_reset_attempts";
const PREVIEW_HTML_MISMATCH_KEY = "__jarvis_preview_html_mismatch_attempts";
const PREVIEW_RESET_MAX_ATTEMPTS = 2;
let sleepDetectorInstalled = false;

// ── Platform detection ──────────────────────────────────────────

function isCapacitorNative(): boolean {
  try {
    // Capacitor sets this on the window object
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

// ── Host detection ──────────────────────────────────────────────

function isPreview(): boolean {
  try {
    const h = window.location.hostname;
    return (
      h === "localhost" ||
      h === "127.0.0.1" ||
      h.includes("lovableproject.com") ||
      h.startsWith("preview--") ||
      h.startsWith("id-preview--")
    );
  } catch {
    return false;
  }
}

function isLovablePublishedHost(): boolean {
  try {
    const h = window.location.hostname;
    return h.includes("lovable.app") && !h.startsWith("preview--") && !h.startsWith("id-preview--");
  } catch {
    return false;
  }
}

// ── Helpers ─────────────────────────────────────────────────────

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
  } catch {}
}

function hasActiveSwController(): boolean {
  try {
    return !!navigator.serviceWorker?.controller;
  } catch {
    return false;
  }
}

/** Replace or append `_cb` param. Used only for build-change reloads. */
function buildFreshUrl(): string {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("_cb", Date.now().toString());
    url.searchParams.delete("__jarvis_preview_bust");
    return url.toString();
  } catch {
    return window.location.href;
  }
}

function navigateToFreshUrl(): void {
  try {
    window.location.replace(buildFreshUrl());
  } catch {
    window.location.reload();
  }
}

function getCurrentBuild(): string {
  try {
    return typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "";
  } catch {
    return "";
  }
}

/** Returns true if a reload was scheduled (caller should abort mount). */
function handleBuildChange(): boolean {
  const currentBuild = getCurrentBuild();
  if (!currentBuild) return false;

  const savedBuild = localStorage.getItem(BUILD_KEY);
  localStorage.setItem(BUILD_KEY, currentBuild);

  if (!savedBuild || savedBuild === currentBuild) return false;

  // Already reloaded for this transition — stop loop
  if (sessionStorage.getItem(RELOAD_DONE) === currentBuild) {
    sessionStorage.removeItem(RELOAD_DONE);
    return false;
  }

  sessionStorage.setItem(RELOAD_DONE, currentBuild);
  nukeSwAndCaches();
  setTimeout(navigateToFreshUrl, 300);
  return true;
}

// ── Resume-from-sleep detector ──────────────────────────────────
// Never reload on focus/pageshow: long-running flows and OAuth refreshes must
// keep their in-memory state. Freshness is handled only by build-change checks.

function installSleepDetector(): void {
  if (sleepDetectorInstalled) return;
  sleepDetectorInstalled = true;
}

// ── Main entry ──────────────────────────────────────────────────

export function ensureRuntimeFreshness(): boolean {
  if (typeof window === "undefined") return false;

  // Capacitor native: the WebView serves local files, reload() can blank the screen.
  // Build-change and sleep detection are meaningless here.
  if (isCapacitorNative()) return false;

  try {
    // Published lovable.app — only nuke when build changed
    if (isLovablePublishedHost()) {
      return handleBuildChange();
    }

    // Preview — only the SW-controlled escape hatch nukes caches
    if (isPreview()) {
      const controlledBySw = hasActiveSwController();

      if (controlledBySw) {
        // SW from a previous session is hijacking the page → escape it.
        nukeSwAndCaches();
        const attempts = Number(sessionStorage.getItem(PREVIEW_RESET_ATTEMPTS_KEY) || "0");
        if (attempts < PREVIEW_RESET_MAX_ATTEMPTS) {
          sessionStorage.setItem(PREVIEW_RESET_ATTEMPTS_KEY, String(attempts + 1));
          setTimeout(navigateToFreshUrl, 250);
          return true;
        }
      } else {
        sessionStorage.removeItem(PREVIEW_RESET_ATTEMPTS_KEY);
      }

      // Detect HTML-vs-bundle mismatch: if Lovable served a fresh index.html
      // (with a new build timestamp meta) but the iframe is running an older
      // JS bundle from cache, force one reload so the user sees today's UI
      // without having to interact first.
      if (htmlBuildMismatchesBundle()) {
        const attempts = Number(sessionStorage.getItem(PREVIEW_HTML_MISMATCH_KEY) || "0");
        if (attempts < PREVIEW_RESET_MAX_ATTEMPTS) {
          sessionStorage.setItem(PREVIEW_HTML_MISMATCH_KEY, String(attempts + 1));
          nukeSwAndCaches();
          setTimeout(navigateToFreshUrl, 200);
          return true;
        }
      } else {
        sessionStorage.removeItem(PREVIEW_HTML_MISMATCH_KEY);
      }

      return handleBuildChange();
    }

    // Other published hosts — build change only
    return handleBuildChange();
  } catch {
    return false;
  } finally {
    installSleepDetector();
  }
}

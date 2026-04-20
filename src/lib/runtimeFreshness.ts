/**
 * Runtime Freshness Guard v9
 * Non-destructive: never nukes auth tokens during background→foreground transitions.
 * Only nukes caches/SW when a *new build* is detected.
 */

declare const __APP_BUILD_ID__: string;

const BUILD_KEY = "__jarvis_build_id";
const RELOAD_DONE = "__jarvis_reloaded";
const PREVIEW_RESET_ATTEMPTS_KEY = "__jarvis_preview_sw_reset_attempts";
const PREVIEW_RESET_MAX_ATTEMPTS = 2;
// 30 minutes — short background returns must NOT trigger reloads
const SLEEP_THRESHOLD_MS = 30 * 60 * 1000;

let sleepDetectorInstalled = false;

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
// Only fires after VERY long absences (>30 min). Uses a soft reload that
// does NOT nuke caches or auth tokens.

function installSleepDetector(): void {
  if (sleepDetectorInstalled) return;
  sleepDetectorInstalled = true;

  let lastTick = Date.now();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      const gap = Date.now() - lastTick;
      if (gap > SLEEP_THRESHOLD_MS) {
        // Soft reload only. Do NOT nuke caches/SW (would invalidate session refresh in flight).
        try { window.location.reload(); } catch { /* ignore */ }
      }
      lastTick = Date.now();
    }
  });

  setInterval(() => { lastTick = Date.now(); }, 10_000);
}

// ── Main entry ──────────────────────────────────────────────────

export function ensureRuntimeFreshness(): boolean {
  if (typeof window === "undefined") return false;

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

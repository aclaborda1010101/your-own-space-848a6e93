/**
 * Runtime Freshness Guard v3
 * - Compares build ID to detect new deploys.
 * - On Preview hosts: cleans SW/caches in background, never blocks mount.
 * - On Published hosts: does ONE controlled reload when build changes.
 * - Returns true if a reload was triggered (caller should abort mount).
 */

declare const __APP_BUILD_ID__: string;

const BUILD_KEY = "__jarvis_build_id";
const RELOAD_KEY = "__jarvis_freshness_reload";
const RELOAD_TS_KEY = "__jarvis_freshness_ts";

function isPreviewHost(): boolean {
  try {
    const h = window.location.hostname;
    return h.includes("lovableproject.com") || h.includes("id-preview--") || h === "localhost";
  } catch {
    return false;
  }
}

/**
 * Call before mounting React.
 * Returns `true` if a reload was triggered — caller must abort.
 */
export function ensureRuntimeFreshness(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const currentBuild =
      typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "";
    if (!currentBuild) return false; // dev mode, skip

    const savedBuild = localStorage.getItem(BUILD_KEY);
    localStorage.setItem(BUILD_KEY, currentBuild);

    // Same build — clear stale flags
    if (savedBuild === currentBuild) {
      sessionStorage.removeItem(RELOAD_KEY);
      return false;
    }

    // First visit ever — store, no reload
    if (!savedBuild) return false;

    // ── New build detected ──

    // Preview: clean in background, never block
    if (isPreviewHost()) {
      backgroundClean();
      return false;
    }

    // Published: reload once per build transition
    const reloadedFor = sessionStorage.getItem(RELOAD_KEY);
    if (reloadedFor === `${savedBuild}->${currentBuild}`) {
      // Already reloaded for this exact transition
      sessionStorage.removeItem(RELOAD_KEY);
      return false;
    }

    // Anti-loop: if we reloaded less than 30s ago, don't loop
    const lastTs = Number(sessionStorage.getItem(RELOAD_TS_KEY) || "0");
    if (Date.now() - lastTs < 30000) {
      sessionStorage.removeItem(RELOAD_KEY);
      return false;
    }

    // Trigger one clean reload
    sessionStorage.setItem(RELOAD_KEY, `${savedBuild}->${currentBuild}`);
    sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));

    cleanWithTimeout().finally(() => {
      window.location.reload();
    });

    return true; // signal caller to abort mount
  } catch {
    return false;
  }
}

/** Clean SW + caches with a 3s timeout so we never hang */
function cleanWithTimeout(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    Promise.all([cleanServiceWorkers(), cleanCaches()]).finally(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** Background clean for preview — fire and forget */
function backgroundClean(): void {
  cleanServiceWorkers().catch(() => {});
  cleanCaches().catch(() => {});
}

async function cleanServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    // ignore
  }
}

async function cleanCaches(): Promise<void> {
  if (!("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    // ignore
  }
}

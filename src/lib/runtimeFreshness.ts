/**
 * Runtime Freshness Guard v2
 * - Compares build ID to detect new deploys.
 * - Clears SW + caches and does ONE controlled reload when build changes.
 * - Works in both preview iframe and published top-level.
 * - Returns true if a reload was triggered (caller should abort mount).
 */

declare const __APP_BUILD_ID__: string;

const BUILD_KEY = "__jarvis_build_id";
const RELOAD_KEY = "__jarvis_freshness_reloaded";

/**
 * Call before mounting React.
 * Returns `true` if a reload was triggered — caller must abort.
 */
export function ensureRuntimeFreshness(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const currentBuild = typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "";
    if (!currentBuild) return false; // dev mode, skip

    const savedBuild = localStorage.getItem(BUILD_KEY);
    localStorage.setItem(BUILD_KEY, currentBuild);

    // Same build → nothing to do, clear any leftover reload flag
    if (savedBuild === currentBuild) {
      sessionStorage.removeItem(RELOAD_KEY);
      return false;
    }

    // Different build detected
    if (!savedBuild) {
      // First visit ever — just store, no reload needed
      return false;
    }

    // Already did one reload for this build change — don't loop
    if (sessionStorage.getItem(RELOAD_KEY) === currentBuild) {
      sessionStorage.removeItem(RELOAD_KEY);
      return false;
    }

    // New deploy detected → clean everything and reload once
    sessionStorage.setItem(RELOAD_KEY, currentBuild);

    Promise.all([cleanServiceWorkers(), cleanCaches()]).finally(() => {
      window.location.reload();
    });

    return true; // signal caller to abort mount
  } catch {
    return false;
  }
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

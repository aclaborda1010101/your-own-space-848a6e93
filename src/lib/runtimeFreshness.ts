/**
 * Runtime Freshness Guard
 * In preview/published environments, unregisters service workers and clears caches
 * to prevent stale bundles. Never blocks initial render.
 */

const PREVIEW_PATTERNS = [
  "lovableproject.com",
  "lovable.app",
  "localhost",
  "127.0.0.1",
];

const URL_FLAG = "__jarvis_fresh";

function isPreviewEnv(): boolean {
  try {
    const host = window.location.hostname;
    return PREVIEW_PATTERNS.some((p) => host.includes(p));
  } catch {
    return false;
  }
}

function hasFreshnessFlagInUrl(): boolean {
  try {
    return new URL(window.location.href).searchParams.get(URL_FLAG) === "1";
  } catch {
    return false;
  }
}

function cleanupFreshnessFlagFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(URL_FLAG)) return;
    url.searchParams.delete(URL_FLAG);
    window.history.replaceState({}, "", url.toString());
  } catch {
    // ignore
  }
}

function reloadWithFreshnessFlag(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(URL_FLAG, "1");
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

/**
 * Non-blocking freshness check. Safe to call at any point —
 * never throws, never blocks rendering.
 */
export function ensureRuntimeFreshness(): void {
  if (typeof window === "undefined") return;
  if (!isPreviewEnv()) return;

  // Already performed one controlled refresh for this URL, allow boot
  if (hasFreshnessFlagInUrl()) {
    cleanupFreshnessFlagFromUrl();
    return;
  }

  // Guard against duplicate runs
  if ((window as any).__jarvisFreshnessRunning) return;
  (window as any).__jarvisFreshnessRunning = true;

  Promise.all([cleanServiceWorkers(), cleanCaches()])
    .then(([swCleaned, cacheCleaned]) => {
      if (swCleaned || cacheCleaned) {
        reloadWithFreshnessFlag();
      } else {
        (window as any).__jarvisFreshnessRunning = false;
      }
    })
    .catch(() => {
      (window as any).__jarvisFreshnessRunning = false;
    });
}

async function cleanServiceWorkers(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length === 0) return false;
    await Promise.all(regs.map((r) => r.unregister()));
    return true;
  } catch {
    return false;
  }
}

async function cleanCaches(): Promise<boolean> {
  if (!("caches" in window)) return false;
  try {
    const keys = await caches.keys();
    if (keys.length === 0) return false;
    await Promise.all(keys.map((k) => caches.delete(k)));
    return true;
  } catch {
    return false;
  }
}


/**
 * Runtime Freshness Guard
 * In preview environments, unregisters service workers and clears caches
 * to prevent stale bundles. Throws to halt execution if a reload is needed.
 */

const PREVIEW_PATTERNS = [
  'lovableproject.com',
  'localhost',
  '127.0.0.1',
];

function isPreviewEnv(): boolean {
  try {
    const host = window.location.hostname;
    return PREVIEW_PATTERNS.some((p) => host.includes(p));
  } catch {
    return false;
  }
}

const RELOAD_FLAG = '__jarvis_freshness_reload__';

/**
 * Synchronous check. If we already reloaded, clear flag and return.
 * Otherwise schedule async cleanup + reload and throw to stop boot.
 */
export function ensureRuntimeFreshness(): void {
  if (typeof window === 'undefined') return;
  if (!isPreviewEnv()) return;

  // Already reloaded once — allow boot
  if (sessionStorage.getItem(RELOAD_FLAG)) {
    sessionStorage.removeItem(RELOAD_FLAG);
    return;
  }

  // Schedule async cleanup; if anything was dirty, reload
  scheduleCleanup();
}

function scheduleCleanup(): void {
  Promise.all([cleanServiceWorkers(), cleanCaches()]).then(([swCleaned, cacheCleaned]) => {
    if (swCleaned || cacheCleaned) {
      try { sessionStorage.setItem(RELOAD_FLAG, '1'); } catch { /* ignore */ }
      window.location.reload();
    }
  }).catch(() => { /* ignore */ });
}

async function cleanServiceWorkers(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
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
  if (!('caches' in window)) return false;
  try {
    const keys = await caches.keys();
    if (keys.length === 0) return false;
    await Promise.all(keys.map((k) => caches.delete(k)));
    return true;
  } catch {
    return false;
  }
}

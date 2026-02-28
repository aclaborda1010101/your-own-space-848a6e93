/**
 * Runtime Freshness Guard
 * In preview/published environments, unregisters service workers and clears caches
 * to prevent stale bundles. Never blocks initial render.
 */

const PREVIEW_PATTERNS = [
  'lovableproject.com',
  'lovable.app',
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

// Safe sessionStorage helpers
function safeGetFlag(): boolean {
  try { return sessionStorage.getItem(RELOAD_FLAG) === '1'; } catch { return false; }
}
function safeSetFlag(): void {
  try { sessionStorage.setItem(RELOAD_FLAG, '1'); } catch { /* ignore */ }
}
function safeRemoveFlag(): void {
  try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* ignore */ }
}

/**
 * Non-blocking freshness check. Safe to call at any point —
 * never throws, never blocks rendering.
 */
export function ensureRuntimeFreshness(): void {
  if (typeof window === 'undefined') return;
  if (!isPreviewEnv()) return;

  // Already reloaded once — allow boot
  if (safeGetFlag()) {
    safeRemoveFlag();
    return;
  }

  // Guard against duplicate runs
  if ((window as any).__jarvisFreshnessRunning) return;
  (window as any).__jarvisFreshnessRunning = true;

  // Schedule async cleanup
  scheduleCleanup();
}

function scheduleCleanup(): void {
  Promise.all([cleanServiceWorkers(), cleanCaches()])
    .then(([swCleaned, cacheCleaned]) => {
      if (swCleaned || cacheCleaned) {
        safeSetFlag();
        window.location.reload();
      } else {
        (window as any).__jarvisFreshnessRunning = false;
      }
    })
    .catch(() => {
      (window as any).__jarvisFreshnessRunning = false;
    });
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

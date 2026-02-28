/**
 * Runtime Freshness Guard
 * In preview/dev environments, unregisters service workers and clears caches
 * to prevent stale bundles from being served after deployments.
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

export async function ensureRuntimeFreshness(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isPreviewEnv()) return;

  const RELOAD_FLAG = '__jarvis_freshness_reload__';

  // Prevent infinite reload loop
  if (sessionStorage.getItem(RELOAD_FLAG)) {
    sessionStorage.removeItem(RELOAD_FLAG);
    return;
  }

  let didClean = false;

  // 1. Unregister all service workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
        didClean = true;
      }
    } catch {
      // ignore
    }
  }

  // 2. Clear all caches
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
        didClean = true;
      }
    } catch {
      // ignore
    }
  }

  // 3. If we cleaned something, do ONE controlled reload
  if (didClean) {
    try {
      sessionStorage.setItem(RELOAD_FLAG, '1');
    } catch {
      // ignore
    }
    window.location.reload();
  }
}

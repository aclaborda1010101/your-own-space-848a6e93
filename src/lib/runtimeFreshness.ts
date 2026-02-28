/**
 * Runtime Freshness Guard v4
 * - Preview: NEVER forces reload (avoids preview loops), background clean only.
 * - Published: controlled one-time reload when build truly changes.
 */

declare const __APP_BUILD_ID__: string;

const BUILD_KEY = "__jarvis_build_id";
const RELOAD_KEY = "__jarvis_freshness_reload";
const RELOAD_TS_KEY = "__jarvis_freshness_ts";

function isPreviewHost(): boolean {
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

export function ensureRuntimeFreshness(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const currentBuild =
      typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "";
    if (!currentBuild) return false;

    const savedBuild = localStorage.getItem(BUILD_KEY);
    localStorage.setItem(BUILD_KEY, currentBuild);

    // Preview: never block/start loops
    if (isPreviewHost()) {
      if (savedBuild && savedBuild !== currentBuild) {
        backgroundClean();
      }
      return false;
    }

    // Published: normal behavior
    if (savedBuild === currentBuild) {
      sessionStorage.removeItem(RELOAD_KEY);
      return false;
    }

    if (!savedBuild) return false;

    const transition = `${savedBuild}->${currentBuild}`;
    if (sessionStorage.getItem(RELOAD_KEY) === transition) {
      sessionStorage.removeItem(RELOAD_KEY);
      return false;
    }

    const lastTs = Number(sessionStorage.getItem(RELOAD_TS_KEY) || "0");
    if (Date.now() - lastTs < 30000) {
      return false;
    }

    sessionStorage.setItem(RELOAD_KEY, transition);
    sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));

    cleanWithTimeout().finally(() => {
      window.location.reload();
    });

    return true;
  } catch {
    return false;
  }
}

function cleanWithTimeout(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    Promise.all([cleanServiceWorkers(), cleanCaches()]).finally(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function backgroundClean(): void {
  cleanServiceWorkers().catch(() => {});
  cleanCaches().catch(() => {});
}

async function cleanServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {}
}

async function cleanCaches(): Promise<void> {
  if (!("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {}
}

// cache-bust: 2026-05-05T18:30-v11-lime-final-purge
import "./index.css";
import { initSafeStorage } from "./lib/safeStorage";
import { ensureRuntimeFreshness } from "./lib/runtimeFreshness";
import { bootNativeChrome } from "./lib/native/nativeBoot";
import { createRoot } from "react-dom/client";
import App from "./App";

declare const __APP_BUILD_ID__: string;
const ACTIVE_SHELL = "v11-lime";
(window as any).__JARVIS_ACTIVE_SHELL = ACTIVE_SHELL;
try {
  document.documentElement.setAttribute("data-jarvis-shell", ACTIVE_SHELL);
  document.body?.setAttribute("data-jarvis-shell", ACTIVE_SHELL);
} catch {}
try {
  // eslint-disable-next-line no-console
  console.info(
    `[jarvis] active shell ${ACTIVE_SHELL} · build ${typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "?"}`
  );
} catch {}

// Runtime sentry — if after mount the DOM still shows markers from an older
// shell (e.g. "JARVIS v2.0" header, "Comunicaciones" menu item that no longer
// exists in v11), we are running a stale chunk on top of fresh HTML. Force one
// canonical reload instead of waiting for the user to interact.
function installShellSentry() {
  try {
    const h = window.location.hostname;
    const isPreview =
      h === "localhost" ||
      h === "127.0.0.1" ||
      h.includes("lovableproject.com") ||
      h.includes("lovable.app");
    if (!isPreview) return;

    const SENTRY_KEY = "__jarvis_shell_sentry_attempts";
    // Markers from old shells. "v2.0 — SISTEMA" was removed because the
    // current login legitimately had that text and was triggering reload loops.
    const STALE_MARKERS = ["JARVIS v2.0 · ONLINE", "JARVIS v2.0 — SISTEMA"];

    const check = () => {
      try {
        const text = document.body?.innerText || "";
        const stale = STALE_MARKERS.some((m) => text.includes(m));
        if (!stale) return;
        let n = 0;
        try { n = Number(sessionStorage.getItem(SENTRY_KEY) || "0"); } catch {}
        if (n >= 2) return;
        try { sessionStorage.setItem(SENTRY_KEY, String(n + 1)); } catch {}
        // eslint-disable-next-line no-console
        console.warn("[jarvis] stale shell detected at runtime → reloading");

        const cleanup = async () => {
          try {
            if ("serviceWorker" in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map((r) => r.unregister()));
            }
          } catch {}
          try {
            if ("caches" in window) {
              const ks = await caches.keys();
              await Promise.all(ks.map((k) => caches.delete(k)));
            }
          } catch {}
          for (const key of [
            "__jarvis_build_id",
            "__jarvis_reloaded",
            "__jarvis_html_build_ts",
            "__jarvis_active_shell",
            "__jarvis_html_build_attempts",
            "__jarvis_preview_sw_reset_attempts",
            "__jarvis_preview_html_mismatch_attempts",
            "__jarvis_chunk_reload",
            "__jarvis_auto_retry",
          ]) {
            try { localStorage.removeItem(key); } catch {}
            try { sessionStorage.removeItem(key); } catch {}
          }
          try {
            const u = new URL(window.location.href);
            u.searchParams.set("jarvis_shell", ACTIVE_SHELL);
            u.searchParams.set("jarvis_cb", String(Date.now()));
            u.searchParams.delete("_cb");
            window.location.replace(u.toString());
          } catch {
            window.location.reload();
          }
        };
        void cleanup();
      } catch {}
    };

    // Run a few delayed checks so lazy chunks have time to mount.
    setTimeout(check, 1500);
    setTimeout(check, 4000);
  } catch {}
}
(window as any).__jarvis_booting = true;
initSafeStorage();
// Configure native status bar / hide splash (no-op on web)
void bootNativeChrome();

// If a new build was detected, runtimeFreshness triggers a reload — abort mount.
const reloading = ensureRuntimeFreshness();

if (reloading) {
  // Page will reload momentarily; don't mount anything.
} else if (!(window as any).__jarvisRoot) {
  try {
    const rootEl = document.getElementById("root");
    if (!rootEl) throw new Error("Missing #root element");

    const root = createRoot(rootEl);
    root.render(<App />);
    (window as any).__jarvisRoot = root;

    // Remove boot fallback after React paints
    requestAnimationFrame(() => {
      const fallback = document.getElementById("__boot_fallback");
      if (fallback) fallback.remove();
    });

    installShellSentry();

    // PWA desactivado en frontend para evitar caché obsoleta de Service Worker
    // en despliegues frecuentes de Lovable/Railway.
  } catch (err) {
    console.error("JARVIS mount failed:", err);
    const status = document.getElementById("__boot_status");
    const retry = document.getElementById("__boot_retry");
    if (status) status.textContent = "Error al iniciar";
    if (retry) retry.style.display = "block";
  } finally {
    (window as any).__jarvis_booting = false;
    try { sessionStorage.removeItem("__jarvis_auto_retry"); } catch {}
    try { sessionStorage.removeItem("__jarvis_chunk_reload"); } catch {}
  }
}

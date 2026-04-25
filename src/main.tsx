// cache-bust: 2026-04-25T10:52
import "./index.css";
import { initSafeStorage } from "./lib/safeStorage";
import { ensureRuntimeFreshness } from "./lib/runtimeFreshness";
import { bootNativeChrome } from "./lib/native/nativeBoot";
import { createRoot } from "react-dom/client";
import App from "./App";

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

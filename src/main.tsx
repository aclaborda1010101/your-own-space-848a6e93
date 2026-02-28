import "./index.css";
import { initSafeStorage } from "./lib/safeStorage";
import { ensureRuntimeFreshness } from "./lib/runtimeFreshness";
import { createRoot } from "react-dom/client";
import App from "./App";

(window as any).__jarvis_booting = true;
initSafeStorage();

// If a new build was detected, runtimeFreshness triggers a reload — abort mount.
const reloading = ensureRuntimeFreshness();
if (reloading) {
  // Page will reload momentarily; don't mount anything.
} else if (!(window as any).__jarvisRoot) {
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Missing #root element");

  // Remove boot fallback once React takes over
  const fallback = document.getElementById("__boot_fallback");
  if (fallback) fallback.remove();

  // Clear auto-retry flag since we booted successfully
  try { sessionStorage.removeItem("__jarvis_auto_retry"); } catch {}
  try { sessionStorage.removeItem("__jarvis_chunk_reload"); } catch {}

  const root = createRoot(rootEl);
  root.render(<App />);
  (window as any).__jarvisRoot = root;
  (window as any).__jarvis_booting = false;
}

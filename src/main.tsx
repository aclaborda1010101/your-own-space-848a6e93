import "./index.css";
import { initSafeStorage } from "./lib/safeStorage";
import { ensureRuntimeFreshness } from "./lib/runtimeFreshness";
import { createRoot } from "react-dom/client";
import App from "./App";

(window as any).__jarvis_booting = true;
initSafeStorage();

// Prevent double mount on retry
if (!(window as any).__jarvisRoot) {
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Missing #root element");

  // Remove boot fallback once React takes over
  const fallback = document.getElementById("__boot_fallback");
  if (fallback) {
    fallback.remove();
  }

  const root = createRoot(rootEl);
  root.render(<App />);
  (window as any).__jarvisRoot = root;
  (window as any).__jarvis_booting = false;
}

// Freshness check runs async, after mount
setTimeout(() => {
  try { ensureRuntimeFreshness(); } catch { /* ignore */ }
}, 0);

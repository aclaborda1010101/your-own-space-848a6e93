import "./index.css";
import { initSafeStorage } from "./lib/safeStorage";
import { ensureRuntimeFreshness } from "./lib/runtimeFreshness";
import { createRoot } from "react-dom/client";
import App from "./App";

initSafeStorage();

// Render immediately — never block mount
createRoot(document.getElementById("root")!).render(<App />);

// Freshness check runs async, after mount
setTimeout(() => {
  try { ensureRuntimeFreshness(); } catch { /* ignore */ }
}, 0);

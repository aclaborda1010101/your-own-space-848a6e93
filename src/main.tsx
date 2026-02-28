import "./index.css";
import { initSafeStorage } from "./lib/safeStorage";
import { ensureRuntimeFreshness } from "./lib/runtimeFreshness";
import { createRoot } from "react-dom/client";
import App from "./App";

initSafeStorage();

// If freshness guard triggers a reload, it throws to stop execution
try {
  ensureRuntimeFreshness();
} catch {
  // Reload in progress — stop here
  throw new Error("Runtime freshness reload in progress");
}

createRoot(document.getElementById("root")!).render(<App />);

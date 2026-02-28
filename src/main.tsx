import "./index.css";
import { initSafeStorage } from "./lib/safeStorage";
import { ensureRuntimeFreshness } from "./lib/runtimeFreshness";

// Prevent blank screens in private/strict browser modes where storage APIs throw.
initSafeStorage();

// Defer app import until after storage is made safe.
// Retry on failure to handle Vite dev-server restarts gracefully.
const loadApp = (retries = 3): Promise<void> =>
  import("./bootstrap").then(() => {}).catch((err) => {
    if (retries > 0) {
      return new Promise<void>((res) => setTimeout(res, 1000)).then(() => loadApp(retries - 1));
    }
    document.getElementById("root")!.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><p>Error loading app. <a href="/" style="color:#3b82f6">Reload</a></p></div>';
    console.error("Failed to load app after retries:", err);
  });

// Ensure fresh bundle in preview, then boot app
ensureRuntimeFreshness().then(() => void loadApp());


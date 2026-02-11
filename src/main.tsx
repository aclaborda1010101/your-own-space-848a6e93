import "./index.css";
import { initSafeStorage } from "./lib/safeStorage";

// Prevent blank screens in private/strict browser modes where storage APIs throw.
initSafeStorage();

// Defer app import until after storage is made safe.
// Retry once on failure to handle transient network/server-restart errors.
void import("./bootstrap").catch(() => {
  setTimeout(() => {
    import("./bootstrap").catch((err) => {
      console.error("Failed to load app after retry:", err);
      document.getElementById("root")!.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#fff;background:#0f172a;flex-direction:column;gap:16px"><p>Error loading app. Please refresh.</p><button onclick="location.reload()" style="padding:8px 24px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#fff;cursor:pointer">Reload</button></div>';
    });
  }, 1500);
});


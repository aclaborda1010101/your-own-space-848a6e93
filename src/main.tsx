import "./index.css";
import { initSafeStorage } from "./lib/safeStorage";
import { ensureRuntimeFreshness } from "./lib/runtimeFreshness";
import { createRoot } from "react-dom/client";
import App from "./App";

initSafeStorage();
ensureRuntimeFreshness();
createRoot(document.getElementById("root")!).render(<App />);

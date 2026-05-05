import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const BUILD_ID =
  process.env.COMMIT_SHA ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  `build-${Date.now()}`;

// Inject the build id into index.html so runtimeFreshness can detect
// stale bundles served inside the Lovable preview iframe.
const buildIdHtmlPlugin = (): Plugin => ({
  name: "inject-build-id-into-html",
  transformIndexHtml(html) {
    return html.replace("__BUILD_TS__", BUILD_ID).replace("__BUILD_TS__", BUILD_ID);
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [".serveousercontent.com", ".loca.lt", ".ngrok.io", ".ngrok-free.app", "jarvis2026-production.up.railway.app", ".lovableproject.com", ".lovable.app"],
  },
  preview: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "jarvis2026-production.up.railway.app",
      ".railway.app",
      "localhost",
      ".lovableproject.com",
      ".lovable.app"
    ]
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  build: {},
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
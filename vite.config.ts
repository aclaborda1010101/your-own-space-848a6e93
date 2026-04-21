import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD_ID__: JSON.stringify(
      process.env.COMMIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GITHUB_SHA || `build-${Date.now()}`
    ),
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
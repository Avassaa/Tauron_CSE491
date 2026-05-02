import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Route actions (`POST /api/chat`, etc.) run in the Node process that starts Vite.
 * Client bundles only get `VITE_*` via import.meta.env — secrets must be on process.env.
 * Merge `.env` files before plugins run so `GEMINI_API_KEY` exists during SSR/actions.
 */
function mergeDotenvForNodeProcess() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "frontend", ".env"),
    path.join(process.cwd(), "frontend", ".env.local"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      loadDotenv({ path: p, override: true });
    }
  }
}

mergeDotenvForNodeProcess();

const internalApiOrigin =
  process.env.API_INTERNAL_ORIGIN?.trim() || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    proxy: {
      "/api/v1": {
        target: internalApiOrigin,
        changeOrigin: true,
      },
    },
  },
});

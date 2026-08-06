import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { progressFilesPlugin } from "./vite-plugin-progress-files";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Launch the OS default browser on `npm run dev`. Set BROWSER=none to skip
    // it (useful in CI, or when an editor already opens its own preview).
    open: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    // Lets the page read/write progresses/*.json on disk — see the plugin file.
    progressFilesPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // Production build: вырезаем отладочные console.log/debug/info из бандла
  esbuild:
    mode === "production"
      ? { pure: ["console.log", "console.debug", "console.info"] }
      : {},
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
    proxy: {
      "/api": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
  build: {
    // Разносим тяжёлые библиотеки в отдельные кэшируемые чанки
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          icons: ["lucide-react"],
          state: ["zustand"],
        },
      },
    },
  },
}));

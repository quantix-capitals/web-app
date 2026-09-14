import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  /**
   * `.env.local`, including the variables Vite would normally keep out of the
   * bundle. The empty prefix is what loads them: by default only `VITE_*` is
   * readable from client code, precisely so a stray secret cannot be shipped by
   * accident.
   *
   * Two are forwarded below — the OpenAI key and model the watchlist analyst runs
   * on — so the desk keeps every key in one file instead of pasting one into the
   * UI. Forwarding `OPENAI_API_KEY` means it is **in the built JavaScript**, which
   * is the whole trade-off documented at the top of
   * `src/lib/analyst/client.ts`: acceptable for a desk running its own build,
   * not for a deployed product. When the agent moves behind `apps/agent`, delete
   * the `define` block and the key goes back to being a server secret.
   */
  const env = loadEnv(mode, path.resolve(import.meta.dirname), "");

  return {
    plugins: [react(), tailwindcss()],
    define: {
      // `JSON.stringify` because `define` substitutes source text, not values — a
      // bare key would be compiled as an identifier. Empty string, never
      // `undefined`, so `import.meta.env.X` is always a defined expression.
      "import.meta.env.VITE_OPENAI_API_KEY": JSON.stringify(
        env.VITE_OPENAI_API_KEY || env.OPENAI_API_KEY || "",
      ),
      "import.meta.env.VITE_OPENAI_MODEL": JSON.stringify(
        env.VITE_OPENAI_MODEL || env.AGENT_MODEL || "",
      ),
    },
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "src") },
    },
    optimizeDeps: {
      // A workspace package shipped as TypeScript source. Pre-bundling it would
      // freeze a copy at dev-server start, so edits there wouldn't show up.
      exclude: ["@stealth/shared"],
    },
    build: {
      rollupOptions: {
        output: {
          // Split the large, stable libraries into their own long-cached chunks so
          // an app-code change doesn't bust them. three.js is the one that matters:
          // it is only ever used by the overview's canvas, and it is bigger than
          // the rest of the app put together.
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("/three/")) return "vendor-three";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("@tanstack")) return "vendor-query";
            if (
              id.includes("/react-router") ||
              id.includes("/react-dom/") ||
              id.includes("/react/") ||
              id.includes("/scheduler/")
            ) {
              return "vendor-react";
            }
          },
        },
      },
    },
    server: {
      // Pinned, not preferred. `strictPort` is the point: Zerodha will only
      // redirect back to the URL registered on the Kite app, so a dev server that
      // quietly moved to :3001 because something else held :3000 would break the
      // connect flow with an error that looks like it came from Kite.
      port: 3000,
      strictPort: true,
      proxy: {
        // The server half — see supabase/functions. Proxied so calls are
        // same-origin in dev and the functions need no CORS allowlist locally.
        // Point this at a deployed project instead to develop against it.
        "/functions/v1": {
          target: process.env.VITE_FUNCTIONS_PROXY ?? "http://127.0.0.1:54321",
          changeOrigin: true,
        },
      },
    },
    // `vite preview` serves the built app; same reasoning, same port.
    preview: {
      port: 3000,
      strictPort: true,
    },
  };
});

import { defineConfig } from "@solidjs/start/config";
import UnoCSS from "unocss/vite";

export default defineConfig({
  vite: {
    plugins: [UnoCSS()],
    server: {
      prerender: {
        crawlLinks: true,
        enabled: true
      },
    },
    build: {
      target: "esnext"
    },
    optimizeDeps: {
      exclude: ["@mapbox/tiny-sdf"],
    },
    worker: {
      format: "es",
      plugins: () => [
        {
          name: "configure-response",
          configureServer(server) {
            server.middlewares.use((_req, res, next) => {
              res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
              res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
              next();
            });
          },
        },
      ],
    },
  },
});

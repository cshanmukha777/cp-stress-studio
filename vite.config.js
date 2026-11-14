import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "desktop-content-security-policy",
      apply: "build",
      transformIndexHtml() {
        return [
          {
            tag: "meta",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content:
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; worker-src 'self' blob:; frame-src http://localhost:4000 http://127.0.0.1:4000; connect-src 'self' http://localhost:4000 http://127.0.0.1:4000",
            },
            injectTo: "head",
          },
        ];
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
});

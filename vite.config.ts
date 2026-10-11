import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      // Build only: in dev the same policy would block Vite's live-reload connection.
      name: "csp-no-connect",
      apply: "build",
      transformIndexHtml: () => [
        { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: "connect-src 'none'" }, injectTo: "head-prepend" },
      ],
    },
  ],
});

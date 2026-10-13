import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      // Dev only: a fake /api/count (the real one is a Vercel Function), so the counter shows. Never touches the live total.
      name: "dev-count",
      apply: "serve",
      configureServer(server) {
        let total = 1234;
        server.middlewares.use("/api/count", (req, res) => {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            if (req.method === "POST") try { total += Number(JSON.parse(body).n) || 0; } catch {}
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ total }));
          });
        });
      },
    },
    {
      // Build only: in dev the same policy would block Vite's live-reload connection.
      name: "csp-no-connect",
      apply: "build",
      transformIndexHtml: () => [
        { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: "connect-src 'self'" }, injectTo: "head-prepend" },
      ],
    },
  ],
});

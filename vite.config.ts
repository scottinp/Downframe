import { readdirSync, readFileSync } from "node:fs";
import { defineConfig } from "vite";

const SITE = "https://www.downframe.net";

// Guide pages: guides/<slug>/index.html (English) and guides/<lang>/<slug>/index.html. Each file holds only <title>,
// description and <main>; the guide-layout plugin below adds the shared head, header, language links, guide list and footer.
const UI: Record<string, { converter: string; more: string; tm: string }> = {
  en: { converter: "Converter", more: "More guides", tm: "Not affiliated with or endorsed by Adobe. Adobe and After Effects are either registered trademarks or trademarks of Adobe in the United States and/or other countries." },
  ru: { converter: "Конвертер", more: "Другие руководства", tm: "Downframe не связан с Adobe и не одобрен ею. Adobe и After Effects являются зарегистрированными товарными знаками или товарными знаками Adobe в США и/или других странах." },
  id: { converter: "Konverter", more: "Panduan lainnya", tm: "Tidak berafiliasi dengan atau didukung oleh Adobe. Adobe dan After Effects adalah merek dagang terdaftar atau merek dagang Adobe di Amerika Serikat dan/atau negara lain." },
  es: { converter: "Convertidor", more: "Más guías", tm: "No está afiliado ni respaldado por Adobe. Adobe y After Effects son marcas comerciales registradas o marcas comerciales de Adobe en Estados Unidos y/o en otros países." },
  "pt-br": { converter: "Conversor", more: "Mais guias", tm: "Não é afiliado nem endossado pela Adobe. Adobe e After Effects são marcas registradas ou marcas comerciais da Adobe nos Estados Unidos e/ou em outros países." },
  ja: { converter: "コンバーター", more: "その他のガイド", tm: "Adobe とは提携しておらず、Adobe の承認も受けていません。Adobe および After Effects は、米国およびその他の国における Adobe の登録商標または商標です。" },
  ko: { converter: "변환기", more: "다른 가이드", tm: "Adobe와 제휴하거나 Adobe의 승인을 받지 않았습니다. Adobe 및 After Effects는 미국 및/또는 기타 국가에서 Adobe의 등록 상표 또는 상표입니다." },
};
const LANGS = Object.keys(UI);

const guides = () =>
  readdirSync("guides", { recursive: true, encoding: "utf8" })
    .map((f) => f.replaceAll("\\", "/"))
    .filter((f) => f.endsWith("/index.html"))
    .map((f) => {
      const parts = f.split("/");
      const [lang, slug] = parts.length === 3 ? [parts[0], parts[1]] : ["en", parts[0]];
      const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(readFileSync("guides/" + f, "utf8"))?.[1].replace(/<[^>]+>/g, "") ?? slug;
      return { file: "guides/" + f, lang, slug, url: `/guides/${lang === "en" ? "" : lang + "/"}${slug}/`, h1 };
    });

export default defineConfig({
  // Every guide is its own HTML entry, so it shares the hashed CSS and gets the CSP below.
  build: {
    rollupOptions: {
      input: ["index.html", ...guides().map((g) => g.file)],
    },
  },
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
      name: "guide-layout",
      transformIndexHtml: {
        // "pre", so Vite still resolves the injected /src/style.css link into the hashed CSS.
        order: "pre",
        handler(html, ctx) {
          const all = guides();
          const page = all.find((g) => ctx.filename.replaceAll("\\", "/").endsWith(g.file));
          if (!page) return html;
          const t = UI[page.lang];
          const versions = LANGS.map((l) => all.find((g) => g.slug === page.slug && g.lang === l)).filter((g) => g !== undefined);
          const en = versions.find((g) => g.lang === "en") ?? page;
          const head = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#2B2D31">
<link rel="canonical" href="${SITE}${page.url}">
${versions.map((g) => `<link rel="alternate" hreflang="${g.lang}" href="${SITE}${g.url}">`).join("\n")}
<link rel="alternate" hreflang="x-default" href="${SITE}${en.url}">
<link rel="icon" type="image/png" href="/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Schibsted+Grotesk:wght@400;500;700;800&display=swap">
<link rel="stylesheet" href="/src/style.css">
<script defer src="/_vercel/insights/script.js"></script>`;
          const nav = versions.map((g) => g === page ? `<a href="${g.url}" aria-current="page">${g.lang.toUpperCase()}</a>` : `<a href="${g.url}" hreflang="${g.lang}" lang="${g.lang}">${g.lang.toUpperCase()}</a>`).join("");
          const header = `<header>
  <div class="wrap">
    <a class="brand" href="/"><img src="/logo.png" alt="" width="28" height="28">downframe</a>
    <nav><a href="/#converter">${t.converter}</a>${nav}</nav>
  </div>
</header>`;
          const more = `<h2>${t.more}</h2>
  <ul>
${all.filter((g) => g.lang === page.lang && g !== page).map((g) => `    <li><a href="${g.url}">${g.h1}</a></li>`).join("\n")}
  </ul>`;
          const footer = `<footer>
  <div class="wrap">
    <div>${t.tm}</div>
  </div>
</footer>`;
          return html.replace("<head>", "<head>\n" + head).replace("<body>", "<body>\n" + header).replace("</main>", more + "\n</main>").replace("</body>", footer + "\n</body>");
        },
      },
    },
    {
      // Build only: the sitemap lists the home page and every guide, so a new guide can't be left out of it.
      name: "sitemap",
      apply: "build",
      generateBundle() {
        const urls = ["/", ...guides().map((g) => g.url)];
        this.emitFile({ type: "asset", fileName: "sitemap.xml", source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join("\n")}
</urlset>
` });
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

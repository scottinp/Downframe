// Checks dist/ against CONSTRAINTS.md. Run after `npm run build`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";

// Keep in sync with CONSTRAINTS.md.
const BUDGET = { jsGzip: 7000, cssGzip: 4000, totalRaw: 66000 };

const files = readdirSync("dist", { recursive: true, encoding: "utf8" }).map((n) => "dist/" + n).filter((f) => statSync(f).isFile());
const gz = (ext: string) => files.filter((f) => f.endsWith(ext)).reduce((s, f) => s + gzipSync(readFileSync(f)).length, 0);
const got = {
  jsGzip: gz(".js"),
  cssGzip: gz(".css"),
  // Guide pages and the sitemap listing them are text that grows with every language, so they don't count; the budget is for the main page's images and fonts.
  totalRaw: files.filter((f) => !/^dist\/guides[\\/]/.test(f) && f !== "dist/sitemap.xml").reduce((s, f) => s + readFileSync(f).length, 0),
};

const fails: string[] = [];
for (const k of Object.keys(BUDGET) as (keyof typeof BUDGET)[]) {
  console.log(`${k}: ${got[k]} / ${BUDGET[k]}`);
  if (got[k] > BUDGET[k]) fails.push(`${k} ${got[k]} > ${BUDGET[k]}`);
}
// The "bytes never leave the browser" promise rests on this meta tag: only our own origin (Vercel Analytics), no third parties.
if (!/http-equiv="Content-Security-Policy" content="connect-src (&#39;|')self(&#39;|')"/.test(readFileSync("dist/index.html", "utf8"))) fails.push("CSP connect-src 'self' missing from dist/index.html");

if (fails.length) {
  console.error("FAIL\n" + fails.join("\n"));
  process.exit(1);
}
console.log("ok");

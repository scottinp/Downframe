# Downframe Tech Stack

October 2026

Vanilla TypeScript built with Vite, hosted as a static site with no backend. The app is one screen and a function that patches bytes, so the browser already provides almost everything.

- **TypeScript.** The converter is mostly offset math on raw bytes, and types catch mistakes there before the code runs.
- **Plain HTML and CSS for the interface.** The interface is a drop area, a dropdown, a button, and an error message.
- **Vite.** Builds the TypeScript into static files with almost no config.
- **Vitest.** Shares Vite's setup and runs the converter against sample files from the terminal.
- **Vercel.** Free for a static site and redeploys on every push.
- **Upstash Redis (via Vercel Storage).** Holds one number, the "files converted" counter, behind a single Vercel Function. Added October 2026; the rest of the site stays static and files never reach it.

# Tasks

## 1. Scaffold (XS)
- [x] `package.json` scripts from SPEC.md, `tsconfig.json` (strict, `allowImportingTsExtensions`, `noEmit`), dev deps typescript/vite/vitest
- Verify: `npm test` and `npm run build` run without errors
- Files: `package.json`, `tsconfig.json`, `index.html`

## 2. Detect version (S)
- [x] You add fixtures to `tests/fixtures/ffx/<ver>/`
- [x] Parse the chunk container, find where the version is stored, `detect()` returns it or `unknown-version`
- [x] Empty, non-RIFF, and truncated files return an error code
- Verify: `npm test`: every fixture detects as its folder's version
- Files: `src/converter/*.ts`, `tests/converter.test.ts`

## 3. Patch + spike CLI (S)
- [x] `patch()` rewrites the version on a copy of the input
- [x] `node scripts/patch.ts <in> <out> --target <ver>` writes the patched file
- Verify: `npm test`: output re-detects as the target and differs from the input only at the version bytes
- Files: `src/converter/*.ts`, `scripts/patch.ts`, `tests/converter.test.ts`
- Depends on: 2

## Checkpoint: gate
- [x] Patch fixtures to each older installed version, open them in AE, log the results in `docs/COMPATIBILITY.md`
- [x] At least 3 pairs work → continue. Otherwise stop and revisit DESIGN.md.

## 4. convert() (S)
- [x] Supported-pairs list taken from COMPATIBILITY.md; unsupported pairs return `unsupported-pair`
- [x] Post-patch checks from DESIGN.md (re-parses, chunk sizes, version rewritten); a failure returns an error and no bytes
- Verify: `npm test` covers every supported pair and every error code
- Files: `src/converter/*.ts`, `tests/converter.test.ts`

## 5. Page (S)
- [x] Drop or pick a file → show the detected version or the error → dropdown of supported targets → convert → download `<name>.ae<target>.ffx` with the experimental label
- [x] CSP `connect-src 'none'` (injected at build by `vite.config.ts`; later `'self'` for Vercel Analytics)
- Verify: `npm run dev`, run the full flow by hand; DevTools Network shows no requests after load
- Files: `index.html`, `src/main.ts`, `src/style.css`, `src/ui/keyframe-grid.ts`, `vite.config.ts`
- Depends on: 4

## 6. Deploy (XS)
- [x] Connect the repo to Vercel; build command `npm run check:task` so failed checks block the deploy
- Verify: the live URL runs the full flow

## Later (not planned yet)
- [ ] Batch upload: several `.ffx` at once. Decide: one download per file, or a `.zip` (needs a dependency; ask). Idea: show the files as an AE-timeline-style layer list (row number, color label, name, per-row status). Draw our own icons; don't copy Adobe's.
- [ ] "X files converted" counter: same-origin endpoint (CSP already `'self'`), or Vercel Analytics custom events (check plan).
- [ ] More blue on the page: pick from headline accent word, blue section kickers, step numbers, link hovers, tinted keyframes (blue on `--bg` ≈ 4.3:1, so large/bold text only). Avoid an AE-purple theme (Adobe trade dress). Update reference/README.md color rules to match.
- [ ] Rename the "Experimental" panel label. DESIGN.md requires output be labeled experimental, so the new wording must still say AE may not open it.
- [ ] `.aep` conversion: out of scope in DESIGN.md. Needs its own spike like `.ffx`: find the version bytes, patch, open in each AE.

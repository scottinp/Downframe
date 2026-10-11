# Spec: Downframe MVP

What and why: [docs/DESIGN.md](docs/DESIGN.md). Stack: [docs/TECHNOLOGY.md](docs/TECHNOLOGY.md). This file covers how to build and check it.

## Stages

1. **Spike.** `scripts/patch.ts` rewrites the version in sample `.ffx` files. Open each output in the target AE version and log the result in `docs/COMPATIBILITY.md`. **Gate:** fewer than 3 working pairs means stop and revisit DESIGN.md.
2. **Converter** in `src/converter/` with tests.
3. **Page** in `src/main.ts`.

## Commands

```
npm install
npm run dev        # vite
npm run build      # tsc --noEmit && vite build → dist/
npm test           # vitest run
node scripts/patch.ts <in.ffx> <out.ffx> --target <version>
```

Node LTS, npm. Dev deps only: typescript, vite, vitest.

## Structure

```
index.html                 CSP: connect-src 'none'
src/main.ts, style.css     page wiring, imports converter
src/converter/             pure byte logic, no DOM, runs in Node
scripts/patch.ts           spike CLI, uses converter
tests/fixtures/ffx/<ver>/  real samples, committed
```

## Code rules

- Bytes via `Uint8Array` + `DataView`, explicit endianness.
- Copy the input before patching. Never mutate it.
- Expected failures (bad file, unknown version, unsupported pair) return `{ ok: false, code }` instead of throwing.

## Tests

- Every fixture is detected as its folder's version.
- For every supported pair: the output passes the checks from DESIGN.md and **differs from the input only at the version bytes**.
- Empty, non-RIFF, truncated, and unknown-version files return an error and no bytes.

## Boundaries

- **Always:** keep `npm test` green before committing; label output experimental.
- **Ask first:** new dependencies; adding a supported pair (only after a manual AE test).
- **Never:** send file bytes over the network; copy code from closed converters; skip failing tests.

## Open questions

1. Which AE versions are installed? These seed the supported list.
2. Version labels: "After Effects 2024 (24.x)" OK?

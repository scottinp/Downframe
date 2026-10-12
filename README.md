<p align="center">
  <img src="public/logo.png" width="220" alt="Downframe logo">
</p>

<h1 align="center">Downframe</h1>

<p align="center">
  <em>Convert After Effects presets (.ffx) to older versions, right in your browser. No fees, no installs, no hassle.</em>
</p>

<p align="center"><a href="https://downframe.net">downframe.net</a></p>

## Features

- Convert an `.ffx` preset to an older version of After Effects
- Batch convert: drop a whole pack and download it as one `.zip`
- Detects which After Effects version saved it, and checks every converted file before it can be downloaded
- Supported versions: 2021, 2022, 2023, 2024, 2025, 2026
- Runs entirely in your browser, no downloads

## How it works

Every preset stores the version of After Effects that saved it. Older versions read that number and refuse anything newer, even when the preset would work fine. Downframe changes that number.

```txt
1. Detect     Read the version number from the start of the file.
       ↓
2. Rewrite    Copy the file and change the number to the version you picked.
              Nothing else in the file changes.
       ↓
3. Check      Make sure the copy is still a valid preset and the number changed.
              If not, you get an error instead of a file.
       ↓
4. Download   Save the copy. Your original is untouched.
```

**What it can't do:** it doesn't translate effects. If a preset uses something your version doesn't have, the copy may still not open, so results are labeled experimental.

### Under the hood

- `.ffx` is a binary format (RIFX, big-endian). The version lives in the first chunk, `head`.
- The converter is plain TypeScript in [src/converter/](src/converter/), separate from the UI, and tested against real presets saved by each version. Tests confirm that only the version bytes change.
- The page can't connect to other servers (CSP `connect-src 'self'`), so your file can't be sent anywhere.

## Develop

```
npm install
npm run dev          # local site
npm run check:task   # tests + build + size/CSP checks
```

Supported versions: [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md). Why it works this way: [docs/DESIGN.md](docs/DESIGN.md). Rules: [SPEC.md](SPEC.md), [CONSTRAINTS.md](CONSTRAINTS.md).

---

Not affiliated with or endorsed by Adobe. Adobe and After Effects are either registered trademarks or trademarks of Adobe in the United States and/or other countries.

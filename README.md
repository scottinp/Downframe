<p align="center">
  <img src="public/logo.png" width="220" alt="Downframe logo">
</p>

<h1 align="center">Downframe</h1>

<p align="center">
  <em>Convert After Effects presets (.ffx) and projects (.aep) to older versions, right in your browser. No fees, no installs, no hassle.</em>
</p>

<p align="center"><a href="https://downframe.net">downframe.net</a></p>

## Features

- Convert an `.ffx` preset or `.aep` project to an older version of After Effects
- Batch convert: drop multiple files and download them as one `.zip`
- Detects which After Effects version saved it (any update of the year), and checks every converted file before it can be downloaded
- Lists third-party plugin effects in a project before converting, since they can crash an older After Effects
- Supported versions: 2021, 2022, 2023, 2024, 2025, 2026
- Runs entirely in your browser, no downloads

## How it works

Every preset and project stores the version of After Effects that saved it. Older versions read that number and refuse anything newer, even when the file would work fine. Downframe changes that number.

```txt
1. Detect     Read the version number from the start of the file.
       ↓
2. Rewrite    Copy the file and change the number to the version you picked.
              Nothing else changes, except for projects saved in 2023 or later
              going to 2022 or 2021: layers are stored 4 bytes shorter there,
              so the file is rebuilt with every layer record trimmed.
       ↓
3. Check      Make sure the copy is still a valid file and the number changed.
              If not, you get an error instead of a file.
       ↓
4. Download   Save the copy. Your original is untouched.
```

**What it can't do:** it doesn't translate effects. If a file uses something your version doesn't have, the copy may still not open, so test every result in your version.

### Under the hood

- `.ffx` and `.aep` are binary formats (RIFX, big-endian; forms `FaFX` and `Egg!`). The version lives in the `head` chunk. Full notes on the format and how it was worked out: [docs/FORMAT.md](docs/FORMAT.md).
- The converter is plain TypeScript in [src/converter/](src/converter/), separate from the UI, and tested against real presets and projects saved by each version. Tests confirm that only the version bytes change (or, for trimmed projects, only the layer records).
- The page can't connect to other servers (CSP `connect-src 'self'`), so your file can't be sent anywhere.

## Develop

```
npm install
npm run dev          # local site
npm run check:task   # tests + build + size/CSP checks
```

Supported versions: [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md). Why it works this way: [docs/DESIGN.md](docs/DESIGN.md). Rules: [SPEC.md](SPEC.md), [CONSTRAINTS.md](CONSTRAINTS.md).

## Acknowledgements

- [forticheprod/py-aep](https://github.com/forticheprod/py-aep) (MIT): its decoding of the `.aep` header and layer records confirmed what the version bytes mean, the version ranges for 2020–2022, and the 2023 layer-record change behind the project trimming.

---

Not affiliated with or endorsed by Adobe. Adobe and After Effects are either registered trademarks or trademarks of Adobe in the United States and/or other countries.

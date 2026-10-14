# File format notes

How After Effects presets (`.ffx`) and projects (`.aep`) store their version, and how Downframe changes it. Adobe publishes no spec; everything here comes from diffing real files saved in each version and opening patched copies in each After Effects install. Test results per version pair: [COMPATIBILITY.md](COMPATIBILITY.md).

## Container

Both file types are built from **chunks**: labelled boxes of data. Every chunk has the same three parts:

| Name | Size | Data |
|---|---|---|
| 4 letters, e.g. `head` | 4 bytes: how many bytes of data follow | the data itself |

If the size is odd, one padding byte follows, so the next chunk starts on an even position.

Numbers are **big-endian**: the most significant byte comes first, so `00 00 00 10` means 16. This layout is called RIFX; it's the RIFF format used by `.wav` and `.avi` files, but with the bytes in the other order.

**The whole file is one big chunk named `RIFX`.** Its data starts with a 4-letter form saying what kind of file it is, then the chunks inside. Here's the start of a real preset (`tests/fixtures/ffx/26/repetile_26.ffx`):

```txt
offset  bytes          meaning
0x00    52 49 46 58    "RIFX"   the file's chunk name
0x04    00 00 15 3a    5434     size: everything after this field, up to the end of the RIFX data
0x08    46 61 46 58    "FaFX"   form: a preset (a project says "Egg!")
0x0c    68 65 61 64    "head"   first chunk inside: its name
0x10    00 00 00 10    16       its size
0x14    … 16 bytes …            its data: the version stamp (see below)
0x24    …                       the next chunk starts here
```

**`LIST` chunks are folders.** Their data starts with a 4-letter folder type (for example `Layr` for a layer), followed by more chunks, which can be lists themselves. So a file is a tree:

```txt
RIFX "Egg!"
├── svap
├── head            ← the version stamp
├── LIST Fold       ← the project panel
│   └── LIST Item
│       └── LIST Layr
│           ├── ldta    ← one layer's settings (160 or 164 bytes)
│           └── …
└── …
```

Two details:
- **Text layers break the pattern.** `LIST btdk` holds raw text-engine data (`/98 << /0 13 >> …`), not chunks. Anything that tries to read it as chunks reads text as sizes, so it's treated as one opaque block.
- **Extra data after the end is normal.** Files can carry XMP metadata after the RIFX data, outside the size count. A file is only cut off if it ends *before* `8 + size`.

## The version stamp

Every file records which After Effects saved it, in the `head` chunk near the start. Two numbers matter:

- **Version number:** one per year (2023 = `0x5e`, 2024 = `0x5f`, …). After Effects refuses any file with a higher number than its own; that's the "created with a newer version" error.
- **Update number:** goes up with updates during a year (23.0, 23.1, …). After Effects also refuses a higher update number than its own, but opens lower ones.

Downframe converts a file by rewriting these two numbers to the older version's.

Projects also store the full app version (like "25.6, build 101") in two places. After Effects doesn't check it, but Downframe sets it to the target's anyway.

| | Preset (`.ffx`) | Project (`.aep`) |
|---|---|---|
| Version number | bytes 0x18–0x1b | bytes 0x20–0x21 |
| Update number | bytes 0x1c–0x1f | bytes 0x22–0x23 |
| Full app version | – | bytes 0x14–0x17 and 0x24–0x27 |

### Values per year

| Year | Version number | Recognised update numbers |
|---|---|---|
| 2020 | `0x5d` | up to `0x18` |
| 2021 | `0x5d` | `0x19`–`0x1d` |
| 2022 | `0x5d` | `0x28` and up |
| 2023 | `0x5e` | any |
| 2024 | `0x5f` | any |
| 2025 | `0x60` | any |
| 2026 | `0x61` | any |

- 2020–2022 share a version number, so the update number tells them apart. Nobody has seen `0x1e`–`0x27`, so those stay unrecognised.
- When converting **to** 2023, 2024 or 2025, Downframe writes update number `0x01`, the lowest, so every update of that year opens the file. For 2022 and 2021 it writes the value from the tested installs (`0x2b` and `0x19`).

## Converting

**Presets:** rewrite the version stamp in a copy. Nothing else changes.

**Projects between 2023 and 2026:** the same, plus the full app version.

**Projects from 2023 or later, going to 2022 or 2021:** 2023 made each layer's settings record (`ldta`) 4 bytes longer, for a new track matte feature. 2022 and older accept the version stamp, then fail with "chunk in file too big (33 :: 5)" when they reach a layer. So Downframe rebuilds the file:

1. copy every chunk, cutting the extra 4 bytes off each layer record,
2. fix the sizes of every folder that contains a shortened record, up to the file header,
3. rewrite the version stamp.

Those 4 bytes are empty unless a layer uses another layer as its track matte (new in 2023). Older versions can't do that, so Downframe refuses such a project instead of silently dropping the matte.

**Every file is checked before download:** the copy must read back as the target version, and its chunks must fit together exactly. The original file is never changed.

## Special cases

- **Text layers:** their text data isn't made of chunks, so it's treated as one block (see Container).
- **Lights:** 2023 changed one value in light layers. 2022 accepts the new value, so nothing needs changing.
- **New kinds of chunks** added after 2022: older versions skip them, so they're left in.
- **Third-party plugins:** a project lists every effect it uses, by internal name. Names that don't start with `ADBE` (Adobe) or `CC` (effects that ship with After Effects) are third-party, and Downframe lists them before converting. Plugins store their own data, and some crash an older After Effects instead of showing an error. In testing, Sapphire S_Glint and S_DissolveShake, Universe Heatwave and FilmConvert Nitrate crashed it; Sapphire S_HueSatBright and BCC Vignette were fine.

## How it was found

1. Saved the same small preset and project in each installed version (2021 to 2026) and compared the bytes. Only the version stamp changed.
2. Made copies with the stamp rewritten and opened each one in the older version. Every result is in [COMPATIBILITY.md](COMPATIBILITY.md).
3. Projects going to 2022 or 2021 failed. Comparing chunk sizes showed the layer records had grown by 4 empty bytes; cutting them fixed every pair, including a real 236-layer project.
4. [py-aep](https://github.com/forticheprod/py-aep), an open-source `.aep` library, confirmed what the numbers mean, gave update numbers for versions not installed here, and explained the 4 extra bytes.
5. Opening files with a lowered update number showed that every update accepts lower ones from its own year.

## Limitations

- Doesn't translate content: an effect or feature that doesn't exist in the older version may be missing, or stop the file from opening.
- Third-party plugins can crash the older version. Downframe can only warn.
- Projects that use a layer as a track matte (2023 and later) can't go to 2022 or 2021.
- Converting to 2022 was only tested on the last 2022 update (22.6).
- 2020 can't be a target: it wouldn't install for testing.
- One install per year was tested. Other updates rely on the rules above.

# Compatibility log

Manual tests: a patched `.ffx` applied in the target After Effects version. Only `works` pairs get offered in the app.

| Pair | Sample | Result | Notes | Date |
|---|---|---|---|---|
| 26 → 25 | repetile | works | Unpatched file rejected ("created with a newer version", 26 :: 280). Patched `head` bytes 0x1b, 0x1f to 25's values: applies. | 2026-10-10 |
| 26 → 18 | repetile | works | Unpatched file rejected. Patched `head` bytes 0x1b, 0x1f to 18's values: applies. | 2026-10-11 |
| 25 → 18 | repetile | works | Unpatched file rejected. Patched `head` bytes 0x1b, 0x1f to 18's values: applies. | 2026-10-11 |
| 26 → 24 | repetile | works | Unpatched file rejected. Patched `head` bytes 0x1b, 0x1f to 24's values: applies. | 2026-10-11 |
| 25 → 24 | repetile | works | Unpatched file rejected. Patched `head` bytes 0x1b, 0x1f to 24's values: applies. | 2026-10-11 |
| 24 → 18 | repetile | works | Unpatched file rejected. Patched `head` bytes 0x1b, 0x1f to 18's values: applies. | 2026-10-11 |
| 26 → 23 | repetile | works | Unpatched file rejected. Patched `head` bytes 0x1b, 0x1f to 23's values: applies. | 2026-10-11 |
| 25 → 23 | repetile | works | Unpatched file rejected. Patched `head` bytes 0x1b, 0x1f to 23's values: applies. | 2026-10-11 |
| 24 → 23 | repetile | works | Unpatched file rejected. Patched `head` bytes 0x1b, 0x1f to 23's values: applies. | 2026-10-11 |
| 23 → 18 | repetile | works | Unpatched file rejected. Patched `head` bytes 0x1b, 0x1f to 18's values: applies. | 2026-10-11 |
| 26 → 22 | repetile | works | Unpatched file rejected. Patched `head` bytes 0x1b, 0x1f to 22's values: applies. | 2026-10-12 |
| 25 → 22 | repetile | works | Unpatched file rejected. Patched `head` bytes 0x1b, 0x1f to 22's values: applies. | 2026-10-12 |
| 24 → 22 | repetile | works | Unpatched file rejected. Patched `head` bytes 0x1b, 0x1f to 22's values: applies. | 2026-10-12 |
| 23 → 22 | repetile | works | Unpatched file rejected. Patched `head` bytes 0x1b, 0x1f to 22's values: applies. | 2026-10-12 |
| 22 → 18 | repetile | works | Unpatched file rejected. Patched `head` byte 0x1f to 18's value (0x1b is 0x5d in both): applies. | 2026-10-12 |

## Format notes

`head` chunk payload (offset 0x14, 16 bytes), per fixture:

| Version | u32 @0x14 | u32 @0x18 | u32 @0x1c | u16 @0x20 |
|---|---|---|---|---|
| 17 | 3 | 0x5d | 0x14 | 0x017f |
| 18 | 3 | 0x5d | 0x19 | 0x0100 |
| 22 | 3 | 0x5d | 0x2b | 0x0100 |
| 23 | 3 | 0x5e | 0x03 | 0x0100 |
| 24 | 3 | 0x5f | 0x01 | 0x0100 |
| 25 | 3 | 0x60 | 0x09 | 0x0100 |
| 26 | 3 | 0x61 | 0x02 | 0x0100 |

Fixture installs (Help → About): 17 = ?, 18 = 18.0.1, 22 = 22.6.0, 23 = 23.2.1, 24 = 24.0.0, 25 = 25.6.0, 26 = 26.0.0.

The u32 @0x1c counts updates within a year (another tool reports 24.x = 0x05, 25.x = 0x01). An update opens a preset stamped with a lower value of its own year:

| Test (.ffx) | Opened in | Result | Date |
|---|---|---|---|
| 0x60 / 0x01 | 25.6.0 (own 0x09) | works | 2026-10-14 |
| 0x5e / 0x01 | 23.2.1 (own 0x03) | works | 2026-10-14 |
| 0x61 / 0x01 | 26.0.0 (own 0x02) | works | 2026-10-14 |
| 0x5e / 0x01 and 0x5e / 0x03, dense preset (Glow, Wave Warp, Curves, keyframes) | 23.2.1 | both work, identical | 2026-10-14 |

So the converter writes 0x01 for targets 2023–2025 (opens in every update of the year) and reads any value from 2023 on (first value = year).

Meaning (from [forticheprod/py-aep](https://github.com/forticheprod/py-aep), MIT, `binary/item_chunks.py`): the first value is the file format version (major + 71 from 2022), which AE refuses if above its own; the second is the format minor, which sets the rules AE reads the file with. The u32 after them (= `svap` in `.aep`) is the app version word and does not affect opening.

Format minors seen for 2020–2022 (ours + py-aep): 2019 0x04–0x05, 2020 0x14–0x16, 2021 0x19–0x1d, 2022 0x28–0x2b. `detect()` reads 2020 ≤ 0x18, 2021 0x19–0x1d, 2022 ≥ 0x28; 0x1e–0x27 is unseen and stays unknown. 2022 still writes 22.6's 0x2b (earlier 2022 updates unverified as targets).

Other byte differences between fixtures come from the comp the preset was applied in (frame rate, solid size), not the version. XMP metadata is appended after the RIFX data and is not counted in the RIFX size.

## .aep projects (spike, not shipped)

Same container as `.ffx`: RIFX, form `Egg!`. Version lives in two places:
- `head` chunk payload starts at 0x20: u16 @0x20, u16 @0x22 = the same pair as `.ffx` (e.g. 26 = 0x61/0x02).
- `svap` chunk (u32 @0x14) holds a build value, repeated at `head` +4 (u32 @0x24). Patched along with the pair in every test below.

| Version | u16 @0x20 | u16 @0x22 | svap (u32 @0x14 and @0x24) | `ldta` size |
|---|---|---|---|---|
| 18 | 0x5d | 0x19 | 0x0b100e01 | 160 |
| 22 | 0x5d | 0x2b | 0x0b330640 | 160 |
| 23 | 0x5e | 0x03 | 0x0b390e03 | 164 |
| 24 | 0x5f | 0x01 | 0x0f000637 | 164 |
| 25 | 0x60 | 0x09 | 0x0f0b0665 | 164 |
| 26 | 0x61 | 0x02 | 0x0f100643 | 164 |

Results (fixtures in tests/fixtures/aep/, patched copies opened in the target version):

| Pair (.aep) | Result | Notes | Date |
|---|---|---|---|
| aep 26 → 18 | fails | Version accepted; then "chunk in file too big — probably unsupported file version (33 :: 5)". Same with and without the svap patch. | 2026-10-13 |
| aep 26 → 25 | opens | | 2026-10-13 |
| aep 25 → 24 | opens | | 2026-10-13 |
| aep 24 → 23 | opens | | 2026-10-13 |
| aep 23 → 22 | fails | Same 33 :: 5 error. | 2026-10-13 |
| aep 26 → 24 | opens | Contents intact (user check). | 2026-10-13 |
| aep 26 → 23 | opens | Contents intact (user check). | 2026-10-13 |
| aep 25 → 23 | opens | Contents intact (user check). | 2026-10-13 |
| aep 26 → 25 (realistic) | opens* | 2.6 MB, 137 layers, text, shapes, masks. *Crashed AE once until a third-party effect was disabled. | 2026-10-13 |
| aep 26 → 24 (realistic) | opens* | Same as above. | 2026-10-13 |
| aep 26 → 23 (realistic) | crashes | Crashed AE on open. | 2026-10-13 |
| aep 26 → 25/24/23 (realistic, plugin effects removed) | opens | Removed from adjustment layers: Sapphire S_Glint and S_DissolveShake, Universe Uni Heatwave, FilmConvert Nitrate. Built-in effects and S_HueSatBright, BCC Vignette stayed and were fine. | 2026-10-14 |

Crossing to 2022 or older: rebuild the chunk tree, trim every 164-byte `ldta` to 160 (the extra 4 bytes are appended at the end and were zero in all 532 records checked; refuse if not), recompute every LIST and RIFX size, keep the XMP tail, then stamp the target version + svap.

| Pair (.aep, trimmed) | Result | Notes | Date |
|---|---|---|---|
| aep 23 → 22 | opens | 12 layers trimmed. | 2026-10-14 |
| aep 26 → 22 | opens | | 2026-10-14 |
| aep 26 → 18 | opens | The pair that failed with a stamp-only patch. | 2026-10-14 |
| aep 26 → 22 (realistic, plugin effects removed) | opens | 236 layers trimmed, 944 bytes shorter. | 2026-10-14 |
| aep 26 → 18 (realistic, plugin effects removed) | opens | 236 layers trimmed. | 2026-10-14 |

Reading: from 2023 on every layer's `ldta` chunk is 164 bytes (160 before), so 2022 and older reject a stamp-only patch; trimming fixes it. Newer chunk types (`ppSn`, `fmpl`, `PwCs`, `pcms`, `pdvc`, `psac`, …) were left in and older versions accepted them. Fixtures are different projects per version, so other chunk differences are partly content. All 6 pairs within 2023–2026 verified (26→25, 26→24, 26→23, 25→24, 25→23, 24→23).

Third-party plugins: some plugin effects saved in a newer AE crash the older AE on open (no error). Which ones depends on the plugin and the version installed; Downframe cannot fix plugin data. The project's effect list (`LIST Pefl` → `pjef`) and each effect's `sspc/fnam` name every effect used, so plugins can be detected and listed before converting (match names not starting with `ADBE`).

Text layers: `LIST btdk` holds raw text-engine data, not chunks. `chunksFit()` must treat it as opaque, or every file with text fails `check-failed` (likely `.ffx` text presets too). All fixtures pass with that exception.

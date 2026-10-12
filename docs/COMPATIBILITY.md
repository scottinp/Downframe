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

Other byte differences between fixtures come from the comp the preset was applied in (frame rate, solid size), not the version. XMP metadata is appended after the RIFX data and is not counted in the RIFX size.

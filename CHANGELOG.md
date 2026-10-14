# Changelog

What changed for people using [downframe.net](https://downframe.net). Newest first.

## 1.3.0, 2026-10-14

- Added: convert After Effects projects (`.aep`) to older versions, 2026 down to 2021, the same versions as presets. Projects saved in 2023 or later are rebuilt for 2022 and 2021, which store layers differently.
- Added: before converting, Downframe lists any third-party plugin effects in a project, since they can crash an older After Effects.
- Fixed: presets and projects saved in any update of a year are recognised, and files converted to 2023, 2024 or 2025 open in every update of that version. Files with text layers no longer fail the safety check.
- Changed: files up to 500 MB (1 GB per batch), so real projects fit.

## 1.2.1, 2026-10-13

- Added: drop a whole folder without sorting it first. Presets that can't be converted go in the download unchanged instead of being left out.
- Added: a counter showing how many files have been converted. Only the number is sent, never your files.
- Changed: a refreshed page. A clearer intro with the supported versions (2021–2026), an animated "How it works" that shows the two bytes Downframe changes, and smaller touches like more blue and smoother scrolling.

## 1.2.0, 2026-10-12

- Added: convert a whole preset pack at once. Drop several `.ffx` files and download them all as one `.zip`. Presets that already open in the version you pick are included unchanged. Add more files or remove any before converting.

## 1.1.0, 2026-10-12

- Added: After Effects 2024, 2023 and 2022. Convert any newer preset down to any of them, and all three down to 2021.

## 1.0.0, 2026-10-11

First release.

- Convert After Effects presets (`.ffx`) to older versions: 2026 to 2025, 2026 to 2021, and 2025 to 2021.
- Runs in your browser. Your file is never uploaded.
- Every converted file is checked before you can download it.

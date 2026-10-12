# Downframe Design Doc

Version 1, October 2026

## Overview

Downframe is a browser-based tool that downgrades Adobe After Effects animation presets (`.ffx`) and, later, project files (`.aep`) so they open in older versions of After Effects.

It is downgrade-only. After Effects already opens files from older versions, so upgrading needs no tool.

## Problem

Files saved in a newer version of After Effects often won't open in an older one. That's a pain when you download a preset or work with someone on a different version. The converters that exist are hard to find or paywalled.

## Who it's for

- Motion designers and editors stuck on an older version
- People using downloaded presets made in newer versions
- People collaborating across versions

## MVP features

1. Drag and drop a `.ffx` file
2. Detect the source version, or say it's unknown
3. Pick a target version from the supported list
4. Convert to a new file (the original isn't touched)
5. Download the result
6. Clear errors for unsupported files and failed conversions

## How conversion works

Downframe patches the version identifiers inside the file: parse it, find where the version is stored, and rewrite it to the target version. It's an independent implementation.

Patching doesn't remove or translate data the older version doesn't understand. A patched file might not open, or might open with properties missing.

Before download, Downframe checks that the file still parses, chunk sizes are consistent, and the version identifier was actually rewritten. That doesn't prove After Effects will open it, so every download comes with a warning to test it in the target version.

## Supported versions

Only specific source-to-target pairs are supported. If a pair is known to fail or hasn't been tried, it isn't offered and the user is told why.

## Technical requirements

- Runs in the browser, nothing to install
- Files are processed locally and never uploaded or stored
- Bad or unsupported files fail with an explanation and no output
- Conversion code is separate from the UI so it can be tested on its own

Planned stack: static site, client-side TypeScript, no backend.

## Build order

1. Patch sample files with a script and check that they open in the target After Effects versions
2. If that doesn't work for enough version pairs, stop, or switch to a tool that only reports compatibility
3. Build the conversion module with tests against sample files
4. Build the interface

## Out of scope

- Upgrading files
- `.aep` conversion (for now)
- Recreating effects that don't exist in the target version
- Fixing missing third-party plugins
- Accounts, servers, file storage

## Risks

The main one is a file that opens but is subtly wrong, which is why every download warns the user to test it. Patching might also only work for a few version pairs, which the first build step is meant to find out early. New After Effects releases could break detection, so unknown versions are treated as unsupported.

## Legal

Everything is written from scratch, with no code from paid or closed-source converters. Downframe isn't affiliated with Adobe. Check Adobe's terms and trademark guidelines before launching publicly.

## Done when

- Supported files convert, pass the checks, and download
- Source version is detected or reported as unknown
- Unsupported files get an explanation and no download
- File contents never leave the browser
- Tests run from one command

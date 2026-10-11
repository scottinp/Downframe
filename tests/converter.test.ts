import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detect } from "../src/converter/index.ts";

const root = "tests/fixtures/ffx";
const fixtures = readdirSync(root).flatMap((ver) =>
  readdirSync(`${root}/${ver}`)
    .filter((f) => f.endsWith(".ffx"))
    .map((f) => ({ ver, file: `${root}/${ver}/${f}` })),
);

describe("detect", () => {
  for (const { ver, file } of fixtures) {
    it(`${file} is version ${ver}`, () => {
      expect(detect(new Uint8Array(readFileSync(file)))).toEqual({ ok: true, version: ver });
    });
  }

  const sample = new Uint8Array(readFileSync(fixtures[0].file));

  it.each([
    ["empty", new Uint8Array(0), "empty"],
    ["non-RIFF", new TextEncoder().encode("PK\x03\x04 definitely a zip file"), "not-riff"],
    ["truncated", sample.slice(0, 100), "truncated"],
    ["header only", sample.slice(0, 10), "truncated"],
  ])("%s file returns %s", (_, bytes, code) => {
    expect(detect(bytes as Uint8Array)).toEqual({ ok: false, code });
  });

  it("unknown version bytes return unknown-version", () => {
    const bytes = sample.slice();
    bytes[0x1f] = 0xee;
    expect(detect(bytes)).toEqual({ ok: false, code: "unknown-version" });
  });
});

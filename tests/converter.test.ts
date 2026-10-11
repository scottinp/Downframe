import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { convert, detect, patch, SUPPORTED, VERSIONS } from "../src/converter/index.ts";

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

describe("patch", () => {
  for (const { ver, file } of fixtures) {
    for (const target of Object.keys(VERSIONS).filter((t) => Number(t) < Number(ver))) {
      it(`${ver} → ${target}`, () => {
        const input = new Uint8Array(readFileSync(file));
        const before = input.slice();
        const result = patch(input, target);
        if (!result.ok) throw new Error(result.code);

        expect(input).toEqual(before);
        expect(detect(result.bytes)).toEqual({ ok: true, version: target });
        expect(result.bytes.length).toBe(input.length);
        for (let i = 0; i < input.length; i++) {
          if (i >= 0x18 && i < 0x22) continue;
          if (result.bytes[i] !== input[i]) throw new Error(`byte 0x${i.toString(16)} changed`);
        }
      });
    }
  }

  it("unknown target returns unknown-target and no bytes", () => {
    const input = new Uint8Array(readFileSync(fixtures[0].file));
    expect(patch(input, "99")).toEqual({ ok: false, code: "unknown-target" });
  });

  it.each([
    ["upgrade", "18", "26"],
    ["same version", "26", "26"],
  ])("%s returns not-downgrade", (_, from, to) => {
    const input = new Uint8Array(readFileSync(fixtures.find((f) => f.ver === from)!.file));
    expect(patch(input, to)).toEqual({ ok: false, code: "not-downgrade" });
  });

  it("bad input passes detect's error through", () => {
    expect(patch(new Uint8Array(0), "18")).toEqual({ ok: false, code: "empty" });
  });
});

describe("convert", () => {
  const read = (ver: string) => new Uint8Array(readFileSync(fixtures.find((f) => f.ver === ver)!.file));

  it("supported pairs match the works rows in COMPATIBILITY.md", () => {
    const log = readFileSync("docs/COMPATIBILITY.md", "utf8");
    const works = [...log.matchAll(/^\| (\d+) → (\d+) \| [^|]+ \| works \|/gm)].map((m) => `${m[1]}→${m[2]}`);
    const supported = Object.entries(SUPPORTED).flatMap(([from, tos]) => tos.map((to) => `${from}→${to}`));
    expect(supported.sort()).toEqual(works.sort());
  });

  for (const [from, tos] of Object.entries(SUPPORTED)) {
    for (const to of tos) {
      it(`${from} → ${to} converts`, () => {
        const result = convert(read(from), to);
        if (!result.ok) throw new Error(result.code);
        expect(detect(result.bytes)).toEqual({ ok: true, version: to });
      });
    }
  }

  it.each([
    ["untested downgrade", "26", "17"],
    ["upgrade", "18", "26"],
    ["same version", "26", "26"],
    ["unknown target", "26", "99"],
  ])("%s returns unsupported-pair", (_, from, to) => {
    expect(convert(read(from), to)).toEqual({ ok: false, code: "unsupported-pair" });
  });

  it.each([
    ["empty", new Uint8Array(0), "empty"],
    ["unknown version", (() => { const b = read("26"); b[0x1f] = 0xee; return b; })(), "unknown-version"],
  ])("%s input returns %s", (_, bytes, code) => {
    expect(convert(bytes as Uint8Array, "18")).toEqual({ ok: false, code });
  });

  it("broken chunk sizes return check-failed and no bytes", () => {
    const bytes = read("26");
    new DataView(bytes.buffer).setUint32(0x28, 0x10, false); // LIST chunk now claims 16 bytes
    expect(convert(bytes, "18")).toEqual({ ok: false, code: "check-failed" });
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chunksFit, convert, detect, patch, SUPPORTED, VERSIONS } from "../src/converter/index.ts";

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

describe("other updates within a year", () => {
  const withB = (ver: string, b: number) => {
    const bytes = new Uint8Array(readFileSync(fixtures.find((f) => f.ver === ver)!.file));
    new DataView(bytes.buffer).setUint32(0x1c, b, false);
    return bytes;
  };

  for (const ver of ["23", "24", "25", "26"]) {
    it(`a ${ver} preset from another update is still ${ver}`, () => {
      expect(detect(withB(ver, 0x05))).toEqual({ ok: true, version: ver });
    });
  }

  // 2020–2022 share the first value; the second picks the year from the ranges seen per year.
  for (const [ver, b, expected] of [
    ["17", 0x16, "17"], // a later 2020 update
    ["18", 0x1d, "18"], // a later 2021 update
    ["22", 0x28, "22"], // an early 2022 update
    ["22", 0x30, "22"],
    ["18", 0x20, null], // 0x1e–0x27 has never been seen: unknown
  ] as const) {
    it(`a 0x5d file with update value 0x${b.toString(16)} is ${expected ?? "unknown"}`, () => {
      expect(detect(withB(ver, b))).toEqual(expected ? { ok: true, version: expected } : { ok: false, code: "unknown-version" });
    });
  }

  it("converted files get a low update value, so every update of the target year opens them", () => {
    for (const to of ["23", "24", "25"]) {
      const result = convert(withB("26", 0x02), to);
      if (!result.ok) throw new Error(result.code);
      expect(new DataView(result.bytes.buffer).getUint32(0x1c, false)).toBe(0x01);
    }
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
    ["unknown version", (() => { const b = read("26"); b[0x1b] = 0xee; return b; })(), "unknown-version"],
  ])("%s input returns %s", (_, bytes, code) => {
    expect(convert(bytes as Uint8Array, "18")).toEqual({ ok: false, code });
  });

  it("broken chunk sizes return check-failed and no bytes", () => {
    const bytes = read("26");
    new DataView(bytes.buffer).setUint32(0x28, 0x10, false); // LIST chunk now claims 16 bytes
    expect(convert(bytes, "18")).toEqual({ ok: false, code: "check-failed" });
  });
});

describe("chunksFit", () => {
  // Builds big-endian RIFX chunks: 4-char type, u32 size, body, pad byte if odd.
  const chunk = (type: string, ...parts: Uint8Array[]) => {
    const body = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    parts.reduce((at, p) => (body.set(p, at), at + p.length), 0);
    const out = new Uint8Array(8 + body.length + (body.length % 2));
    out.set(new TextEncoder().encode(type));
    new DataView(out.buffer).setUint32(4, body.length, false);
    out.set(body, 8);
    return out;
  };
  const list = (id: string, ...children: Uint8Array[]) => chunk("LIST", new TextEncoder().encode(id), ...children);
  const fits = (bytes: Uint8Array) => chunksFit(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 0, bytes.length);
  const textData = new TextEncoder().encode("/98 << /0 13 >> /0 << /1 [ 0.5 ] >>"); // raw text-engine data, not chunks

  it("accepts raw text data inside a btdk list (text layers)", () => {
    expect(fits(list("tdgp", list("btdk", textData), chunk("tdsb", new Uint8Array(4))))).toBe(true);
  });

  it("still rejects raw data inside any other list", () => {
    expect(fits(list("tdgp", list("Layr", textData)))).toBe(false);
  });

  it("still rejects a btdk list that runs past its parent", () => {
    const bytes = list("tdgp", list("btdk", textData));
    new DataView(bytes.buffer).setUint32(12 + 4, 999, false); // inner LIST claims 999 bytes
    expect(fits(bytes)).toBe(false);
  });

  it("accepts a real project with a text layer", () => {
    const bytes = new Uint8Array(readFileSync("tests/fixtures/aep/26/2026 - text.aep"));
    const view = new DataView(bytes.buffer);
    expect(chunksFit(view, 0x0c, 8 + view.getUint32(4, false))).toBe(true);
  });
});

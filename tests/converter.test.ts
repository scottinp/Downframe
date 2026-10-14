import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chunksFit, convert, detect, patch, SUPPORTED, thirdPartyEffects, VERSIONS } from "../src/converter/index.ts";

const root = "tests/fixtures/ffx";
const fixtures = readdirSync(root).flatMap((ver) =>
  readdirSync(`${root}/${ver}`)
    .filter((f) => f.endsWith(".ffx"))
    .map((f) => ({ ver, file: `${root}/${ver}/${f}` })),
);

describe("detect", () => {
  for (const { ver, file } of fixtures) {
    it(`${file} is version ${ver}`, () => {
      expect(detect(new Uint8Array(readFileSync(file)))).toEqual({ ok: true, version: ver, kind: "ffx" });
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
      expect(detect(withB(ver, 0x05))).toEqual({ ok: true, version: ver, kind: "ffx" });
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
      expect(detect(withB(ver, b))).toEqual(expected ? { ok: true, version: expected, kind: "ffx" } : { ok: false, code: "unknown-version" });
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
        expect(detect(result.bytes)).toEqual({ ok: true, version: target, kind: "ffx" });
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
        expect(detect(result.bytes)).toEqual({ ok: true, version: to, kind: "ffx" });
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

describe(".aep projects", () => {
  const aepRoot = "tests/fixtures/aep";
  const projects = readdirSync(aepRoot).flatMap((ver) =>
    readdirSync(`${aepRoot}/${ver}`).filter((f) => f.endsWith(".aep")).map((f) => ({ ver, file: `${aepRoot}/${ver}/${f}` })),
  );
  const load = (file: string) => new Uint8Array(readFileSync(file));
  // Sizes of every layer record (`ldta`) in a project.
  const layerSizes = (bytes: Uint8Array) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), sizes: number[] = [];
    const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
    const walk = (start: number, end: number) => {
      for (let at = start; at < end;) {
        const size = view.getUint32(at + 4, false);
        if (tag(at) === "LIST" && tag(at + 8) !== "btdk") walk(at + 12, at + 8 + size);
        if (tag(at) === "ldta") sizes.push(size);
        at += 8 + size + (size % 2);
      }
    };
    walk(12, 8 + view.getUint32(4, false));
    return sizes;
  };

  for (const { ver, file } of projects) {
    it(`${file} is a version ${ver} project`, () => {
      expect(detect(load(file))).toEqual({ ok: true, version: ver, kind: "aep" });
    });

    for (const to of SUPPORTED[ver] ?? []) {
      it(`${file} → ${to}`, () => {
        const input = load(file), before = input.slice();
        const result = convert(input, to);
        if (!result.ok) throw new Error(result.code);
        expect(Buffer.from(input).equals(before)).toBe(true); // original untouched (direct compare: projects are MBs)
        expect(detect(result.bytes)).toEqual({ ok: true, version: to, kind: "aep" });
        if (Number(to) <= 22) {
          // 2022 and older: every layer record trimmed back to 160 bytes, 4 bytes shorter per trimmed record.
          const trimmed = layerSizes(input).filter((n) => n === 164).length;
          expect(layerSizes(result.bytes).every((n) => n === 160)).toBe(true);
          expect(result.bytes.length).toBe(input.length - 4 * trimmed);
        } else {
          // Same generation: only the version stamp changes (svap value, version pair, version word).
          expect(result.bytes.length).toBe(input.length);
          for (let i = 0; i < input.length; i++) {
            if ((i >= 0x14 && i < 0x18) || (i >= 0x20 && i < 0x28)) continue;
            if (result.bytes[i] !== input[i]) throw new Error(`byte 0x${i.toString(16)} changed`);
          }
        }
      });
    }
  }

  it("supported pairs match the aep rows in COMPATIBILITY.md", () => {
    const log = readFileSync("docs/COMPATIBILITY.md", "utf8");
    const opens = new Set([...log.matchAll(/^\| aep (\d+) → (\d+)(?: \([^)]*\))? \| opens/gm)].map((m) => `${m[1]}→${m[2]}`));
    const supported = Object.entries(SUPPORTED).flatMap(([from, tos]) => tos.map((to) => `${from}→${to}`));
    expect(supported.filter((p) => !opens.has(p))).toEqual([]);
  });

  it("a layer using a 2023 track matte can't go to 2022 or older, but can within 2023+", () => {
    const bytes = load(`${aepRoot}/26/2026.aep`);
    const view = new DataView(bytes.buffer);
    const at = Buffer.from(bytes).indexOf("ldta") + 8; // first layer record's data
    view.setUint32(at + 160, 7, false); // matte layer id 7
    expect(convert(bytes, "22")).toEqual({ ok: false, code: "matte-layer" });
    expect(convert(bytes, "25").ok).toBe(true);
  });

  it("lists third-party effects by match name, skipping Adobe and bundled Cycore effects", () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    const chunk = (type: string, ...parts: Uint8Array[]) => {
      const body = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      parts.reduce((at, p) => (body.set(p, at), at + p.length), 0);
      const out = new Uint8Array(8 + body.length + (body.length % 2));
      out.set(enc(type));
      new DataView(out.buffer).setUint32(4, body.length, false);
      out.set(body, 8);
      return out;
    };
    const tdmn = (name: string) => { const b = new Uint8Array(40); b.set(enc(name)); return chunk("tdmn", b); };
    const effect = (name: string) => chunk("LIST", enc("EfDf"), tdmn(name), chunk("LIST", enc("sspc")));
    // A real project's header (version stamp) followed by an effect list.
    const base = load(`${aepRoot}/26/2026.aep`);
    const list = chunk("LIST", enc("EfdG"), effect("ADBE Glo2"), effect("CC Particle World"), effect("S_Glint"), effect("FC NITRATE"));
    const body = new Uint8Array(0x34 + list.length);
    body.set(base.subarray(0, 0x34)); // RIFX, Egg!, svap, head (ends at 0x34)
    body.set(list, 0x34);
    new DataView(body.buffer).setUint32(4, body.length - 8, false);
    expect(thirdPartyEffects(body)).toEqual(["S_Glint", "FC NITRATE"]);
    expect(thirdPartyEffects(load(`${aepRoot}/26/2026 - text.aep`))).toEqual([]);
    expect(thirdPartyEffects(load(fixtures[0].file))).toEqual([]); // presets aren't scanned
  });

  it("a file too short to hold a version is unknown, not an error", () => {
    const bytes = new Uint8Array(0x20);
    bytes.set(new TextEncoder().encode("RIFX"));
    new DataView(bytes.buffer).setUint32(4, 0x18, false);
    bytes.set(new TextEncoder().encode("Egg!"), 8);
    expect(detect(bytes)).toEqual({ ok: false, code: "unknown-version" });
  });
});

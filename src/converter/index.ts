export type Result<T> = ({ ok: true } & T) | { ok: false; code: string };
export type Kind = "ffx" | "aep"; // preset (RIFX form FaFX) or project (form Egg!)

// `head` chunk payload values per AE version, from docs/COMPATIBILITY.md: `a` = file format version, `b` = format
// minor, which rises with updates within a year. An update opens files with a lower `b` of its own year, so targets
// get a low `b` (0x01 for 2023–2025, tested incl. a Curves preset in 23.2.1) to open in every update of that year.
// Presets store them as u32 @0x18, u32 @0x1c, u16 `c` @0x20 (the u32 at 0x14 is 3 in every known file);
// projects as u16 @0x20, u16 @0x22, and have no `c`.
export const VERSIONS: Record<string, { a: number; b: number; c: number }> = {
  "17": { a: 0x5d, b: 0x14, c: 0x017f },
  "18": { a: 0x5d, b: 0x19, c: 0x0100 },
  "22": { a: 0x5d, b: 0x2b, c: 0x0100 }, // from 22.6; earlier 2022 updates (0x28+) unverified as targets
  "23": { a: 0x5e, b: 0x01, c: 0x0100 },
  "24": { a: 0x5f, b: 0x01, c: 0x0100 },
  "25": { a: 0x60, b: 0x01, c: 0x0100 },
  "26": { a: 0x61, b: 0x02, c: 0x0100 }, // never a target
};

// Projects also carry the app version word (u32 in the `svap` chunk @0x14 and again @0x24). AE ignores it when
// opening (py-aep), but converted projects get the target's value, as in every tested pair. From the fixtures.
const AEP_WORD: Record<string, number> = { "18": 0x0b100e01, "22": 0x0b330640, "23": 0x0b390e03, "24": 0x0f000637, "25": 0x0f0b0665 };

// Reading: from 2023 (a = 0x5e) `a` alone is the year. 2020–2022 share a = 0x5d, so `b` picks the year, using the
// format minors seen per year (ours + py-aep): 2020 ≤ 0x18, 2021 0x19–0x1d, 2022 ≥ 0x28. 0x1e–0x27 is unseen: unknown.
const B_RANGES: Record<string, [number, number]> = { "17": [0x00, 0x18], "18": [0x19, 0x1d], "22": [0x28, 0xff] };
const matches = (ver: string, a: number, b: number, c: number | null) => {
  const k = VERSIONS[ver];
  if (k.a !== a || (c !== null && k.c !== c)) return false;
  if (a >= 0x5e) return true;
  const [lo, hi] = B_RANGES[ver] ?? [k.b, k.b];
  return b >= lo && b <= hi;
};

const ascii = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
const LIST = 0x4c495354, LDTA = 0x6c647461, EFDF = 0x45664466, TDMN = 0x74646d6e;

export function detect(bytes: Uint8Array): Result<{ version: string; kind: Kind }> {
  if (bytes.length === 0) return { ok: false, code: "empty" };
  const form = bytes.length >= 12 && ascii(bytes, 0) === "RIFX" ? ascii(bytes, 8) : "";
  if (form !== "FaFX" && form !== "Egg!") {
    return bytes.length < 12 && "RIFX".startsWith(ascii(bytes, 0))
      ? { ok: false, code: "truncated" }
      : { ok: false, code: "not-riff" };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // XMP metadata may follow the RIFX data, so only a short file is an error.
  if (bytes.length < 8 + view.getUint32(4, false)) return { ok: false, code: "truncated" };
  if (bytes.length < 0x28) return { ok: false, code: "unknown-version" }; // too short to hold a version: no reads past the end
  const kind: Kind = form === "FaFX" ? "ffx" : "aep";
  let a: number, b: number, c: number | null;
  if (kind === "ffx") {
    if (ascii(bytes, 0x0c) !== "head" || view.getUint32(0x10, false) !== 0x10 || view.getUint32(0x14, false) !== 3) {
      return { ok: false, code: "unknown-version" };
    }
    a = view.getUint32(0x18, false); b = view.getUint32(0x1c, false); c = view.getUint16(0x20, false);
  } else {
    if (ascii(bytes, 0x0c) !== "svap" || ascii(bytes, 0x18) !== "head" || view.getUint32(0x1c, false) !== 0x14) {
      return { ok: false, code: "unknown-version" };
    }
    a = view.getUint16(0x20, false); b = view.getUint16(0x22, false); c = null;
  }
  const version = Object.keys(VERSIONS).find((v) => matches(v, a, b, c));
  return version ? { ok: true, version, kind } : { ok: false, code: "unknown-version" };
}

// 2023 added a 4-byte matte layer id to every layer record (`ldta`, 160 → 164 bytes), and 2022 and older reject the
// longer record. So for those targets the chunk tree is rebuilt with it cut and every enclosing size recomputed
// (XMP after the RIFX data is kept). The id is 0 unless a layer uses 2023's "any layer as track matte", which older
// versions can't express: then it refuses with `matte-layer`.
function trimLayers(bytes: Uint8Array): Result<{ bytes: Uint8Array<ArrayBuffer> }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = 8 + view.getUint32(4, false);
  if (!chunksFit(view, 0x0c, end)) return { ok: false, code: "check-failed" };
  let matte = false;
  // Pieces are appended to one list (projects have thousands of chunks, too many to pass around as arguments);
  // each chunk's header is added first and its size filled in once its body is written.
  const parts: Uint8Array[] = [];
  const add = (p: Uint8Array) => (parts.push(p), p.length);
  const copy = (start: number, stop: number): number => {
    let written = 0;
    for (let at = start; at < stop;) {
      const type = view.getUint32(at, false), size = view.getUint32(at + 4, false);
      const header = new Uint8Array(8);
      header.set(bytes.subarray(at, at + 4));
      written += add(header);
      let length;
      if (type === LIST && !OPAQUE_LISTS.has(view.getUint32(at + 8, false))) length = add(bytes.subarray(at + 8, at + 12)) + copy(at + 12, at + 8 + size);
      else if (type === LDTA && size === 164) {
        if (view.getUint32(at + 8 + 160, false) !== 0) matte = true;
        length = add(bytes.subarray(at + 8, at + 8 + 160));
      } else length = add(bytes.subarray(at + 8, at + 8 + size));
      new DataView(header.buffer).setUint32(4, length, false);
      written += length + (length % 2 ? add(new Uint8Array(1)) : 0);
      at += 8 + size + (size % 2);
    }
    return written;
  };
  const innerLength = copy(0x0c, end);
  if (matte) return { ok: false, code: "matte-layer" };
  const out = new Uint8Array(12 + innerLength + (bytes.length - end));
  out.set(bytes.subarray(0, 12)); // RIFX, size (fixed below), Egg!
  new DataView(out.buffer).setUint32(4, 4 + innerLength, false);
  let at = 12;
  for (const p of parts) { out.set(p, at); at += p.length; }
  out.set(bytes.subarray(end), at);
  return { ok: true, bytes: out };
}

// Writes the target's version into a copy (projects going to 2022 or older are also trimmed, see trimLayers).
// Any downgrade is allowed here; convert() limits it to tested pairs.
export function patch(bytes: Uint8Array, target: string): Result<{ bytes: Uint8Array<ArrayBuffer> }> {
  const detected = detect(bytes);
  if (!detected.ok) return detected;
  if (!Object.hasOwn(VERSIONS, target)) return { ok: false, code: "unknown-target" };
  // Newer AE already opens older files, so upgrading has no use.
  if (Number(target) >= Number(detected.version)) return { ok: false, code: "not-downgrade" };
  const k = VERSIONS[target];
  if (detected.kind === "ffx") {
    const out = new Uint8Array(bytes); // fresh ArrayBuffer, so the result can go straight into a Blob
    const view = new DataView(out.buffer);
    view.setUint32(0x18, k.a, false);
    view.setUint32(0x1c, k.b, false);
    view.setUint16(0x20, k.c, false);
    return { ok: true, bytes: out };
  }
  let out: Uint8Array<ArrayBuffer>;
  if (k.a === 0x5d) {
    const trimmed = trimLayers(bytes);
    if (!trimmed.ok) return trimmed;
    out = trimmed.bytes;
  } else out = new Uint8Array(bytes);
  const view = new DataView(out.buffer);
  view.setUint16(0x20, k.a, false);
  view.setUint16(0x22, k.b, false);
  if (AEP_WORD[target] !== undefined) {
    view.setUint32(0x14, AEP_WORD[target], false);
    view.setUint32(0x24, AEP_WORD[target], false);
  }
  return { ok: true, bytes: out };
}

// Pairs that opened in the target AE version, from docs/COMPATIBILITY.md: the `works` rows (presets) and the
// `aep … opens` rows (projects) cover the same 15 pairs.
export const SUPPORTED: Record<string, string[]> = {
  "26": ["25", "24", "23", "22", "18"],
  "25": ["24", "23", "22", "18"],
  "24": ["23", "22", "18"],
  "23": ["22", "18"],
  "22": ["18"],
};

// LIST types whose body is raw data, not chunks: only checked to fit their parent. "btdk" = text-engine data in text layers.
const OPAQUE_LISTS = new Set([0x6274646b]);

// True if the chunks from `start` to `end` fill it exactly, LIST contents included. Chunks are padded to even sizes.
export function chunksFit(view: DataView, start: number, end: number): boolean {
  let at = start;
  while (at < end) {
    if (at + 8 > end) return false;
    const size = view.getUint32(at + 4, false);
    const next = at + 8 + size + (size % 2);
    if (next > end) return false;
    const isList = view.getUint32(at, false) === LIST;
    if (isList && size < 4) return false;
    if (isList && !OPAQUE_LISTS.has(view.getUint32(at + 8, false)) && !chunksFit(view, at + 12, at + 8 + size)) return false;
    at = next;
  }
  return at === end;
}

// Third-party effects in a project: match names of its effect definitions (LIST EfDf → first `tdmn`) that aren't
// Adobe's (`ADBE …`) or the bundled Cycore set (`CC …`). Plugins saved in a newer AE can crash an older one.
// shortcut: other bundled non-ADBE effects (e.g. Keylight) would be listed too; add prefixes if users report them.
export function thirdPartyEffects(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const names = new Set<string>();
  const walk = (start: number, stop: number) => {
    for (let at = start; at + 8 <= stop;) {
      const type = view.getUint32(at, false), size = view.getUint32(at + 4, false);
      if (at + 8 + size > stop) return;
      if (type === LIST && size >= 4) {
        const id = view.getUint32(at + 8, false);
        if (id === EFDF && view.getUint32(at + 12, false) === TDMN) {
          const name = new TextDecoder().decode(bytes.subarray(at + 20, at + 20 + view.getUint32(at + 16, false))).replace(/\0.*$/s, "");
          if (name && !/^(ADBE|CC) /.test(name)) names.add(name);
        } else if (!OPAQUE_LISTS.has(id)) walk(at + 12, at + 8 + size);
      }
      at += 8 + size + (size % 2);
    }
  };
  if (detect(bytes).ok && ascii(bytes, 8) === "Egg!") walk(0x0c, 8 + view.getUint32(4, false));
  return [...names];
}

// The page's entry point: only tested pairs, and no bytes unless the output passes the checks.
export function convert(bytes: Uint8Array, target: string): Result<{ bytes: Uint8Array<ArrayBuffer> }> {
  const source = detect(bytes);
  if (!source.ok) return source;
  if (!SUPPORTED[source.version]?.includes(target)) return { ok: false, code: "unsupported-pair" };
  const result = patch(bytes, target);
  if (!result.ok) return result;
  const out = result.bytes;
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const recheck = detect(out);
  if (!recheck.ok || recheck.version !== target || recheck.kind !== source.kind || !chunksFit(view, 0x0c, 8 + view.getUint32(4, false))) {
    return { ok: false, code: "check-failed" };
  }
  return result;
}

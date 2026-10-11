export type Result<T> = ({ ok: true } & T) | { ok: false; code: string };

// `head` chunk payload values per AE version, from docs/COMPATIBILITY.md.
// The u32 at 0x14 is 3 in every known file and is checked separately.
export const VERSIONS: Record<string, { a: number; b: number; c: number }> = {
  "17": { a: 0x5d, b: 0x14, c: 0x017f },
  "18": { a: 0x5d, b: 0x19, c: 0x0100 },
  "25": { a: 0x60, b: 0x09, c: 0x0100 },
  "26": { a: 0x61, b: 0x02, c: 0x0100 },
};

const ascii = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));

export function detect(bytes: Uint8Array): Result<{ version: string }> {
  if (bytes.length === 0) return { ok: false, code: "empty" };
  if (bytes.length < 12 || ascii(bytes, 0) !== "RIFX" || ascii(bytes, 8) !== "FaFX") {
    return bytes.length < 12 && "RIFX".startsWith(ascii(bytes, 0))
      ? { ok: false, code: "truncated" }
      : { ok: false, code: "not-riff" };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // XMP metadata may follow the RIFX data, so only a short file is an error.
  if (bytes.length < 8 + view.getUint32(4, false)) return { ok: false, code: "truncated" };
  if (ascii(bytes, 0x0c) !== "head" || view.getUint32(0x10, false) !== 0x10 || view.getUint32(0x14, false) !== 3) {
    return { ok: false, code: "unknown-version" };
  }
  const a = view.getUint32(0x18, false), b = view.getUint32(0x1c, false), c = view.getUint16(0x20, false);
  const version = Object.keys(VERSIONS).find((v) => {
    const k = VERSIONS[v];
    return k.a === a && k.b === b && k.c === c;
  });
  return version ? { ok: true, version } : { ok: false, code: "unknown-version" };
}

// Writes the target's `head` values into a copy. Any downgrade is allowed here; convert() limits it to tested pairs.
export function patch(bytes: Uint8Array, target: string): Result<{ bytes: Uint8Array<ArrayBuffer> }> {
  const detected = detect(bytes);
  if (!detected.ok) return detected;
  if (!Object.hasOwn(VERSIONS, target)) return { ok: false, code: "unknown-target" };
  // Newer AE already opens older files, so upgrading has no use.
  if (Number(target) >= Number(detected.version)) return { ok: false, code: "not-downgrade" };
  const k = VERSIONS[target];
  const out = new Uint8Array(bytes); // fresh ArrayBuffer, so the result can go straight into a Blob
  const view = new DataView(out.buffer);
  view.setUint32(0x18, k.a, false);
  view.setUint32(0x1c, k.b, false);
  view.setUint16(0x20, k.c, false);
  return { ok: true, bytes: out };
}

// Pairs that opened in the target AE version, from the `works` rows in docs/COMPATIBILITY.md.
export const SUPPORTED: Record<string, string[]> = {
  "26": ["25", "18"],
  "25": ["18"],
};

// True if the chunks from `start` to `end` fill it exactly, LIST contents included. Chunks are padded to even sizes.
function chunksFit(view: DataView, start: number, end: number): boolean {
  let at = start;
  while (at < end) {
    if (at + 8 > end) return false;
    const size = view.getUint32(at + 4, false);
    const next = at + 8 + size + (size % 2);
    if (next > end) return false;
    const isList = view.getUint32(at, false) === 0x4c495354; // "LIST"
    if (isList && (size < 4 || !chunksFit(view, at + 12, at + 8 + size))) return false;
    at = next;
  }
  return at === end;
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
  if (!recheck.ok || recheck.version !== target || !chunksFit(view, 0x0c, 8 + view.getUint32(4, false))) {
    return { ok: false, code: "check-failed" };
  }
  return result;
}

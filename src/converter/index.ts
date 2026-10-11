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

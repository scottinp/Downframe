// Minimal .zip writer: files stored without compression, UTF-8 names. Presets are a few KB, so compression isn't worth a dependency.
// shortcut: no zip64, so at most 65535 files and 4 GB; batches are guarded far below that in main.ts.

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

const DOS_DATE = 0x21; // 1980-01-01, the earliest date zip can store; real timestamps add nothing here

// Unzip tools overwrite or prompt on repeated names, so number repeats: "a.ffx", "a (2).ffx". Case-insensitive, like Windows.
export function uniqueNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    let out = name;
    for (let n = 2; used.has(out.toLowerCase()); n++) out = name.replace(/(\.[^.]*)?$/, ` (${n})$1`);
    used.add(out.toLowerCase());
    return out;
  });
}

export function zip(files: { name: string; bytes: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const names = uniqueNames(files.map((f) => f.name));
  const entries = files.map((f, i) => ({ name: new TextEncoder().encode(names[i]), bytes: f.bytes, crc: crc32(f.bytes) }));
  const localSize = entries.reduce((s, e) => s + 30 + e.name.length + e.bytes.length, 0);
  const centralSize = entries.reduce((s, e) => s + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let at = 0;
  const u16 = (v: number) => { view.setUint16(at, v, true); at += 2; };
  const u32 = (v: number) => { view.setUint32(at, v, true); at += 4; };
  const put = (b: Uint8Array) => { out.set(b, at); at += b.length; };

  const offsets: number[] = [];
  for (const e of entries) {
    offsets.push(at);
    u32(0x04034b50); u16(20); u16(0x0800); u16(0); u16(0); u16(DOS_DATE);
    u32(e.crc); u32(e.bytes.length); u32(e.bytes.length); u16(e.name.length); u16(0);
    put(e.name); put(e.bytes);
  }
  entries.forEach((e, i) => {
    u32(0x02014b50); u16(20); u16(20); u16(0x0800); u16(0); u16(0); u16(DOS_DATE);
    u32(e.crc); u32(e.bytes.length); u32(e.bytes.length); u16(e.name.length); u16(0); u16(0);
    u16(0); u16(0); u32(0); u32(offsets[i]);
    put(e.name);
  });
  u32(0x06054b50); u16(0); u16(0); u16(entries.length); u16(entries.length);
  u32(centralSize); u32(localSize); u16(0);
  return out;
}

import { describe, expect, it } from "vitest";
import { crc32, uniqueNames, zip } from "../src/zip.ts";

const text = (s: string) => new TextEncoder().encode(s);

describe("zip", () => {
  it("crc32 matches the standard check value", () => {
    expect(crc32(text("123456789"))).toBe(0xcbf43926);
  });

  it("repeated names get numbered without colliding, ignoring case", () => {
    expect(uniqueNames(["a.ffx", "a.ffx", "a (2).ffx", "A.FFX", "b"])).toEqual(["a.ffx", "a (2).ffx", "a (2) (2).ffx", "A (3).FFX", "b"]);
  });

  it("every entry can be read back through the central directory", () => {
    const files = [
      { name: "a.ae25.ffx", bytes: text("first") },
      { name: "präset.ffx", bytes: new Uint8Array([0, 1, 2, 255]) },
    ];
    const out = zip(files);
    const view = new DataView(out.buffer);
    const end = out.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(files.length);

    let at = view.getUint32(end + 16, true);
    for (const f of files) {
      expect(view.getUint32(at, true)).toBe(0x02014b50);
      const nameLen = view.getUint16(at + 28, true);
      const size = view.getUint32(at + 24, true);
      const local = view.getUint32(at + 42, true);
      expect(new TextDecoder().decode(out.subarray(at + 46, at + 46 + nameLen))).toBe(f.name);
      expect(view.getUint32(local, true)).toBe(0x04034b50);
      const data = local + 30 + view.getUint16(local + 26, true);
      expect(out.subarray(data, data + size)).toEqual(f.bytes);
      expect(view.getUint32(at + 16, true)).toBe(crc32(f.bytes));
      at += 46 + nameLen;
    }
  });
});

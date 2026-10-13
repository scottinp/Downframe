import { describe, expect, it } from "vitest";
import { MAX_ADD, parseAdd } from "../api/count.ts";

describe("parseAdd", () => {
  it("accepts whole numbers from 1 to MAX_ADD", () => {
    expect(parseAdd({ n: 1 })).toBe(1);
    expect(parseAdd({ n: MAX_ADD })).toBe(MAX_ADD);
  });

  it("rejects anything else", () => {
    for (const body of [null, "5", {}, { n: 0 }, { n: -3 }, { n: 1.5 }, { n: MAX_ADD + 1 }, { n: "5" }, { n: NaN }]) {
      expect(parseAdd(body)).toBeNull();
    }
  });
});

import { describe, expect, it } from "vitest";
import { MAX_MIN_POINTS, readMinPoints } from "../src/lib/minPoints";

describe("readMinPoints", () => {
  it("keeps a valid threshold, whole points only", () => {
    expect(readMinPoints("51", 51)).toBe(51);
    expect(readMinPoints("0", 51)).toBe(0);
    expect(readMinPoints("72.9", 51)).toBe(72);
  });

  it("brings an out-of-range threshold back between 0 and 100", () => {
    expect(MAX_MIN_POINTS).toBe(100);
    expect(readMinPoints("150", 51)).toBe(100);
    expect(readMinPoints("-3", 51)).toBe(0);
  });

  it("keeps the last valid value when the field is emptied or unreadable", () => {
    expect(readMinPoints("", 40)).toBe(40);
    expect(readMinPoints("  ", 40)).toBe(40);
    expect(readMinPoints("abc", 40)).toBe(40);
  });
});

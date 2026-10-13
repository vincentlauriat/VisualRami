import { describe, expect, it } from "vitest";
import { LruCache } from "../src/bot/lru.js";

describe("LruCache", () => {
  it("evicts the least recently used entry, a read counting as a use", () => {
    const cache = new LruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1); // "a" is now the most recent
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
    expect(cache.size).toBe(2);
  });
});

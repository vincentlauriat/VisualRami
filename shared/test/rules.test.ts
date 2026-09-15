import { describe, expect, it } from "vitest";
import { analyzeRun, analyzeSet, checkFirstLaydown, isValidMeld } from "../src/rules.js";
import type { Card, Rank, Suit } from "../src/types.js";

let counter = 0;
const c = (rank: Rank, suit: Suit = "hearts"): Card => ({
  id: `${suit}-${rank}-${counter++}`,
  suit,
  rank,
  joker: false,
});
const joker = (): Card => ({ id: `joker-${counter++}`, suit: null, rank: null, joker: true });

describe("analyzeSet", () => {
  it("accepts three same-rank cards of distinct suits", () => {
    const r = analyzeSet([c(7, "hearts"), c(7, "spades"), c(7, "clubs")]);
    expect(r).toMatchObject({ kind: "set", points: 21, pure: true });
  });
  it("rejects duplicate suits", () => {
    expect(analyzeSet([c(7, "hearts"), c(7, "hearts"), c(7, "clubs")])).toBeNull();
  });
  it("accepts a joker but not two jokers with one card", () => {
    expect(analyzeSet([c(9, "hearts"), c(9, "spades"), joker()])).not.toBeNull();
    expect(analyzeSet([c(9, "hearts"), joker(), joker()])).toBeNull();
  });
  it("rejects five cards", () => {
    expect(
      analyzeSet([c(9, "hearts"), c(9, "spades"), c(9, "clubs"), c(9, "diamonds"), joker()]),
    ).toBeNull();
  });
  it("counts aces as 11", () => {
    expect(analyzeSet([c(1, "hearts"), c(1, "spades"), c(1, "clubs")])!.points).toBe(33);
  });
});

describe("analyzeRun", () => {
  it("accepts a simple run", () => {
    const r = analyzeRun([c(4), c(5), c(6)]);
    expect(r).toMatchObject({ kind: "run", points: 15, pure: true, values: [4, 5, 6] });
  });
  it("rejects mixed suits and non-consecutive ranks", () => {
    expect(analyzeRun([c(4), c(5, "spades"), c(6)])).toBeNull();
    expect(analyzeRun([c(4), c(6), c(7)])).toBeNull();
  });
  it("accepts ace low and ace high, never wrapping", () => {
    expect(analyzeRun([c(1), c(2), c(3)])!.points).toBe(6);
    expect(analyzeRun([c(12), c(13), c(1)])!.points).toBe(31);
    expect(analyzeRun([c(13), c(1), c(2)])).toBeNull();
  });
  it("fills gaps with jokers and scores the replaced value", () => {
    const r = analyzeRun([c(9), joker(), c(11)]);
    expect(r).toMatchObject({ points: 29, pure: false, values: [9, 10, 11] });
    expect(analyzeRun([joker(), c(12), c(13)])!.values).toEqual([11, 12, 13]);
    expect(analyzeRun([c(12), c(13), joker()])!.values).toEqual([12, 13, 14]);
  });
  it("rejects a joker that would push past the king / ace", () => {
    expect(analyzeRun([c(13), c(1), joker()])).toBeNull();
  });
  it("respects the given order", () => {
    expect(analyzeRun([c(6), c(5), c(4)])).toBeNull();
  });
});

describe("checkFirstLaydown", () => {
  it("requires 51 points and a pure run", () => {
    const melds = [[c(10, "hearts"), c(10, "spades"), c(10, "clubs")]];
    expect(checkFirstLaydown(melds, 51, true).ok).toBe(false);
    const withRun = [...melds, [c(10, "diamonds"), c(11, "diamonds"), c(12, "diamonds")]];
    const result = checkFirstLaydown(withRun, 51, true);
    expect(result).toMatchObject({ ok: true, points: 60, hasPureRun: true });
  });
  it("rejects a run with a joker as the pure run", () => {
    const melds = [
      [c(10, "hearts"), c(10, "spades"), c(10, "clubs")],
      [c(10, "diamonds"), joker(), c(12, "diamonds")],
    ];
    expect(checkFirstLaydown(melds, 51, true).ok).toBe(false);
    expect(checkFirstLaydown(melds, 51, false).ok).toBe(true);
  });
  it("isValidMeld tries run then set", () => {
    expect(isValidMeld([c(2, "hearts"), c(2, "clubs"), c(2, "spades")])).toBe(true);
    expect(isValidMeld([c(2, "hearts"), c(3, "hearts"), c(4, "hearts")])).toBe(true);
    expect(isValidMeld([c(2, "hearts"), c(3, "hearts")])).toBe(false);
  });
});

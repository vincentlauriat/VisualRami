import { describe, expect, it } from "vitest";
import { chooseDiscard, enumerateMelds, findExtensions, findJokerSwaps, findOpening } from "../src/bot/index.js";
import { analyzeMeld, checkFirstLaydown } from "../src/rules.js";
import type { Card, Meld, Rank, Suit } from "../src/types.js";

const c = (rank: Rank, suit: Suit, copy = 0): Card => ({ id: `${suit}-${rank}-${copy}`, rank, suit, joker: false });
const joker = (n = 0): Card => ({ id: `joker-${n}`, rank: null, suit: null, joker: true });
const RULES = { firstMeldMinPoints: 51, requirePureRun: true };
const keys = (cards: Card[]) => cards.map((x) => (x.joker ? "J" : `${x.rank}${x.suit![0]}`)).sort().join(" ");

describe("enumerateMelds", () => {
  it("finds sets of distinct suits only", () => {
    const hand = [c(7, "hearts"), c(7, "spades"), c(7, "clubs"), c(7, "hearts", 1)];
    const melds = enumerateMelds(hand).map((m) => keys(m.cards));
    expect(melds).toEqual(["7c 7h 7s"]);
  });

  it("finds runs with a joker in the gap and at either end", () => {
    const hand = [c(5, "hearts"), c(7, "hearts"), joker()];
    const runs = enumerateMelds(hand).filter((m) => m.kind === "run");
    expect(runs.map((m) => keys(m.cards))).toEqual(["5h 7h J"]);
    const pair = enumerateMelds([c(5, "hearts"), c(6, "hearts"), joker()]);
    // 4-5-6 or 5-6-7: same cards, the higher-scoring reading is kept.
    expect(pair).toHaveLength(1);
    expect(pair[0]!.points).toBe(18);
    expect(analyzeMeld(pair[0]!.cards)!.points).toBe(18);
  });

  it("reads the ace low or high, never both", () => {
    const low = enumerateMelds([c(1, "spades"), c(2, "spades"), c(3, "spades")]);
    expect(low.map((m) => m.points)).toEqual([6]);
    const high = enumerateMelds([c(12, "spades"), c(13, "spades"), c(1, "spades")]);
    expect(high.map((m) => m.points)).toEqual([31]);
    expect(enumerateMelds([c(13, "spades"), c(1, "spades"), c(2, "spades")])).toEqual([]);
  });

  it("never lets jokers outnumber real cards", () => {
    expect(enumerateMelds([c(5, "hearts"), joker(0), joker(1)])).toEqual([]);
  });

  it("de-duplicates identical cards from the two decks", () => {
    const hand = [c(5, "hearts"), c(6, "hearts"), c(7, "hearts"), c(5, "hearts", 1), c(6, "hearts", 1), c(7, "hearts", 1)];
    const melds = enumerateMelds(hand);
    expect(melds).toHaveLength(1);
    expect(melds[0]!.cards.map((x) => x.id)).toEqual(["hearts-5-0", "hearts-6-0", "hearts-7-0"]);
  });
});

describe("findOpening", () => {
  it("opens at 51 with a pure run", () => {
    const hand = [
      c(10, "hearts"), c(11, "hearts"), c(12, "hearts"), // 30, pure
      c(9, "spades"), c(9, "clubs"), c(9, "diamonds"), // 27
      c(2, "clubs"),
    ];
    const opening = findOpening(hand, RULES)!;
    expect(opening).not.toBeNull();
    expect(opening.points).toBe(57);
    expect(checkFirstLaydown(opening.melds, 51, true).ok).toBe(true);
    expect(opening.rest.map((x) => x.id)).toEqual(["clubs-2-0"]);
  });

  it("refuses an opening without a pure run when one is required", () => {
    const hand = [
      c(13, "hearts"), c(13, "spades"), c(13, "clubs"), // 30
      c(12, "hearts"), c(12, "spades"), c(12, "clubs"), // 30
      c(2, "clubs"),
    ];
    expect(findOpening(hand, RULES)).toBeNull();
    const free = findOpening(hand, { firstMeldMinPoints: 51, requirePureRun: false })!;
    expect(free.points).toBe(60);
  });

  it("refuses an opening below the threshold", () => {
    const hand = [c(2, "hearts"), c(3, "hearts"), c(4, "hearts"), c(5, "spades"), c(5, "clubs"), c(5, "diamonds"), c(9, "clubs")];
    expect(findOpening(hand, RULES)).toBeNull();
  });

  it("uses a joker in a gap to reach the threshold, with the pure run elsewhere", () => {
    const hand = [
      c(10, "hearts"), joker(), c(12, "hearts"), // 10-J-Q, the joker as the jack: 30
      c(5, "clubs"), c(6, "clubs"), c(7, "clubs"), // 18, pure
      c(3, "spades"), c(3, "diamonds"), c(3, "hearts"), // 9
      c(13, "diamonds"),
    ];
    const opening = findOpening(hand, RULES)!;
    expect(opening.points).toBeGreaterThanOrEqual(51);
    expect(checkFirstLaydown(opening.melds, 51, true)).toMatchObject({ ok: true, hasPureRun: true });
  });

  it("uses a high ace for points", () => {
    const hand = [c(12, "spades"), c(13, "spades"), c(1, "spades"), c(11, "hearts"), c(11, "clubs"), c(11, "diamonds"), c(4, "clubs")];
    const opening = findOpening(hand, RULES)!;
    expect(opening.points).toBe(61);
  });

  it("never lays the whole hand: one card stays to discard", () => {
    const hand = [
      c(10, "hearts"), c(11, "hearts"), c(12, "hearts"),
      c(9, "spades"), c(9, "clubs"), c(9, "diamonds"), c(9, "hearts"),
    ];
    const opening = findOpening(hand, RULES)!;
    expect(opening.rest).toHaveLength(1);
    expect(checkFirstLaydown(opening.melds, 51, true).ok).toBe(true);
    // With a three-card hand forming one meld there is nothing to keep, so no opening.
    expect(findOpening([c(1, "hearts"), c(13, "hearts"), c(12, "hearts")], { firstMeldMinPoints: 0, requirePureRun: false })).toBeNull();
  });

  it("lays both copies of a duplicated card in two runs", () => {
    const hand = [
      c(5, "hearts"), c(6, "hearts"), c(7, "hearts"),
      c(7, "hearts", 1), c(8, "hearts"), c(9, "hearts"),
      c(10, "clubs"), c(11, "clubs"), c(12, "clubs"),
      c(2, "spades"),
    ];
    const opening = findOpening(hand, RULES)!;
    expect(opening.points).toBe(18 + 24 + 30);
    const ids = opening.melds.flat().map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("hearts-7-0");
    expect(ids).toContain("hearts-7-1");
  });
});

describe("table moves", () => {
  const meld = (id: string, cards: Card[]): Meld => ({ id, kind: analyzeMeld(cards)!.kind, cards, ownerId: "x" });

  it("finds extensions at either end and the fourth card of a set", () => {
    const run = meld("r", [c(5, "hearts"), c(6, "hearts"), c(7, "hearts")]);
    const set = meld("s", [c(9, "spades"), c(9, "clubs"), c(9, "diamonds")]);
    const hand = [c(4, "hearts"), c(8, "hearts"), c(9, "hearts"), c(9, "spades", 1), c(2, "clubs")];
    const found = findExtensions(hand, [run, set]).map((e) => `${e.meldId}:${e.position}:${e.cardIds.join(",")}`);
    expect(found).toContain("r:start:hearts-4-0");
    expect(found).toContain("r:end:hearts-8-0");
    expect(found).toContain("s:end:hearts-9-0");
    expect(found.some((f) => f.includes("spades-9-1"))).toBe(false);
  });

  it("finds a joker swap", () => {
    const run = meld("r", [c(5, "hearts"), joker(), c(7, "hearts")]);
    expect(findJokerSwaps([c(6, "hearts"), c(6, "clubs")], [run])).toEqual([{ meldId: "r", cardId: "hearts-6-0" }]);
  });
});

describe("chooseDiscard", () => {
  it("discards the isolated card worth the most", () => {
    const hand = [c(5, "hearts"), c(6, "hearts"), c(7, "hearts"), c(13, "spades"), c(3, "clubs"), c(12, "diamonds"), c(12, "clubs")];
    expect(chooseDiscard(hand, null).id).toBe("spades-13-0");
  });

  it("keeps jokers and never returns the card just taken from the discard pile", () => {
    const hand = [joker(), c(13, "spades"), c(2, "clubs")];
    expect(chooseDiscard(hand, "spades-13-0").id).toBe("clubs-2-0");
    expect(chooseDiscard([c(13, "spades")], "spades-13-0").id).toBe("spades-13-0");
  });
});

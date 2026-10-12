import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  bestPacking,
  bestPackings,
  chooseDiscard,
  enumerateMelds,
  findExtensions,
  findJokerSwaps,
  findOpening,
  KEEP_GOAL,
  LAYDOWN_GOAL,
  openingGoal,
  type PackingGoal,
  type PackingShape,
} from "../src/bot/index.js";
import { buildDeck, handCardPoints } from "../src/cards.js";
import "./fcSeed.js";
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

describe("packing search", () => {
  const DECK = buildDeck();
  const byId = (id: string) => DECK.find((x) => x.id === id)!;
  // The reviewer's slow hands: a long heart run with twins, two queens, four jokers.
  const H1 = ["hearts-9-0", "hearts-10-0", "hearts-11-0", "hearts-12-0", "hearts-13-0", "hearts-1-0", "hearts-10-1", "hearts-11-1", "hearts-12-1", "spades-12-0", "clubs-12-0", "joker-0", "joker-1", "joker-2", "joker-3"].map(byId);
  const H2 = [9, 10, 11, 12, 13].flatMap((r) => [`hearts-${r}-0`, `hearts-${r}-1`]).concat(["hearts-1-0", "joker-0", "joker-1", "joker-2", "joker-3"]).map(byId);
  const shapeId = (s: PackingShape) =>
    s.melds.map((m) => `${m.kind}:${[...m.keys].sort().join(",")}`).sort().join("|") + "#" + [...s.restKeys].sort().join(",");

  it("visits every packing once, and all of them, twins and jokers included", () => {
    // Distinct packings counted with the search as first written, exhaustive and without a ceiling
    // (it visited 25,936 and 35,434 leaves to find them).
    for (const [hand, distinct] of [[H1, 14_137], [H2, 18_022]] as const) {
      const seen: string[] = [];
      bestPacking(hand, {}, { onLeaf: (s) => seen.push(shapeId(s)) });
      expect(new Set(seen).size).toBe(seen.length);
      expect(seen.length).toBe(distinct);
    }
  });

  /** What a card left in hand costs: its points, then one per card. */
  const cost = (rest: Card[]) => rest.reduce((s, x) => s + handCardPoints(x) * 100 + 1, 0);

  /** The search as first written: exhaustive, no pruning, twins tried in every order. */
  function oracle(hand: Card[], goal: PackingGoal): number | null {
    const candidates = enumerateMelds(hand);
    const counts = new Map<string, number>();
    const key = (x: Card) => (x.joker ? "joker" : `${x.suit}-${x.rank}`);
    for (const x of hand) counts.set(key(x), (counts.get(key(x)) ?? 0) + 1);
    const order = [...counts.keys()].sort((a, b) => (a === "joker" ? 1 : b === "joker" ? -1 : a < b ? -1 : 1));
    const restCards: Card[] = [];
    let points = 0, pure = 0, melds = 0, best: number | null = null;
    const pick = (k: string) => hand.find((x) => key(x) === k)!;
    const visit = () => {
      const i = order.findIndex((k) => counts.get(k)! > 0);
      if (i < 0) {
        const stats = { points, hasPureRun: pure > 0, melds, rest: restCards.length };
        if (goal.accept && !goal.accept(stats)) return;
        const c = cost(restCards);
        if (best === null || c < best) best = c;
        return;
      }
      const k = order[i]!;
      for (const m of candidates) {
        const ks = m.cards.map(key);
        if (!ks.includes(k)) continue;
        const need = new Map<string, number>();
        for (const x of ks) need.set(x, (need.get(x) ?? 0) + 1);
        if ([...need].some(([x, n]) => (counts.get(x) ?? 0) < n)) continue;
        for (const [x, n] of need) counts.set(x, counts.get(x)! - n);
        points += m.points; melds++; if (m.kind === "run" && m.pure) pure++;
        visit();
        points -= m.points; melds--; if (m.kind === "run" && m.pure) pure--;
        for (const [x, n] of need) counts.set(x, counts.get(x)! + n);
      }
      counts.set(k, counts.get(k)! - 1);
      restCards.push(pick(k));
      visit();
      restCards.pop();
      counts.set(k, counts.get(k)! + 1);
    };
    visit();
    return best;
  }

  it("finds the same best packing as an exhaustive search, for the opening, a laydown and the discard", () => {
    const pool = DECK.filter((x) => x.joker || [1, 2, 3, 11, 12, 13].includes(x.rank!));
    const window = (low: number) => DECK.filter((x) => x.joker || (x.rank! >= low && x.rank! <= low + 4));
    const hands = fc.oneof(fc.constant(pool), fc.integer({ min: 1, max: 9 }).map(window), fc.constant(DECK)).chain((p) =>
      fc.shuffledSubarray(p, { minLength: 3, maxLength: 11 }),
    );
    const rules = fc.record({ firstMeldMinPoints: fc.constantFrom(0, 30, 51, 71, 100), requirePureRun: fc.boolean() });
    fc.assert(
      fc.property(hands, rules, (hand, r) => {
        const goals = [openingGoal(r), LAYDOWN_GOAL, KEEP_GOAL];
        const found = bestPackings(hand, goals);
        goals.forEach((goal, g) => {
          const packing = found[g]!;
          expect(packing ? cost(packing.rest) : null).toBe(oracle(hand, goal));
        });
      }),
      { numRuns: 150 },
    );
  });

  it("returns at once on the reviewer's slow hands, even at thresholds nobody can reach", () => {
    for (const hand of [H1, H2]) {
      for (const min of [51, 120, 200]) {
        const t0 = performance.now();
        bestPackings(hand, [openingGoal({ firstMeldMinPoints: min, requirePureRun: true }), KEEP_GOAL]);
        // Measured at 1 to 3 ms; the margin is for a loaded CI machine.
        expect(performance.now() - t0).toBeLessThan(100);
      }
    }
  });

  it("an exhausted budget still gives a legal answer: nothing, or an accepted packing", () => {
    const budget = { deadline: 0, exceeded: false };
    const opening = findOpening(H1, RULES, budget);
    expect(budget.exceeded).toBe(true);
    if (opening) expect(checkFirstLaydown(opening.melds, 51, true).ok).toBe(true);
  });
});

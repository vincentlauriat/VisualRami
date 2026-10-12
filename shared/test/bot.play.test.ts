import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { enumerateMelds, findOpening, planTurn } from "../src/bot/index.js";
import { buildDeck, seededRng } from "../src/cards.js";
import { applyAction, toPublicState } from "../src/game.js";
import { analyzeMeld, arrangeMeld, checkFirstLaydown } from "../src/rules.js";
import { DEFAULT_OPTIONS, type Card, type GameState, type Meld } from "../src/types.js";
import { assertConserved, botTable, playRound } from "./botSim.js";

const DECK = buildDeck();
const byId = (id: string) => DECK.find((c) => c.id === id)!;
/** A dense pool, so random hands actually hold melds: three suits, ranks around the ace, jokers. */
const POOL = DECK.filter((c) => c.joker || ([1, 2, 3, 11, 12, 13].includes(c.rank!) && c.suit !== "diamonds"));
const handOf = (max: number) => fc.shuffledSubarray(POOL, { minLength: 1, maxLength: max });
const multiset = (cards: Card[]) => cards.map((c) => (c.joker ? "joker" : `${c.suit}-${c.rank}`)).sort().join(",");

/** A two-player state at p1's draw, with the given hands and table; the rest is the stock. */
function tableState(hand: Card[], other: Card[], melds: Meld[], hasLaidDown: boolean, discard: Card[]): GameState {
  const used = new Set([...hand, ...other, ...discard, ...melds.flatMap((m) => m.cards)].map((c) => c.id));
  return {
    roomId: "R",
    hostId: "p1",
    options: DEFAULT_OPTIONS,
    players: [
      { id: "p1", name: "Bot", hand, hasLaidDown, score: 0, connected: true },
      { id: "p2", name: "Other", hand: other, hasLaidDown: true, score: 0, connected: true },
    ],
    stock: DECK.filter((c) => !used.has(c.id)),
    discard,
    melds,
    currentIndex: 0,
    phase: "draw",
    drewFromDiscardCardId: null,
    winnerId: null,
    round: 1,
    lastRoundPoints: null,
    ready: [],
    log: [],
  };
}

/** Plays p1's whole turn through the reducer; throws on the first action it refuses. */
function botTurn(start: GameState, seed = 1): GameState {
  const rng = seededRng(seed);
  let state = start;
  for (let call = 0; call < 2 && state.currentIndex === 0 && state.phase !== "finished"; call++) {
    for (const action of planTurn(toPublicState(state, "p1"))) {
      const r = applyAction(state, "p1", action, rng);
      if (!r.ok) throw new Error(`${JSON.stringify(action)}: ${r.error}`);
      state = r.state;
    }
  }
  return state;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

describe("fairness", () => {
  it("the bot module never touches the full game state or the reducer", () => {
    const dir = join(import.meta.dirname, "../src/bot");
    for (const file of readdirSync(dir)) {
      const source = readFileSync(join(dir, file), "utf8");
      expect(source, file).not.toMatch(/(?<!Public)GameState\b/);
      expect(source, file).not.toMatch(/from "\.\.\/game\.js"/);
      expect(source, file).not.toMatch(/\bapplyAction\b|\btoPublicState\b/);
    }
  });

  it("decides from a frozen public view without changing it", () => {
    const { state, act } = botTable(5, 3);
    const started = act(state, "p1", { type: "start" });
    const view = deepFreeze(toPublicState(started, "p1"));
    expect(planTurn(view)).toHaveLength(1);
    const played = act(started, "p1", planTurn(view)[0]!);
    expect(() => planTurn(deepFreeze(toPublicState(played, "p1")))).not.toThrow();
  });

  it("plans nothing outside its own turn", () => {
    const { state, act } = botTable(5, 3);
    const started = act(state, "p1", { type: "start" });
    expect(planTurn(toPublicState(started, "p2"))).toEqual([]);
    expect(planTurn(toPublicState(state, "p1"))).toEqual([]);
  });
});

describe("turn planning", () => {
  it("takes the discard pile's only card when the stock is empty", () => {
    const hand = ["hearts-2-0", "clubs-7-0", "spades-9-0"].map(byId);
    const other = ["hearts-5-0"].map(byId);
    let state = tableState(hand, other, [], false, [byId("diamonds-13-0")]);
    // Move the whole stock into the other hand: the stock is empty and the discard pile holds
    // one card, so the engine has nothing to reshuffle.
    state = { ...state, players: state.players.map((p) => (p.id === "p2" ? { ...p, hand: [...p.hand, ...state.stock] } : p)), stock: [] };
    assertConserved(state);
    expect(applyAction(state, "p1", { type: "draw", source: "stock" }).ok).toBe(false);
    expect(planTurn(toPublicState(state, "p1"))).toEqual([{ type: "draw", source: "discard" }]);
    const after = botTurn(state);
    expect(after.currentIndex).toBe(1);
    expect(after.discard.map((c) => c.id)).not.toContain("diamonds-13-0");
  });

  it("takes the discard only when it goes on the table this turn", () => {
    const opened = ["hearts-11-0", "hearts-12-0", "clubs-4-0", "spades-8-0"].map(byId);
    const run: Meld = { id: "r", kind: "run", cards: ["spades-5-0", "spades-6-0", "spades-7-0"].map(byId), ownerId: "p2" };
    // Already laid down: the 4♠ extends the run on the table, the 2♦ fits nothing.
    const takes = tableState(opened, [], [run], true, [byId("spades-4-0")]);
    expect(planTurn(toPublicState(takes, "p1"))).toEqual([{ type: "draw", source: "discard" }]);
    const skips = tableState(opened, [], [run], true, [byId("diamonds-2-0")]);
    expect(planTurn(toPublicState(skips, "p1"))).toEqual([{ type: "draw", source: "stock" }]);
    // Not laid down: a card that only makes a meld too small to open stays in the pile.
    const small = tableState(["hearts-2-0", "hearts-3-0", "clubs-9-0"].map(byId), [], [], false, [byId("hearts-4-0")]);
    expect(planTurn(toPublicState(small, "p1"))).toEqual([{ type: "draw", source: "stock" }]);
  });

  it("opens, takes a joker back with its last real card and goes out on the joker", () => {
    const joker = byId("joker-0");
    const run: Meld = { id: "r", kind: "run", cards: [byId("clubs-5-0"), joker, byId("clubs-7-0")], ownerId: "p2" };
    const hand = ["hearts-10-0", "hearts-11-0", "hearts-12-0", "spades-9-0", "clubs-9-0", "diamonds-9-0", "clubs-6-0"].map(byId);
    let state = tableState(hand, [byId("hearts-2-0")], [run], false, [byId("diamonds-2-0")]);
    // Draw a card the bot can use: the king of hearts.
    state = { ...state, stock: [byId("hearts-13-0"), ...state.stock.filter((c) => c.id !== "hearts-13-0")] };
    const after = botTurn(state);
    expect(after.phase).toBe("finished");
    expect(after.winnerId).toBe("p1");
    expect(after.melds.find((m) => m.id === "r")!.cards.some((c) => c.id === "clubs-6-0")).toBe(true);
  });
});

describe("properties", () => {
  it("every meld found is valid and made of the hand's cards", () => {
    fc.assert(
      fc.property(handOf(15), (hand) => {
        const ids = new Set(hand.map((c) => c.id));
        for (const meld of enumerateMelds(hand)) {
          expect(analyzeMeld(meld.cards)).not.toBeNull();
          expect(analyzeMeld(meld.cards)!.points).toBe(meld.points);
          expect(meld.cards.every((c) => ids.has(c.id))).toBe(true);
          expect(new Set(meld.cards.map((c) => c.id)).size).toBe(meld.cards.length);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("no meld of three to five cards is missed", () => {
    fc.assert(
      fc.property(handOf(9), (hand) => {
        const found = new Set(enumerateMelds(hand).map((m) => multiset(m.cards)));
        const n = hand.length;
        for (let mask = 0; mask < 1 << n; mask++) {
          const size = mask.toString(2).replaceAll("0", "").length;
          if (size < 3 || size > 5) continue;
          const subset = hand.filter((_, i) => mask & (1 << i));
          if (arrangeMeld(subset)) expect(found.has(multiset(subset)), multiset(subset)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("every opening found passes the engine's first-laydown check and keeps a card", () => {
    const rules = fc.record({
      firstMeldMinPoints: fc.constantFrom(0, 30, 51, 71),
      requirePureRun: fc.boolean(),
    });
    fc.assert(
      fc.property(handOf(15), rules, (hand, options) => {
        const opening = findOpening(hand, options);
        if (!opening) return;
        expect(checkFirstLaydown(opening.melds, options.firstMeldMinPoints, options.requirePureRun).ok).toBe(true);
        expect(opening.rest.length).toBeGreaterThan(0);
        const used = [...opening.melds.flat(), ...opening.rest].map((c) => c.id).sort();
        expect(used).toEqual(hand.map((c) => c.id).sort());
      }),
      { numRuns: 300 },
    );
  });

  it("the bot's turn is accepted by the reducer, whatever the hand and the table", () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(POOL, { minLength: 20, maxLength: 34 }),
        fc.integer({ min: 1, max: 14 }),
        fc.boolean(),
        fc.integer(),
        (cards, handSize, hasLaidDown, seed) => {
          const hand = cards.slice(0, handSize);
          const tableCards = cards.slice(handSize + 1);
          // Table melds picked greedily from the other cards (an exhaustive packing of 30 cards
          // would be slow, and any disjoint set of valid melds will do).
          const taken = new Set<string>();
          const melds: Meld[] = [];
          for (const candidate of enumerateMelds(tableCards)) {
            const picked = new Set<string>();
            const cards = candidate.cards.map((c) => {
              const f = tableCards.find((f) => !taken.has(f.id) && !picked.has(f.id) && multiset([f]) === multiset([c]));
              if (f) picked.add(f.id);
              return f;
            });
            if (cards.some((c) => !c)) continue;
            for (const id of picked) taken.add(id);
            melds.push({ id: `t${melds.length}`, kind: candidate.kind, cards: cards as Card[], ownerId: "p2" });
          }
          const rest = tableCards.filter((c) => !taken.has(c.id));
          const state = tableState(hand, rest, melds, hasLaidDown, [cards[handSize]!]);
          assertConserved(state);
          const after = botTurn(state, seed);
          assertConserved(after);
          expect(after.currentIndex !== 0 || after.phase === "finished").toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("bots never play an illegal action, from any seed", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 2, max: 6 }), (seed, players) => {
        const { state, act } = botTable(seed, players);
        playRound(act(state, "p1", { type: "start" }), act, 600);
      }),
      { numRuns: 40 },
    );
  });
});

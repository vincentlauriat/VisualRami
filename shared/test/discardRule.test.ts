import { describe, expect, it } from "vitest";
import { seededRng } from "../src/cards.js";
import { addPlayer, applyAction, createGame, currentPlayer } from "../src/game.js";
import { canPlaceCard } from "../src/placement.js";
import type { Card, GameState, Meld, Rank, Suit } from "../src/types.js";

const rng = seededRng(7);
const card = (rank: Rank, suit: Suit, id: string): Card => ({ id, rank, suit, joker: false });
const joker = (id: string): Card => ({ id, rank: null, suit: null, joker: true }) as unknown as Card;
const rules = { firstMeldMinPoints: 51, requirePureRun: true };

function table(hand: Card[], top: Card, opts: { laid?: boolean; melds?: Meld[] } = {}): GameState {
  let state = createGame("ROOM", { id: "a", name: "Alice" });
  const r = addPlayer(state, { id: "b", name: "Bob" });
  if (!r.ok) throw new Error(r.error);
  const s = applyAction(r.state, "a", { type: "start" }, rng);
  if (!s.ok) throw new Error(s.error);
  state = s.state;
  const me = currentPlayer(state)!;
  return {
    ...state,
    discard: [...state.discard, top],
    melds: opts.melds ?? [],
    players: state.players.map((p) => (p.id === me.id ? { ...p, hand, hasLaidDown: opts.laid ?? false } : p)),
  };
}

describe("taking from the discard pile (rule B)", () => {
  // A pure run 10-J-Q of hearts is worth 30: not enough to open at 51 alone.
  const open51 = [
    card(10, "hearts", "h10"), card(11, "hearts", "h11"), card(12, "hearts", "h12"),
    card(9, "spades", "s9"), card(9, "clubs", "c9"), card(9, "diamonds", "d9"),
    card(2, "clubs", "c2"),
  ];

  it("refuses a card that could not be laid down this turn", () => {
    const state = table(open51, card(4, "spades", "s4"));
    const me = currentPlayer(state)!;
    const r = applyAction(state, me.id, { type: "draw", source: "discard" }, rng);
    expect(r.ok).toBe(false);
    expect(applyAction(state, me.id, { type: "draw", source: "stock" }, rng).ok).toBe(true);
  });

  it("accepts a card that completes the opening", () => {
    // Without the king the hand opens at 30 + 27 = 57? Make the king the missing piece.
    const hand = [card(10, "hearts", "h10"), card(11, "hearts", "h11"), card(12, "hearts", "h12"),
      card(9, "spades", "s9"), card(9, "clubs", "c9"), card(2, "clubs", "c2")];
    const state = table(hand, card(9, "diamonds", "d9"));
    const me = currentPlayer(state)!;
    expect(applyAction(state, me.id, { type: "draw", source: "discard" }, rng).ok).toBe(true);
  });

  it("refuses a card that completes a meld below the opening threshold", () => {
    const hand = [card(3, "hearts", "h3"), card(4, "hearts", "h4"), card(5, "hearts", "h5"), card(13, "clubs", "k")];
    const state = table(hand, card(6, "hearts", "h6"));
    expect(canPlaceCard([...hand, card(6, "hearts", "h6")], card(6, "hearts", "h6"), [], false, rules)).toBe(false);
    const me = currentPlayer(state)!;
    expect(applyAction(state, me.id, { type: "draw", source: "discard" }, rng).ok).toBe(false);
  });

  it("accepts an extension once the player has opened", () => {
    const meld: Meld = { id: "m1", kind: "run", ownerId: "b", cards: [card(5, "hearts", "a5"), card(6, "hearts", "a6"), card(7, "hearts", "a7")] };
    const hand = [card(13, "clubs", "k"), card(2, "spades", "s2")];
    const state = table(hand, card(8, "hearts", "h8"), { laid: true, melds: [meld] });
    const me = currentPlayer(state)!;
    expect(applyAction(state, me.id, { type: "draw", source: "discard" }, rng).ok).toBe(true);
  });

  it("takes a joker back when the card can replace it", () => {
    const meld: Meld = { id: "m1", kind: "run", ownerId: "b", cards: [card(5, "hearts", "a5"), joker("j1"), card(7, "hearts", "a7")] };
    const hand = [card(13, "clubs", "k")];
    const top = card(6, "hearts", "h6");
    expect(canPlaceCard([...hand, top], top, [meld], true, rules)).toBe(true);
    expect(canPlaceCard([...hand, top], top, [meld], false, rules)).toBe(false);
  });

  it("makes the player lay the card down before discarding another", () => {
    const meld: Meld = { id: "m1", kind: "run", ownerId: "b", cards: [card(5, "hearts", "a5"), card(6, "hearts", "a6"), card(7, "hearts", "a7")] };
    let state = table([card(13, "clubs", "k"), card(2, "spades", "s2")], card(8, "hearts", "h8"), { laid: true, melds: [meld] });
    const me = currentPlayer(state)!;
    const drawn = applyAction(state, me.id, { type: "draw", source: "discard" }, rng);
    if (!drawn.ok) throw new Error(drawn.error);
    state = drawn.state;
    const refused = applyAction(state, me.id, { type: "discard", cardId: "k" }, rng);
    expect(refused.ok).toBe(false);
    const ext = applyAction(state, me.id, { type: "extend", meldId: "m1", cardIds: ["h8"], position: "end" }, rng);
    if (!ext.ok) throw new Error(ext.error);
    expect(applyAction(ext.state, me.id, { type: "discard", cardId: "k" }, rng).ok).toBe(true);
  });

  it("lets a player discard when the taken card can no longer be placed", () => {
    const state = table([card(13, "clubs", "k"), card(2, "spades", "s2")], card(8, "hearts", "h8"), { laid: true });
    const me = currentPlayer(state)!;
    // A saved table from before the rule: the card is in hand, nothing takes it.
    const stuck = {
      ...state,
      phase: "play" as const,
      drewFromDiscardCardId: "h8",
      players: state.players.map((p) => (p.id === me.id ? { ...p, hand: [card(13, "clubs", "k"), card(8, "hearts", "h8")] } : p)),
    };
    expect(applyAction(stuck, me.id, { type: "discard", cardId: "k" }, rng).ok).toBe(true);
  });
});

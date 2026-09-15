import { describe, expect, it } from "vitest";
import { seededRng } from "../src/cards.js";
import { addPlayer, applyAction, autoPlayTurn, createGame, currentPlayer, setConnected, toPublicState } from "../src/game.js";
import type { Card, GameState, Rank, Suit } from "../src/types.js";

const rng = seededRng(42);

function setup(): GameState {
  let state = createGame("ROOM", { id: "a", name: "Alice" });
  const r = addPlayer(state, { id: "b", name: "Bob" });
  if (!r.ok) throw new Error(r.error);
  state = r.state;
  const s = applyAction(state, "a", { type: "start" }, rng);
  if (!s.ok) throw new Error(s.error);
  return s.state;
}

function must(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

const card = (rank: Rank, suit: Suit, id: string): Card => ({ id, rank, suit, joker: false });

describe("game flow", () => {
  it("deals 14 cards each and one discard", () => {
    const state = setup();
    expect(state.players.every((p) => p.hand.length === 14)).toBe(true);
    expect(state.discard).toHaveLength(1);
    expect(state.stock).toHaveLength(108 - 28 - 1);
    expect(state.phase).toBe("draw");
  });

  it("refuses to start with a single player", () => {
    const state = createGame("R", { id: "a", name: "A" });
    expect(applyAction(state, "a", { type: "start" }, rng).ok).toBe(false);
  });

  it("enforces turn order and draw-before-play", () => {
    const state = setup();
    const other = state.players[1]!.id;
    expect(applyAction(state, other, { type: "draw", source: "stock" }, rng)).toMatchObject({
      ok: false,
      error: "Ce n'est pas votre tour",
    });
    const me = currentPlayer(state)!;
    expect(applyAction(state, me.id, { type: "discard", cardId: me.hand[0]!.id }, rng).ok).toBe(false);
  });

  it("draws, discards and passes the turn", () => {
    let state = setup();
    const me = currentPlayer(state)!;
    state = must(applyAction(state, me.id, { type: "draw", source: "stock" }, rng));
    expect(state.phase).toBe("play");
    const hand = state.players.find((p) => p.id === me.id)!.hand;
    expect(hand).toHaveLength(15);
    state = must(applyAction(state, me.id, { type: "discard", cardId: hand[0]!.id }, rng));
    expect(state.phase).toBe("draw");
    expect(currentPlayer(state)!.id).not.toBe(me.id);
    expect(state.discard).toHaveLength(2);
  });

  it("cannot discard the card taken from the discard pile, except as the last card", () => {
    let state = setup();
    const me = currentPlayer(state)!;
    const top = state.discard[0]!;
    state = must(applyAction(state, me.id, { type: "draw", source: "discard" }, rng));
    const r = applyAction(state, me.id, { type: "discard", cardId: top.id }, rng);
    expect(r.ok).toBe(false);
    const lastCard = { ...state, players: state.players.map((p) => (p.id === me.id ? { ...p, hand: [top] } : p)) };
    const last = applyAction(lastCard, me.id, { type: "discard", cardId: top.id }, rng);
    expect(last.ok).toBe(true);
  });

  it("validates the first laydown and lets the player extend afterwards", () => {
    let state = setup();
    const me = currentPlayer(state)!;
    // Rig the hand for a deterministic scenario.
    const hand: Card[] = [
      card(10, "hearts", "h10"),
      card(11, "hearts", "h11"),
      card(12, "hearts", "h12"),
      card(9, "spades", "s9"),
      card(9, "clubs", "c9"),
      card(9, "diamonds", "d9"),
      card(13, "hearts", "h13"),
      card(2, "clubs", "c2"),
    ];
    state = { ...state, players: state.players.map((p) => (p.id === me.id ? { ...p, hand } : p)) };
    state = must(applyAction(state, me.id, { type: "draw", source: "stock" }, rng));

    // 30 + 27 = 57 points with a pure run
    const tooFew = applyAction(state, me.id, { type: "layDown", melds: [["h10", "h11", "h12"]] }, rng);
    expect(tooFew.ok).toBe(false);

    state = must(
      applyAction(
        state,
        me.id,
        { type: "layDown", melds: [["h10", "h11", "h12"], ["s9", "c9", "d9"]] },
        rng,
      ),
    );
    expect(state.melds).toHaveLength(2);
    const player = state.players.find((p) => p.id === me.id)!;
    expect(player.hasLaidDown).toBe(true);
    expect(player.hand.map((c) => c.id)).toContain("h13");

    const run = state.melds.find((m) => m.kind === "run")!;
    state = must(
      applyAction(state, me.id, { type: "extend", meldId: run.id, cardIds: ["h13"], position: "end" }, rng),
    );
    expect(state.melds.find((m) => m.id === run.id)!.cards).toHaveLength(4);

    const bad = applyAction(
      state,
      me.id,
      { type: "extend", meldId: run.id, cardIds: ["c2"], position: "end" },
      rng,
    );
    expect(bad.ok).toBe(false);
  });

  it("swaps a joker from a meld with the real card", () => {
    let state = setup();
    const me = currentPlayer(state)!;
    const joker: Card = { id: "jk", suit: null, rank: null, joker: true };
    const hand: Card[] = [
      card(10, "hearts", "h10"),
      card(11, "hearts", "h11"),
      card(12, "hearts", "h12"),
      card(9, "spades", "s9"),
      joker,
      card(9, "diamonds", "d9"),
      card(9, "clubs", "c9"),
      card(2, "clubs", "c2"),
    ];
    state = { ...state, players: state.players.map((p) => (p.id === me.id ? { ...p, hand } : p)) };
    state = must(applyAction(state, me.id, { type: "draw", source: "stock" }, rng));
    state = must(
      applyAction(
        state,
        me.id,
        { type: "layDown", melds: [["h10", "h11", "h12"], ["s9", "jk", "d9"]] },
        rng,
      ),
    );
    const set = state.melds.find((m) => m.kind === "set")!;
    state = must(applyAction(state, me.id, { type: "swapJoker", meldId: set.id, cardId: "c9" }, rng));
    const player = state.players.find((p) => p.id === me.id)!;
    expect(player.hand.some((c) => c.joker)).toBe(true);
    expect(state.melds.find((m) => m.id === set.id)!.cards.every((c) => !c.joker)).toBe(true);
  });

  it("finishes the round when a player discards the last card and scores others", () => {
    let state = setup();
    const me = currentPlayer(state)!;
    const other = state.players.find((p) => p.id !== me.id)!;
    const hand: Card[] = [
      card(10, "hearts", "h10"),
      card(11, "hearts", "h11"),
      card(12, "hearts", "h12"),
      card(9, "spades", "s9"),
      card(9, "clubs", "c9"),
      card(9, "diamonds", "d9"),
    ];
    const otherHand: Card[] = [card(13, "clubs", "ck"), card(1, "clubs", "ca")];
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === me.id ? { ...p, hand } : { ...p, hand: otherHand },
      ),
    };
    state = must(applyAction(state, me.id, { type: "draw", source: "stock" }, rng));
    state = must(
      applyAction(
        state,
        me.id,
        { type: "layDown", melds: [["h10", "h11", "h12"], ["s9", "c9", "d9"]] },
        rng,
      ),
    );
    const last = state.players.find((p) => p.id === me.id)!.hand[0]!;
    state = must(applyAction(state, me.id, { type: "discard", cardId: last.id }, rng));
    expect(state.phase).toBe("finished");
    expect(state.winnerId).toBe(me.id);
    // 10 + 11 = 21, doubled because the other player never laid down
    expect(state.lastRoundPoints![other.id]).toBe(42);
    expect(state.players.find((p) => p.id === other.id)!.score).toBe(42);

    const next = must(applyAction(state, state.hostId, { type: "newRound" }, rng));
    expect(next.round).toBe(2);
    expect(next.phase).toBe("draw");
  });

  it("hides other hands in the public view", () => {
    const state = setup();
    const pub = toPublicState(state, "a");
    expect(pub.you.hand).toHaveLength(14);
    expect(pub.players.find((p) => p.id === "b")!.handCount).toBe(14);
    expect((pub as unknown as { stock?: unknown }).stock).toBeUndefined();
    expect((pub as unknown as { discard?: unknown }).discard).toBeUndefined();
    expect(pub.discardTop).toEqual(state.discard[0]);
    expect(pub.discardCount).toBe(1);
  });
});

describe("absent players", () => {
  it("auto-plays a turn: draws from the stock then discards, never the discard-pile card", () => {
    let state = setup();
    const me = currentPlayer(state)!;
    const auto = autoPlayTurn(state, me.id, rng);
    expect(auto.ok).toBe(true);
    state = (auto as { ok: true; state: GameState }).state;
    expect(state.players.find((p) => p.id === me.id)!.hand).toHaveLength(14);
    expect(state.discard).toHaveLength(2);
    expect(currentPlayer(state)!.id).not.toBe(me.id);
    expect(state.log.at(-1)).toMatch(/absent/);
    expect(autoPlayTurn(state, me.id, rng).ok).toBe(false);
  });

  it("hands the host role to a connected player", () => {
    const state = setup();
    const next = setConnected(state, "a", false);
    expect(next.hostId).toBe("b");
  });
});

describe("table size", () => {
  it("seats up to six players and deals them all, refusing a seventh", () => {
    let state = createGame("R", { id: "p1", name: "P1" });
    for (let i = 2; i <= 6; i++) {
      const r = addPlayer(state, { id: `p${i}`, name: `P${i}` });
      expect(r.ok).toBe(true);
      state = (r as { ok: true; state: GameState }).state;
    }
    expect(addPlayer(state, { id: "p7", name: "P7" })).toMatchObject({ ok: false });
    const started = applyAction(state, "p1", { type: "start" }, rng);
    expect(started.ok).toBe(true);
    const dealt = (started as { ok: true; state: GameState }).state;
    expect(dealt.players).toHaveLength(6);
    expect(dealt.players.every((p) => p.hand.length === 14)).toBe(true);
    expect(dealt.stock).toHaveLength(108 - 6 * 14 - 1);
  });
});

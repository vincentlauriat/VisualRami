import { describe, expect, it } from "vitest";
import { seededRng } from "../src/cards.js";
import { addPlayer, applyAction, autoPlayTurn, createGame, currentPlayer, removePlayer, setConnected, toPublicState } from "../src/game.js";
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

/** Play a two-player round to its end: the current player lays everything down and goes out. */
function finishedRound(): { state: GameState; winner: string; loser: string } {
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
  state = {
    ...state,
    players: state.players.map((p) =>
      p.id === me.id ? { ...p, hand } : { ...p, hand: [card(13, "clubs", "ck"), card(1, "clubs", "ca")] },
    ),
  };
  state = must(applyAction(state, me.id, { type: "draw", source: "stock" }, rng));
  state = must(applyAction(state, me.id, { type: "layDown", melds: [["h10", "h11", "h12"], ["s9", "c9", "d9"]] }, rng));
  const last = state.players.find((p) => p.id === me.id)!.hand[0]!;
  state = must(applyAction(state, me.id, { type: "discard", cardId: last.id }, rng));
  return { state, winner: me.id, loser: other.id };
}

describe("end of round", () => {
  it("never shows another player's hand while the round is played", () => {
    let state = setup();
    for (const viewer of ["a", "b"]) {
      const pub = toPublicState(state, viewer);
      expect(pub.revealedHands).toBeNull();
      expect(JSON.stringify(pub.players)).not.toMatch(/"hand"/);
    }
    const me = currentPlayer(state)!;
    state = must(applyAction(state, me.id, { type: "draw", source: "stock" }, rng));
    expect(state.phase).toBe("play");
    const watcher = state.players.find((p) => p.id !== me.id)!.id;
    const pub = toPublicState(state, watcher);
    expect(pub.revealedHands).toBeNull();
    // The only cards in the payload are the viewer's own, the discard top and the melds.
    const mine = new Set(pub.you.hand.map((c) => c.id));
    const others = state.players.find((p) => p.id === me.id)!.hand.filter((c) => !mine.has(c.id));
    for (const c of others) expect(JSON.stringify(pub)).not.toContain(`"${c.id}"`);
  });

  it("refuses a laydown that would use every card in hand", () => {
    let state = setup();
    const me = currentPlayer(state)!;
    const hand: Card[] = [card(10, "hearts", "h10"), card(11, "hearts", "h11"), card(12, "hearts", "h12")];
    state = {
      ...state,
      options: { ...state.options, firstMeldMinPoints: 0, requirePureRun: false },
      players: state.players.map((p) => (p.id === me.id ? { ...p, hand } : p)),
      stock: [card(9, "spades", "s9"), ...state.stock],
    };
    state = must(applyAction(state, me.id, { type: "draw", source: "stock" }, rng));
    const run = { type: "layDown" as const, melds: [["h10", "h11", "h12"]] };
    // Holding only the run, laying it would leave nothing to discard.
    const onlyRun = { ...state, players: state.players.map((p) => (p.id === me.id ? { ...p, hand } : p)) };
    expect(applyAction(onlyRun, me.id, run, rng)).toMatchObject({ ok: false, error: /garder une carte/ });
    // With the 9 of spades drawn, the same laydown keeps a card to discard.
    expect(applyAction(state, me.id, run, rng).ok).toBe(true);
  });

  it("logs a laydown with the right plural", () => {
    const { state, winner } = finishedRound();
    const name = state.players.find((p) => p.id === winner)!.name;
    expect(state.log).toContain(`${name} pose 2 combinaisons`);
    expect(state.log.some((line) => line.includes("combinaison(s)"))).toBe(false);
  });

  it("turns every losing hand face up for everyone once the round is over", () => {
    const { state, winner, loser } = finishedRound();
    for (const viewer of [winner, loser]) {
      const pub = toPublicState(state, viewer);
      expect(pub.revealedHands).toEqual({ [loser]: state.players.find((p) => p.id === loser)!.hand });
      expect(pub.revealedHands![winner]).toBeUndefined();
    }
    const next = must(applyAction(state, state.hostId, { type: "newRound" }, rng));
    expect(toPublicState(next, winner).revealedHands).toBeNull();
  });

  it("lets the other players say they are ready, and empties readiness at the next deal", () => {
    const { state } = finishedRound();
    const guest = state.players.find((p) => p.id !== state.hostId)!.id;
    expect(state.ready).toEqual([]);
    expect(applyAction(state, state.hostId, { type: "ready", ready: true }).ok).toBe(false);

    let next = must(applyAction(state, guest, { type: "ready", ready: true }));
    expect(toPublicState(next, state.hostId).ready).toEqual([guest]);
    next = must(applyAction(next, guest, { type: "ready", ready: true })); // idempotent
    expect(next.ready).toEqual([guest]);
    expect(must(applyAction(next, guest, { type: "ready", ready: false })).ready).toEqual([]);

    const round2 = must(applyAction(next, state.hostId, { type: "newRound" }, rng));
    expect(round2.ready).toEqual([]);
    expect(applyAction(round2, guest, { type: "ready", ready: true }).ok).toBe(false);
  });
});

describe("leaving a started game", () => {
  it("keeps the seat, and logs the departure only when the player chose to leave", () => {
    const state = setup();
    const dropped = removePlayer(state, "b");
    expect(dropped.players.find((p) => p.id === "b")!.connected).toBe(false);
    expect(dropped.log).toEqual(state.log);

    const left = removePlayer(state, "b", true);
    expect(left.players).toHaveLength(2);
    expect(left.players.find((p) => p.id === "b")!.connected).toBe(false);
    expect(left.log.at(-1)).toBe("Bob a quitté la table");
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

describe("meld ids", () => {
  it("uses an injected id generator, so a seeded replay is identical", () => {
    const play = (): GameState => {
      let state = setup();
      const me = currentPlayer(state)!;
      const hand: Card[] = [
        card(10, "hearts", "h10"),
        card(11, "hearts", "h11"),
        card(12, "hearts", "h12"),
        card(9, "spades", "s9"),
        card(9, "clubs", "c9"),
        card(9, "diamonds", "d9"),
        card(2, "clubs", "c2"),
      ];
      state = { ...state, players: state.players.map((p) => (p.id === me.id ? { ...p, hand } : p)) };
      let n = 0;
      const ids = { meldId: () => `id${++n}` };
      state = must(applyAction(state, me.id, { type: "draw", source: "stock" }, rng, ids));
      return must(
        applyAction(state, me.id, { type: "layDown", melds: [["h10", "h11", "h12"], ["s9", "c9", "d9"]] }, rng, ids),
      );
    };
    const first = play();
    expect(first.melds.map((m) => m.id)).toEqual(["id1", "id2"]);
    expect(play().melds).toEqual(first.melds);
  });
});

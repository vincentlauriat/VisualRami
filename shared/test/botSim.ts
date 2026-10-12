import { buildDeck, seededRng } from "../src/cards.js";
import { planTurn } from "../src/bot/index.js";
import { addPlayer, applyAction, createGame, currentPlayer, toPublicState } from "../src/game.js";
import type { GameAction, GameState } from "../src/types.js";

const DECK_IDS = buildDeck().map((c) => c.id).sort().join(",");

/** Every one of the 108 cards is somewhere, exactly once. */
export function assertConserved(state: GameState): void {
  const ids = [
    ...state.players.flatMap((p) => p.hand),
    ...state.stock,
    ...state.discard,
    ...state.melds.flatMap((m) => m.cards),
  ].map((c) => c.id);
  if (ids.length !== 108 || ids.sort().join(",") !== DECK_IDS) {
    throw new Error(`Cards not conserved: ${ids.length} cards`);
  }
}

export interface RoundStats {
  turns: number;
  decisions: number;
  decisionMs: number;
  slowestMs: number;
  /** Draws where the stock was empty and the discard pile held one card: only that card was left. */
  forcedDiscardDraws: number;
  winnerId: string | null;
}

export class IllegalAction extends Error {}

/** A table of `players` bots, dealt with a fixed seed, ready for its first round. */
export function botTable(seed: number, players: number) {
  const rng = seededRng(seed);
  let n = 0;
  const ids = { meldId: () => `m${++n}` };
  let state = createGame("SIM", { id: "p1", name: "P1" });
  for (let i = 2; i <= players; i++) {
    const r = addPlayer(state, { id: `p${i}`, name: `P${i}` });
    if (!r.ok) throw new Error(r.error);
    state = r.state;
  }
  const act = (s: GameState, playerId: string, action: GameAction): GameState => {
    const r = applyAction(s, playerId, action, rng, ids);
    if (!r.ok) throw new IllegalAction(`${playerId} ${JSON.stringify(action)}: ${r.error}`);
    return r.state;
  };
  return { state, act };
}

/**
 * Plays one round to its end with bots on every seat, applying each planned action through the
 * reducer and checking the 108 cards after each one. Throws on an illegal action, an empty plan,
 * or a round that outlasts `maxTurns`.
 */
export function playRound(
  start: GameState,
  act: (s: GameState, playerId: string, action: GameAction) => GameState,
  maxTurns: number,
): { state: GameState; stats: RoundStats } {
  let state = start;
  const stats: RoundStats = {
    turns: 0,
    decisions: 0,
    decisionMs: 0,
    slowestMs: 0,
    forcedDiscardDraws: 0,
    winnerId: null,
  };
  while (state.phase !== "finished") {
    if (++stats.turns > maxTurns) {
      throw new Error(
        `Round did not end in ${maxTurns} turns: stock ${state.stock.length}, discard ${state.discard.length}, ` +
          `hands ${state.players.map((p) => `${p.hand.length}${p.hasLaidDown ? "*" : ""}`).join("/")}`,
      );
    }
    const playerId = currentPlayer(state)!.id;
    // Two decisions per turn: the draw, then the play phase ending with the discard.
    for (let call = 0; call < 2 && state.phase !== "finished" && currentPlayer(state)!.id === playerId; call++) {
      const view = toPublicState(state, playerId);
      const t0 = performance.now();
      const actions = planTurn(view);
      const ms = performance.now() - t0;
      stats.decisionMs += ms;
      stats.slowestMs = Math.max(stats.slowestMs, ms);
      if (view.phase === "draw" && view.stockCount === 0 && view.discardCount === 1) stats.forcedDiscardDraws++;
      stats.decisions++;
      if (actions.length === 0) throw new IllegalAction(`${playerId}: empty plan in phase ${state.phase}`);
      for (const action of actions) {
        state = act(state, playerId, action);
        assertConserved(state);
      }
    }
    if (state.phase !== "finished" && currentPlayer(state)!.id === playerId) {
      throw new IllegalAction(`${playerId}: turn did not end after draw and play`);
    }
  }
  stats.winnerId = state.winnerId;
  return { state, stats };
}

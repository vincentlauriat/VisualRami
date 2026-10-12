import { buildDeck, seededRng } from "../src/cards.js";
import { planTurn } from "../src/bot/index.js";
import { addPlayer, applyAction, createGame, currentPlayer, toPublicState } from "../src/game.js";
import type { GameAction, GameOptions, GameState } from "../src/types.js";
import type { PlanOptions } from "../src/bot/index.js";

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
  budgetHits: number;
  /** Null for a drawn round: the stock ran out once too often. */
  winnerId: string | null;
}

/** The reducer refused a planned action, or the plan could not end the turn: a bot bug. */
export class IllegalAction extends Error {}

/** A round outlasted the turn cap: a dead end in the rules or a bot that never ends anything. */
export class TurnLimitExceeded extends Error {}

/** A table of `players` bots, dealt with a fixed seed, ready for its first round. */
export function botTable(seed: number, players: number, options: Partial<GameOptions> = {}) {
  const rng = seededRng(seed);
  let n = 0;
  const ids = { meldId: () => `m${++n}` };
  let state = createGame("SIM", { id: "p1", name: "P1" }, options);
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
  plan: PlanOptions = {},
): { state: GameState; stats: RoundStats } {
  let state = start;
  const stats: RoundStats = {
    turns: 0,
    decisions: 0,
    decisionMs: 0,
    slowestMs: 0,
    budgetHits: 0,
    winnerId: null,
  };
  while (state.phase !== "finished") {
    if (++stats.turns > maxTurns) {
      throw new TurnLimitExceeded(
        `Round did not end in ${maxTurns} turns: stock ${state.stock.length}, discard ${state.discard.length}, ` +
          `hands ${state.players.map((p) => `${p.hand.length}${p.hasLaidDown ? "*" : ""}`).join("/")}`,
      );
    }
    const playerId = currentPlayer(state)!.id;
    // Two decisions per turn: the draw, then the play phase ending with the discard.
    for (let call = 0; call < 2 && state.phase !== "finished" && currentPlayer(state)!.id === playerId; call++) {
      const view = toPublicState(state, playerId);
      const t0 = performance.now();
      const budget = { budgetHits: 0 };
      const actions = planTurn(view, undefined, { ...plan, stats: budget });
      stats.budgetHits += budget.budgetHits;
      const ms = performance.now() - t0;
      stats.decisionMs += ms;
      stats.slowestMs = Math.max(stats.slowestMs, ms);
      // Defensive: every turn ends on a discard, so an empty stock always leaves two cards or more
      // in the discard pile to reshuffle. A draw with nothing to draw would be an engine bug.
      if (view.phase === "draw" && view.stockCount === 0 && view.discardCount <= 1) {
        throw new Error(`${playerId}: a draw with nothing to draw`);
      }
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

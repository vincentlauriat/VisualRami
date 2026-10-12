import { describe, expect, it } from "vitest";
import { botTable, playRound, type RoundStats } from "./botSim.js";
import type { PlanOptions } from "../src/bot/index.js";
import type { GameOptions, GameState } from "../src/types.js";

/**
 * Well above the longest round measured: 317 turns, 2 bots at a threshold of 200, where nobody
 * can open and the round runs until the stock is exhausted a fourth time.
 */
const MAX_TURNS = 1000;

/** A whole game of easy bots: several rounds, the host dealing each new one. */
function playGame(
  seed: number,
  players: number,
  rounds: number,
  options: Partial<GameOptions> = {},
  plan: PlanOptions = {},
): { state: GameState; rounds: RoundStats[] } {
  const { state: lobby, act } = botTable(seed, players, options);
  let state = act(lobby, "p1", { type: "start" });
  const stats: RoundStats[] = [];
  for (let r = 0; r < rounds; r++) {
    if (r > 0) state = act(state, state.hostId, { type: "newRound" });
    const played = playRound(state, act, MAX_TURNS, plan);
    state = played.state;
    stats.push(played.stats);
  }
  return { state, rounds: stats };
}

/** Measured, not asserted: reported in the computer player design doc. */
function report(label: string, rounds: RoundStats[]) {
  const turns = rounds.reduce((s, r) => s + r.turns, 0);
  const decisions = rounds.reduce((s, r) => s + r.decisions, 0);
  const ms = rounds.reduce((s, r) => s + r.decisionMs, 0);
  console.log(
    `[bot-sim] ${label}, ${rounds.length} rounds: ${(turns / rounds.length).toFixed(1)} turns/round ` +
      `(max ${Math.max(...rounds.map((r) => r.turns))}), ${(ms / decisions).toFixed(3)} ms/decision ` +
      `(slowest ${Math.max(...rounds.map((r) => r.slowestMs)).toFixed(1)} ms), ` +
      `drawn rounds ${rounds.filter((r) => r.winnerId === null).length}, ` +
      `budget hits ${rounds.reduce((s, r) => s + r.budgetHits, 0)}`,
  );
}

/** Every planned action goes through the reducer, and the 108 cards are checked after each one. */
function table(label: string, games: number, rounds: number, options: Partial<GameOptions> = {}) {
  for (let players = 2; players <= 6; players++) {
    it(`${label}, ${players} bots: every action legal, every round ends`, () => {
      const all: RoundStats[] = [];
      for (let g = 0; g < games; g++) all.push(...playGame(1000 * players + g, players, rounds, options).rounds);
      expect(all).toHaveLength(games * rounds);
      report(`${label}, ${players} bots`, all);
    });
  }
}

describe("easy bots against each other", () => {
  table("51 points", 6, 5);
  // The highest threshold a new table may ask for.
  table("100 points", 3, 2, { firstMeldMinPoints: 100 });
  // Tables saved before the cap: nobody can open, every round is drawn by the reshuffle limit.
  table("200 points", 1, 1, { firstMeldMinPoints: 200 });

  it("replays identically from the same seed, without a time budget", () => {
    const a = playGame(77, 4, 5, {}, { budgetMs: Infinity });
    const b = playGame(77, 4, 5, {}, { budgetMs: Infinity });
    expect(b.state).toEqual(a.state);
    expect(b.rounds.map((r) => r.turns)).toEqual(a.rounds.map((r) => r.turns));
  });

  it("stays legal with no time at all: searches stop at once and the bot just plays worse", () => {
    const { rounds } = playGame(5, 3, 3, {}, { budgetMs: 0 });
    expect(rounds.every((r) => r.budgetHits > 0)).toBe(true);
  });
});

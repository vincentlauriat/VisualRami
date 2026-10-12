import { describe, expect, it } from "vitest";
import { botTable, playRound, type RoundStats } from "./botSim.js";
import type { GameState } from "../src/types.js";

const GAMES_PER_TABLE = 12;
const ROUNDS_PER_GAME = 5;
const MAX_TURNS = 600;

/** A whole game of easy bots: several rounds, the host dealing each new one. */
function playGame(seed: number, players: number): { state: GameState; rounds: RoundStats[] } {
  const { state: lobby, act } = botTable(seed, players);
  let state = act(lobby, "p1", { type: "start" });
  const rounds: RoundStats[] = [];
  for (let r = 0; r < ROUNDS_PER_GAME; r++) {
    if (r > 0) state = act(state, state.hostId, { type: "newRound" });
    const played = playRound(state, act, MAX_TURNS);
    state = played.state;
    rounds.push(played.stats);
  }
  return { state, rounds };
}

describe("easy bots against each other", () => {
  for (let players = 2; players <= 6; players++) {
    it(`${players} bots: every action legal, every round ends, the 108 cards conserved`, () => {
      const rounds: RoundStats[] = [];
      for (let g = 0; g < GAMES_PER_TABLE; g++) rounds.push(...playGame(1000 * players + g, players).rounds);
      expect(rounds).toHaveLength(GAMES_PER_TABLE * ROUNDS_PER_GAME);
      expect(rounds.every((r) => r.winnerId !== null)).toBe(true);
      // Measured, not asserted: reported in the computer player design doc.
      const turns = rounds.reduce((s, r) => s + r.turns, 0);
      const decisions = rounds.reduce((s, r) => s + r.decisions, 0);
      const ms = rounds.reduce((s, r) => s + r.decisionMs, 0);
      console.log(
        `[bot-sim] ${players} bots, ${rounds.length} rounds: ${(turns / rounds.length).toFixed(1)} turns/round ` +
          `(max ${Math.max(...rounds.map((r) => r.turns))}), ${(ms / decisions).toFixed(3)} ms/decision ` +
          `(slowest ${Math.max(...rounds.map((r) => r.slowestMs)).toFixed(1)} ms), ` +
          `forced discard draws ${rounds.reduce((s, r) => s + r.forcedDiscardDraws, 0)}`,
      );
    });
  }

  it("replays identically from the same seed", () => {
    const a = playGame(77, 4);
    const b = playGame(77, 4);
    expect(b.state).toEqual(a.state);
    expect(b.rounds.map((r) => r.turns)).toEqual(a.rounds.map((r) => r.turns));
  });
});

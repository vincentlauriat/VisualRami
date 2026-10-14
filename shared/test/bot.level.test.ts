import { describe, expect, it } from "vitest";
import { botTable, playRound } from "./botSim.js";
import type { BotLevel, GameState } from "../src/types.js";

/** Alternating levels around the table, starting with `first`. */
const levelsFor = (players: number, first: BotLevel): BotLevel[] =>
  Array.from({ length: players }, (_, i) => ((i % 2 === 0) === (first === "medium") ? "medium" : "easy"));

/** One game of `rounds` rounds from `seed`; returns the penalty points and round wins by level. */
function play(seed: number, levels: BotLevel[], rounds: number, actual: (l: BotLevel) => BotLevel) {
  const { state: lobby, act } = botTable(seed, levels.length);
  const seated: GameState = {
    ...lobby,
    players: lobby.players.map((p, i) => ({ ...p, isBot: true, level: actual(levels[i]!) })),
  };
  let state = act(seated, "p1", { type: "start" });
  const points: Record<BotLevel, number> = { easy: 0, medium: 0 };
  const wins: Record<BotLevel, number> = { easy: 0, medium: 0 };
  for (let r = 0; r < rounds; r++) {
    if (r > 0) state = act(state, state.hostId, { type: "newRound" });
    state = playRound(state, act, 1000, { budgetMs: Infinity }).state;
    state.players.forEach((p, i) => (points[levels[i]!] += state.lastRoundPoints![p.id]!));
    const w = state.players.findIndex((p) => p.id === state.winnerId);
    if (w >= 0) wins[levels[w]!]++;
  }
  return { points, wins };
}

/**
 * Every deal is played twice with the two levels' seats swapped, so the luck of the deal and of
 * the seat cancels out. `actual` maps a label to the level really played: the identity for the
 * real comparison, "easy" for both labels in the null run that must show no difference.
 */
export function duel(players: number, games: number, rounds: number, actual: (l: BotLevel) => BotLevel = (l) => l) {
  const total = { easy: 0, medium: 0 };
  const wins = { easy: 0, medium: 0 };
  let seats = 0;
  for (let g = 0; g < games; g++) {
    const seed = 9000 + 100 * players + g;
    for (const first of ["medium", "easy"] as const) {
      const levels = levelsFor(players, first);
      const r = play(seed, levels, rounds, actual);
      for (const l of ["easy", "medium"] as const) {
        total[l] += r.points[l];
        wins[l] += r.wins[l];
      }
      seats += rounds * levels.length;
    }
  }
  // Half the seats of every round are medium, half easy.
  const per = (l: BotLevel) => total[l] / (seats / 2);
  return { easy: per("easy"), medium: per("medium"), wins };
}

/** Games per configuration; CI keeps it short, raise it locally to tune (BOT_LEVEL_GAMES=300). */
const GAMES = Number(process.env.BOT_LEVEL_GAMES ?? 60);

describe("medium against easy", () => {
  for (const players of [2, 4]) {
    it(`${players} players: the medium level loses fewer points per round`, () => {
      const result = duel(players, GAMES, 4);
      console.log(
        `[bot-level] ${players} players: easy ${result.easy.toFixed(2)}, medium ${result.medium.toFixed(2)} ` +
          `(points per seat-round), round wins easy ${result.wins.easy} / medium ${result.wins.medium}`,
      );
      expect(result.medium).toBeLessThan(result.easy);
    }, 120_000);
  }

  it("null run: two labels, one level, no difference (the bench is not biased)", () => {
    const result = duel(2, 30, 4, () => "easy");
    expect(result.medium).toBeCloseTo(result.easy, 6);
    expect(result.wins.medium).toBe(result.wins.easy);
  }, 120_000);
});

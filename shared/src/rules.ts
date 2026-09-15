import type { Card, MeldKind } from "./types.js";

export interface MeldAnalysis {
  kind: MeldKind;
  /** Points of the meld for the first laydown threshold. */
  points: number;
  /** True when the meld contains no joker. */
  pure: boolean;
  /** For runs: the value (1..14, ace-high = 14) of each position. */
  values?: number[];
}

function meldPoints(value: number): number {
  // value 14 = ace high (11 points), value 1 = ace low (1 point)
  if (value === 14) return 11;
  if (value >= 10) return 10;
  return value;
}

/**
 * A set: 3 or 4 cards of the same rank with distinct suits.
 * Jokers may replace missing cards but never outnumber real cards.
 */
export function analyzeSet(cards: Card[]): MeldAnalysis | null {
  if (cards.length < 3 || cards.length > 4) return null;
  const real = cards.filter((c) => !c.joker);
  const jokers = cards.length - real.length;
  if (real.length === 0 || jokers > real.length) return null;
  const rank = real[0]!.rank!;
  if (!real.every((c) => c.rank === rank)) return null;
  const suits = new Set(real.map((c) => c.suit));
  if (suits.size !== real.length) return null;
  const value: number = rank === 1 ? 14 : rank;
  return {
    kind: "set",
    points: meldPoints(value) * cards.length,
    pure: jokers === 0,
  };
}

/**
 * A run: 3+ consecutive cards of the same suit, in the given order.
 * Ace may be low (A-2-3) or high (Q-K-A) but a run never wraps around.
 * Jokers may fill any position but never outnumber real cards.
 */
export function analyzeRun(cards: Card[]): MeldAnalysis | null {
  if (cards.length < 3 || cards.length > 14) return null;
  const real = cards.filter((c) => !c.joker);
  const jokers = cards.length - real.length;
  if (real.length === 0 || jokers > real.length) return null;
  const suit = real[0]!.suit!;
  if (!real.every((c) => c.suit === suit)) return null;

  for (const aceHigh of [false, true]) {
    let start: number | null = null;
    let consistent = true;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]!;
      if (card.joker) continue;
      let value: number = card.rank!;
      if (value === 1 && aceHigh) value = 14;
      const candidate = value - i;
      if (start === null) start = candidate;
      else if (start !== candidate) {
        consistent = false;
        break;
      }
    }
    if (!consistent || start === null) continue;
    const end = start + cards.length - 1;
    const low = aceHigh ? 2 : 1;
    const high = aceHigh ? 14 : 13;
    if (start < low || end > high) continue;
    const values: number[] = [];
    let points = 0;
    for (let i = 0; i < cards.length; i++) {
      const v = start + i;
      values.push(v);
      points += meldPoints(v);
    }
    return { kind: "run", points, pure: jokers === 0, values };
  }
  return null;
}

export function analyzeMeld(cards: Card[]): MeldAnalysis | null {
  return analyzeRun(cards) ?? analyzeSet(cards);
}

export function isValidMeld(cards: Card[]): boolean {
  return analyzeMeld(cards) !== null;
}

export interface FirstLaydownCheck {
  ok: boolean;
  points: number;
  hasPureRun: boolean;
  error?: string;
}

export function checkFirstLaydown(
  melds: Card[][],
  minPoints: number,
  requirePureRun: boolean,
): FirstLaydownCheck {
  let points = 0;
  let hasPureRun = false;
  for (const cards of melds) {
    const analysis = analyzeMeld(cards);
    if (!analysis) {
      return { ok: false, points: 0, hasPureRun: false, error: "Combinaison invalide" };
    }
    points += analysis.points;
    if (analysis.kind === "run" && analysis.pure) hasPureRun = true;
  }
  if (points < minPoints) {
    return {
      ok: false,
      points,
      hasPureRun,
      error: `Il faut au moins ${minPoints} points pour la première pose (${points} posés)`,
    };
  }
  if (requirePureRun && !hasPureRun) {
    return {
      ok: false,
      points,
      hasPureRun,
      error: "La première pose doit contenir une tierce franche (suite sans joker)",
    };
  }
  return { ok: true, points, hasPureRun };
}

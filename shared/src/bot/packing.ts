import { handCardPoints } from "../cards.js";
import { checkFirstLaydown } from "../rules.js";
import type { Card, GameOptions } from "../types.js";
import { cardKey, countKeys, enumerateMelds, JOKER_KEY, type CandidateMeld, type CardKey } from "./melds.js";

/** A set of disjoint melds the hand can lay down at once, with concrete cards. */
export interface Packing {
  melds: Card[][];
  /** The cards left in hand. */
  rest: Card[];
  /** Points of the melds as the engine counts them for the first laydown. */
  points: number;
  hasPureRun: boolean;
}

/** What a packing looks like to the objective, before cards are assigned. */
export interface PackingShape {
  melds: CandidateMeld[];
  restKeys: CardKey[];
  points: number;
  hasPureRun: boolean;
}

/** Ceiling on search nodes, so one decision stays bounded even on a freak hand. */
const MAX_NODES = 200_000;

/**
 * The best set of disjoint melds for `score` (higher wins; null rejects the packing). The search
 * runs over card keys and counts, so the twin copies of a card can sit in two different melds,
 * and every packing is visited once: the first key left is either kept in hand or covered by a
 * meld containing it. Concrete cards are assigned at the end.
 */
export function bestPacking(
  hand: Card[],
  score: (shape: PackingShape) => number | null,
  candidates: CandidateMeld[] = enumerateMelds(hand),
): Packing | null {
  const counts = countKeys(hand);
  // Jokers last: a joker is never the first card of a meld the search tries to build.
  const order = [...counts.keys()].sort((a, b) => (a === JOKER_KEY ? 1 : b === JOKER_KEY ? -1 : a < b ? -1 : 1));
  const byKey = new Map<CardKey, CandidateMeld[]>();
  for (const candidate of candidates) {
    for (const key of new Set(candidate.keys)) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(candidate);
    }
  }

  const chosen: CandidateMeld[] = [];
  const restKeys: CardKey[] = [];
  let points = 0;
  let pureRuns = 0;
  let best: { shape: PackingShape; score: number } | null = null;
  let nodes = 0;

  const needs = new Map(candidates.map((c) => [c, countKeys(c.cards)]));
  const take = (candidate: CandidateMeld): boolean => {
    const need = needs.get(candidate)!;
    for (const [key, n] of need) {
      if ((counts.get(key) ?? 0) < n) return false;
    }
    for (const [key, n] of need) counts.set(key, counts.get(key)! - n);
    return true;
  };
  const release = (candidate: CandidateMeld) => {
    for (const [key, n] of needs.get(candidate)!) counts.set(key, counts.get(key)! + n);
  };

  const visit = (from: number) => {
    if (++nodes > MAX_NODES) return;
    let i = from;
    while (i < order.length && counts.get(order[i]!)! === 0) i++;
    if (i === order.length) {
      const shape = { melds: [...chosen], restKeys: [...restKeys], points, hasPureRun: pureRuns > 0 };
      const value = score(shape);
      if (value !== null && (!best || value > best.score)) best = { shape, score: value };
      return;
    }
    const key = order[i]!;
    for (const candidate of byKey.get(key) ?? []) {
      if (!take(candidate)) continue;
      chosen.push(candidate);
      points += candidate.points;
      if (candidate.kind === "run" && candidate.pure) pureRuns++;
      visit(i);
      if (candidate.kind === "run" && candidate.pure) pureRuns--;
      points -= candidate.points;
      chosen.pop();
      release(candidate);
    }
    counts.set(key, counts.get(key)! - 1);
    restKeys.push(key);
    visit(i);
    restKeys.pop();
    counts.set(key, counts.get(key)! + 1);
  };
  visit(0);

  const found = best as { shape: PackingShape; score: number } | null;
  return found ? materialize(hand, found.shape) : null;
}

/** Hands each key of the shape a concrete card of the hand, twins and jokers in hand order. */
function materialize(hand: Card[], shape: PackingShape): Packing {
  const pool = new Map<CardKey, Card[]>();
  for (const card of hand) {
    if (!pool.has(cardKey(card))) pool.set(cardKey(card), []);
    pool.get(cardKey(card))!.push(card);
  }
  const melds = shape.melds.map((m) => m.keys.map((key) => pool.get(key)!.shift()!));
  const rest = [...pool.values()].flat();
  // Keep the hand's order for what stays in it.
  rest.sort((a, b) => hand.indexOf(a) - hand.indexOf(b));
  return { melds, rest, points: shape.points, hasPureRun: shape.hasPureRun };
}

/** Points the cards would cost if they stayed in hand at the end of the round. */
export function handPoints(keys: CardKey[]): number {
  return keys.reduce((sum, key) => sum + keyHandPoints(key), 0);
}

function keyHandPoints(key: CardKey): number {
  if (key === JOKER_KEY) return 20;
  const rank = Number(key.split("-")[1]);
  return handCardPoints({ id: key, suit: null, rank: rank as Card["rank"], joker: false });
}

/**
 * Lay down as much as possible, measured by the points it takes out of the hand, keeping one
 * card to discard. More cards break ties.
 */
function laidValue(shape: PackingShape, handSize: number): number {
  const laid = handSize - shape.restKeys.length;
  const handLeft = handPoints(shape.restKeys);
  return -handLeft * 100 + laid;
}

/**
 * The first laydown: at least `firstMeldMinPoints`, a pure run when `requirePureRun`, one card
 * kept. Null when the hand has none. Checked against the engine's own rule before it is returned.
 */
export function findOpening(
  hand: Card[],
  rules: Pick<GameOptions, "firstMeldMinPoints" | "requirePureRun">,
): Packing | null {
  const packing = bestPacking(hand, (shape) => {
    if (shape.melds.length === 0 || shape.restKeys.length === 0) return null;
    if (shape.points < rules.firstMeldMinPoints) return null;
    if (rules.requirePureRun && !shape.hasPureRun) return null;
    return laidValue(shape, hand.length);
  });
  if (!packing) return null;
  const check = checkFirstLaydown(packing.melds, rules.firstMeldMinPoints, rules.requirePureRun);
  return check.ok ? packing : null;
}

/** Any laydown once the player has opened: at least one meld, one card kept. */
export function findLaydown(hand: Card[]): Packing | null {
  return bestPacking(hand, (shape) =>
    shape.melds.length === 0 || shape.restKeys.length === 0 ? null : laidValue(shape, hand.length),
  );
}

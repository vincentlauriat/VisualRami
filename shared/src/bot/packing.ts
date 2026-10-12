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

/** What a packing looks like before cards are assigned. */
export interface PackingShape {
  melds: CandidateMeld[];
  restKeys: CardKey[];
  points: number;
  hasPureRun: boolean;
}

/** The figures a goal accepts or rejects a complete packing on. */
export interface PackingStats {
  points: number;
  hasPureRun: boolean;
  melds: number;
  rest: number;
}

/**
 * What a search looks for. Every goal minimises the points left in hand, then the number of
 * cards left; `accept` filters complete packings, and `minPoints` and `minRest` let the search
 * drop branches that can no longer reach a threshold or beat the best packing kept so far.
 */
export interface PackingGoal {
  accept?: (stats: PackingStats) => boolean;
  minPoints?: number;
  /** Cards that must stay in hand: the search counts at least their cost. */
  minRest?: number;
}

/**
 * A time limit shared by every search of one decision. Once past the deadline, or past the node
 * ceiling, a search stops and returns the best packing found so far, complete and accepted, or
 * none; `exceeded` records that it happened.
 */
export interface SearchBudget {
  deadline: number;
  exceeded: boolean;
}

export const unlimitedBudget = (): SearchBudget => ({ deadline: Infinity, exceeded: false });

/** Ceiling on search nodes, a deterministic backstop to the time budget. */
const MAX_NODES = 100_000;

/** Points a card left in hand would cost at the end of the round. */
function keyHandPoints(key: CardKey): number {
  if (key === JOKER_KEY) return 20;
  const rank = Number(key.split("-")[1]);
  return handCardPoints({ id: key, suit: null, rank: rank as Card["rank"], joker: false });
}

/** The most a card can bring to a meld's points: an ace or a joker 11, faces and tens 10. */
function keyMaxMeldPoints(key: CardKey): number {
  if (key === JOKER_KEY) return 11;
  const rank = Number(key.split("-")[1]);
  return rank === 1 ? 11 : Math.min(rank, 10);
}

/** What keeping a card costs a packing: its points in hand, then one per card (more laid wins ties). */
function keyCost(key: CardKey): number {
  return keyHandPoints(key) * 100 + 1;
}

export function handPoints(keys: CardKey[]): number {
  return keys.reduce((sum, key) => sum + keyHandPoints(key), 0);
}

export interface SearchOptions {
  candidates?: CandidateMeld[];
  budget?: SearchBudget;
  /** Tests only: called on every complete packing, and turns pruning off. */
  onLeaf?: (shape: PackingShape) => void;
}

/**
 * The best set of disjoint melds for each goal, in one depth-first search. It runs over card keys
 * and counts, so the twin copies of a card can sit in two different melds, and it visits each
 * packing once: the first key left either goes into one of the melds containing it, taken in
 * list order (never an earlier one than the last taken, so a pair of melds is not tried twice),
 * or stays in hand with all its remaining copies. Branches are pruned once they leave more in
 * hand than the best packing found for every goal, or can no longer reach a goal's threshold.
 * Concrete cards are assigned at the end.
 */
export function bestPackings(hand: Card[], goals: PackingGoal[], options: SearchOptions = {}): (Packing | null)[] {
  const budget = options.budget;
  // A decision out of time searches no further: no laydown is always a legal answer.
  if (budget && (budget.exceeded || performance.now() >= budget.deadline)) {
    budget.exceeded = true;
    return goals.map(() => null);
  }
  const candidates = options.candidates ?? enumerateMelds(hand);
  const onLeaf = options.onLeaf;
  const counts = countKeys(hand);
  // Jokers last: a joker is never the first card of a meld the search tries to build.
  const order = [...counts.keys()].sort((a, b) => (a === JOKER_KEY ? 1 : b === JOKER_KEY ? -1 : a < b ? -1 : 1));
  // Richer melds first, so a good bound comes early.
  const sorted = [...candidates].sort((a, b) => b.points - a.points);
  const byKey = new Map<CardKey, CandidateMeld[]>();
  for (const candidate of sorted) {
    for (const key of new Set(candidate.keys)) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(candidate);
    }
  }
  const needs = new Map(candidates.map((c) => [c, countKeys(c.cards)]));

  const chosen: CandidateMeld[] = [];
  const restKeys: CardKey[] = [];
  let points = 0;
  let pureRuns = 0;
  let restCost = 0;
  let nodes = 0;
  let stopped = false;
  const best: ({ cost: number; shape: PackingShape } | null)[] = goals.map(() => null);

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

  /** Whether some goal can still be improved from this node. */
  const worthIt = (from: number): boolean => {
    if (onLeaf) return true;
    let reachable = points;
    let cheapest = Infinity;
    for (let i = from; i < order.length; i++) {
      const n = counts.get(order[i]!)!;
      reachable += n * keyMaxMeldPoints(order[i]!);
      if (n > 0) cheapest = Math.min(cheapest, keyCost(order[i]!));
    }
    return goals.some((goal, g) => {
      const b = best[g];
      // A card still to be kept costs at least as much as the cheapest one left.
      const floor = restCost + (restKeys.length < (goal.minRest ?? 0) ? cheapest : 0);
      if (b && floor >= b.cost) return false;
      return goal.minPoints === undefined || reachable >= goal.minPoints;
    });
  };

  const leaf = () => {
    const stats: PackingStats = { points, hasPureRun: pureRuns > 0, melds: chosen.length, rest: restKeys.length };
    const cost = restCost;
    let shape: PackingShape | null = null;
    const snapshot = () => (shape ??= { melds: [...chosen], restKeys: [...restKeys], points, hasPureRun: pureRuns > 0 });
    if (onLeaf) onLeaf(snapshot());
    goals.forEach((goal, g) => {
      const b = best[g];
      if (b && cost >= b.cost) return;
      if (goal.accept && !goal.accept(stats)) return;
      best[g] = { cost, shape: snapshot() };
    });
  };

  const visit = (from: number, firstCandidate: number) => {
    if (stopped) return;
    if (++nodes > MAX_NODES || (budget && (nodes & 255) === 0 && performance.now() > budget.deadline)) {
      stopped = true;
      if (budget) budget.exceeded = true;
      return;
    }
    let i = from;
    while (i < order.length && counts.get(order[i]!)! === 0) i++;
    if (i === order.length) return leaf();
    if (!worthIt(i)) return;
    const key = order[i]!;
    const list = byKey.get(key) ?? [];
    for (let k = i === from ? firstCandidate : 0; k < list.length; k++) {
      const candidate = list[k]!;
      if (!take(candidate)) continue;
      chosen.push(candidate);
      points += candidate.points;
      if (candidate.kind === "run" && candidate.pure) pureRuns++;
      visit(i, k);
      if (candidate.kind === "run" && candidate.pure) pureRuns--;
      points -= candidate.points;
      chosen.pop();
      release(candidate);
    }
    // Keep every remaining copy of this key: keeping one and laying its twin is the branch above.
    const n = counts.get(key)!;
    counts.set(key, 0);
    for (let c = 0; c < n; c++) restKeys.push(key);
    const added = n * keyCost(key);
    restCost += added;
    visit(i + 1, 0);
    restCost -= added;
    restKeys.length -= n;
    counts.set(key, n);
  };
  visit(0, 0);

  return best.map((b) => (b ? materialize(hand, b.shape) : null));
}

export function bestPacking(hand: Card[], goal: PackingGoal = {}, options: SearchOptions = {}): Packing | null {
  return bestPackings(hand, [goal], options)[0]!;
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

type FirstLaydownRules = Pick<GameOptions, "firstMeldMinPoints" | "requirePureRun">;

/** The first laydown: the threshold, a pure run when required, at least one meld, one card kept. */
export function openingGoal(rules: FirstLaydownRules): PackingGoal {
  return {
    minPoints: rules.firstMeldMinPoints,
    minRest: 1,
    accept: (s) =>
      s.melds > 0 && s.rest > 0 && s.points >= rules.firstMeldMinPoints && (!rules.requirePureRun || s.hasPureRun),
  };
}

/** Any laydown once the player has opened: at least one meld, one card kept. */
export const LAYDOWN_GOAL: PackingGoal = { minRest: 1, accept: (s) => s.melds > 0 && s.rest > 0 };

/** The hand's best melds, whatever they leave: what a discard should not break. */
export const KEEP_GOAL: PackingGoal = {};

/** An opening found by the search, re-checked against the engine's own rule. */
export function checkedOpening(packing: Packing | null, rules: FirstLaydownRules): Packing | null {
  if (!packing) return null;
  return checkFirstLaydown(packing.melds, rules.firstMeldMinPoints, rules.requirePureRun).ok ? packing : null;
}

/**
 * The first laydown: at least `firstMeldMinPoints`, a pure run when `requirePureRun`, one card
 * kept. Null when the hand has none.
 */
export function findOpening(hand: Card[], rules: FirstLaydownRules, budget?: SearchBudget): Packing | null {
  return checkedOpening(bestPacking(hand, openingGoal(rules), { budget }), rules);
}

/** Any laydown once the player has opened: at least one meld, one card kept. */
export function findLaydown(hand: Card[], budget?: SearchBudget): Packing | null {
  return bestPacking(hand, LAYDOWN_GOAL, { budget });
}

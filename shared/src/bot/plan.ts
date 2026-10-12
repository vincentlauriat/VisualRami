import type { Card, GameAction, GameOptions, Meld, PublicGameState } from "../types.js";
import { chooseDiscard } from "./discard.js";
import {
  bestPackings,
  checkedOpening,
  KEEP_GOAL,
  LAYDOWN_GOAL,
  openingGoal,
  unlimitedBudget,
  type Packing,
  type SearchBudget,
} from "./packing.js";
import { findExtensions, findJokerSwaps, swapResult } from "./table.js";

export type BotLevel = "easy";

/**
 * What a bot carries from one decision to the next. The easy level needs nothing; the medium
 * level will record what it saw go through the discard pile, since the view shows only its top.
 */
export type BotMemory = Readonly<Record<string, unknown>>;

/**
 * A bot decides from the public view of its own seat, nothing else: its hand and what the whole
 * table sees. It structurally cannot read another player's hand or the stock.
 */
export type BotPolicy = (view: PublicGameState, memory?: BotMemory) => GameAction[];

/** The bot's side of a play phase, which it can simulate exactly: its hand and the table. */
export interface PlayContext {
  hand: Card[];
  melds: Meld[];
  hasLaidDown: boolean;
  drewFromDiscardCardId: string | null;
  options: Pick<GameOptions, "firstMeldMinPoints" | "requirePureRun">;
}

/** Most play actions a single turn may plan: each one lays a card or brings a joker back. */
const MAX_PLAY_STEPS = 64;

/** Time one decision may spend searching, all searches together. */
export const DEFAULT_BUDGET_MS = 25;

export interface PlanOptions {
  /** Time budget of the decision; `Infinity` for reproducible replays. */
  budgetMs?: number;
  /** Counts the decisions whose search stopped on the budget or the node ceiling. */
  stats?: { budgetHits: number };
}

const laydownAction = (packing: Packing): GameAction => ({
  type: "layDown",
  melds: packing.melds.map((meld) => meld.map((c) => c.id)),
});

/**
 * The easy level's play phase, replayed on a local copy of the hand and the table so every step
 * can be checked against what the engine will see: open as soon as a valid first laydown exists,
 * then lay, extend and take jokers back while anything fits, and discard. Melds laid this turn
 * get their ids from the engine, so the plan never extends them; the search already puts every
 * card that fits them into the laydown itself.
 */
export function planPlay(
  context: PlayContext,
  budget: SearchBudget = unlimitedBudget(),
): { actions: GameAction[]; hand: Card[] } {
  const actions: GameAction[] = [];
  let hand = context.hand.slice();
  const melds = context.melds.map((m) => ({ ...m, cards: m.cards.slice() }));
  let laid = context.hasLaidDown;
  // The hand's best melds, from the same search as the laydown, for the discard to keep.
  let keep: { hand: Card[]; packing: Packing | null } | null = null;

  if (!laid) {
    const [opening, best] = bestPackings(hand, [openingGoal(context.options), KEEP_GOAL], { budget });
    const checked = checkedOpening(opening ?? null, context.options);
    if (checked) {
      actions.push(laydownAction(checked));
      hand = checked.rest;
      laid = true;
    } else {
      keep = { hand, packing: best ?? null };
    }
  }

  for (let step = 0; laid && step < MAX_PLAY_STEPS; step++) {
    const [more, best] = bestPackings(hand, [LAYDOWN_GOAL, KEEP_GOAL], { budget });
    if (more) {
      actions.push(laydownAction(more));
      hand = more.rest;
      continue;
    }
    keep = { hand, packing: best ?? null };
    const extension = findExtensions(hand, melds).find((e) => hand.length > e.cardIds.length);
    if (extension) {
      const meld = melds.find((m) => m.id === extension.meldId)!;
      const cards = hand.filter((c) => extension.cardIds.includes(c.id));
      meld.cards = extension.position === "start" ? [...cards, ...meld.cards] : [...meld.cards, ...cards];
      hand = hand.filter((c) => !extension.cardIds.includes(c.id));
      actions.push({ type: "extend", ...extension });
      continue;
    }
    const swap = findJokerSwaps(hand, melds)[0];
    if (swap) {
      const meld = melds.find((m) => m.id === swap.meldId)!;
      const card = hand.find((c) => c.id === swap.cardId)!;
      const result = swapResult(meld, card)!;
      meld.cards = result.cards;
      hand = [...hand.filter((c) => c.id !== card.id), result.joker];
      actions.push({ type: "swapJoker", ...swap });
      continue;
    }
    break;
  }

  const discard = chooseDiscard(hand, context.drewFromDiscardCardId, keep?.hand === hand ? keep.packing : undefined, budget);
  actions.push({ type: "discard", cardId: discard.id });
  return { actions, hand };
}

/**
 * Everything a play phase depends on, so a plan made for the draw can serve the play phase. The
 * key must cover every field `planPlay` reads: a field left out would let two different
 * situations share one plan.
 */
function playKey(context: PlayContext): string {
  return JSON.stringify([
    context.hand.map((c) => c.id),
    context.melds.map((m) => [m.id, m.kind, m.cards.map((c) => c.id)]),
    context.hasLaidDown,
    context.drewFromDiscardCardId,
    context.options.firstMeldMinPoints,
    context.options.requirePureRun,
  ]);
}

/**
 * The last play phase planned. Deciding the draw plans the play phase with the discard pile's
 * top in hand; when the bot takes it, the engine puts that card at the end of the hand and the
 * next call asks for exactly that plan. Pure in its inputs, so the cache cannot change a decision.
 */
let lastPlay: { key: string; plan: { actions: GameAction[]; hand: Card[] } } | null = null;

function planPlayOnce(context: PlayContext, budget: SearchBudget): { actions: GameAction[]; hand: Card[] } {
  const key = playKey(context);
  if (lastPlay?.key === key) return lastPlay.plan;
  const plan = planPlay(context, budget);
  // A plan cut short by the budget is not kept: the next call may have the time to do better.
  if (!budget.exceeded) lastPlay = { key, plan };
  return plan;
}

function playContext(view: PublicGameState, hand: Card[], drewFromDiscardCardId: string | null): PlayContext {
  const me = view.players.find((p) => p.id === view.you.id);
  return {
    hand,
    melds: view.melds,
    hasLaidDown: me?.hasLaidDown ?? false,
    drewFromDiscardCardId,
    options: view.options,
  };
}

/**
 * Easy level: take the discard pile's top only when this very turn would put it on the table. A
 * plan cut short by the budget may be wrong about that, and a card taken from the discard pile
 * cannot go back: then the stock is the safe draw.
 */
function chooseDraw(view: PublicGameState, budget: SearchBudget): "stock" | "discard" {
  const top = view.discardTop;
  if (!top) return "stock";
  const { hand } = planPlayOnce(playContext(view, [...view.you.hand, top], top.id), budget);
  if (budget.exceeded) return "stock";
  return hand.some((c) => c.id === top.id) ? "stock" : "discard";
}

/**
 * The actions for the current phase of the bot's turn, to apply one by one. A turn takes two
 * calls: the draw, then, on the view after it, the play phase ending with the discard. Outside
 * the bot's turn the plan is empty. Its first two parameters are a `BotPolicy`; `options` sets
 * the time budget.
 */
export function planTurn(view: PublicGameState, _memory?: BotMemory, options: PlanOptions = {}): GameAction[] {
  if (view.currentPlayerId !== view.you.id) return [];
  if (view.phase !== "draw" && view.phase !== "play") return [];
  const budget: SearchBudget = {
    deadline: performance.now() + (options.budgetMs ?? DEFAULT_BUDGET_MS),
    exceeded: false,
  };
  const actions: GameAction[] =
    view.phase === "draw"
      ? [{ type: "draw", source: chooseDraw(view, budget) }]
      : // A deep copy: the caller may consume or change the actions, the cache keeps its own.
        structuredClone(planPlayOnce(playContext(view, view.you.hand, view.drewFromDiscardCardId), budget).actions);
  if (budget.exceeded && options.stats) options.stats.budgetHits++;
  return actions;
}

// The decision function must stay a policy over the public view, checked by the compiler.
planTurn satisfies BotPolicy;

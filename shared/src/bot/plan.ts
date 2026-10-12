import type { Card, GameAction, GameOptions, Meld, PublicGameState } from "../types.js";
import { chooseDiscard } from "./discard.js";
import { findLaydown, findOpening, type Packing } from "./packing.js";
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
export function planPlay(context: PlayContext): { actions: GameAction[]; hand: Card[] } {
  const actions: GameAction[] = [];
  let hand = context.hand.slice();
  const melds = context.melds.map((m) => ({ ...m, cards: m.cards.slice() }));
  let laid = context.hasLaidDown;

  if (!laid) {
    const opening = findOpening(hand, context.options);
    if (opening) {
      actions.push(laydownAction(opening));
      hand = opening.rest;
      laid = true;
    }
  }

  for (let step = 0; laid && step < MAX_PLAY_STEPS; step++) {
    const more = findLaydown(hand);
    if (more) {
      actions.push(laydownAction(more));
      hand = more.rest;
      continue;
    }
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

  const discard = chooseDiscard(hand, context.drewFromDiscardCardId);
  actions.push({ type: "discard", cardId: discard.id });
  return { actions, hand };
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
 * Easy level: take the discard pile's top only when this very turn would put it on the table.
 * When the stock is empty and the discard pile holds a single card, the engine cannot reshuffle,
 * so that card is the only draw left.
 */
function chooseDraw(view: PublicGameState): "stock" | "discard" {
  const top = view.discardTop;
  if (!top) return "stock";
  if (view.stockCount === 0 && view.discardCount <= 1) return "discard";
  const { hand } = planPlay(playContext(view, [...view.you.hand, top], top.id));
  return hand.some((c) => c.id === top.id) ? "stock" : "discard";
}

/**
 * The actions for the current phase of the bot's turn, to apply one by one. A turn takes two
 * calls: the draw, then, on the view after it, the play phase ending with the discard. Outside
 * the bot's turn the plan is empty.
 */
export const planTurn: BotPolicy = (view) => {
  if (view.currentPlayerId !== view.you.id) return [];
  if (view.phase === "draw") return [{ type: "draw", source: chooseDraw(view) }];
  if (view.phase === "play") {
    return planPlay(playContext(view, view.you.hand, view.drewFromDiscardCardId)).actions;
  }
  return [];
};

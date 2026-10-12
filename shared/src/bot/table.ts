import { analyzeMeld, meldFit } from "../rules.js";
import type { Card, Meld } from "../types.js";

export interface Extension {
  meldId: string;
  cardIds: string[];
  position: "start" | "end";
}

export interface JokerSwap {
  meldId: string;
  cardId: string;
}

/** Every single card of the hand that a meld on the table accepts, at whichever end takes it. */
export function findExtensions(hand: Card[], melds: Meld[]): Extension[] {
  const found: Extension[] = [];
  for (const meld of melds) {
    for (const card of hand) {
      const fit = meldFit(meld, [card]);
      if (fit?.type === "extend") found.push({ meldId: meld.id, cardIds: fit.cardIds, position: fit.position });
    }
  }
  return found;
}

/**
 * What the reducer's `swapJoker` does with this card: it replaces the first joker it can stand
 * for. Returns the meld's new cards and the joker that goes back to the hand, or null.
 */
export function swapResult(meld: Meld, card: Card): { cards: Card[]; joker: Card } | null {
  if (card.joker) return null;
  for (let i = 0; i < meld.cards.length; i++) {
    const existing = meld.cards[i]!;
    if (!existing.joker) continue;
    const cards = meld.cards.slice();
    cards[i] = card;
    const analysis = analyzeMeld(cards);
    if (analysis && analysis.kind === meld.kind) return { cards, joker: existing };
  }
  return null;
}

/** Every real card of the hand that can take a joker back from a meld on the table. */
export function findJokerSwaps(hand: Card[], melds: Meld[]): JokerSwap[] {
  const found: JokerSwap[] = [];
  for (const meld of melds) {
    for (const card of hand) {
      if (swapResult(meld, card)) found.push({ meldId: meld.id, cardId: card.id });
    }
  }
  return found;
}

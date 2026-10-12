import { handCardPoints } from "../cards.js";
import type { Card } from "../types.js";
import { handPoints, bestPacking } from "./packing.js";

/** Value of a card in a run, ace counted both ways. */
function runValues(card: Card): number[] {
  return card.rank === 1 ? [1, 14] : [card.rank!];
}

/** A card with a neighbour in hand: a pair for a set, or a same-suit card at most two ranks away. */
function isConnected(card: Card, hand: Card[]): boolean {
  if (card.joker) return true;
  return hand.some((other) => {
    if (other === card || other.joker) return false;
    if (other.rank === card.rank) return other.suit !== card.suit;
    if (other.suit !== card.suit) return false;
    return runValues(card).some((a) => runValues(other).some((b) => Math.abs(a - b) <= 2));
  });
}

/**
 * The easy level's discard: the isolated card worth the most points. Cards in the hand's best
 * melds and jokers are kept as long as anything else can go; so are cards with a neighbour.
 * The card just taken from the discard pile never goes back, unless it is the last one.
 */
export function chooseDiscard(hand: Card[], drewFromDiscardCardId: string | null): Card {
  if (hand.length === 1) return hand[0]!;
  const options = hand.filter((c) => c.id !== drewFromDiscardCardId);
  const packing = bestPacking(hand, (shape) => -handPoints(shape.restKeys));
  const inMeld = new Set((packing?.melds ?? []).flat().map((c) => c.id));
  const rank = (card: Card): number[] => [
    card.joker ? 1 : 0,
    inMeld.has(card.id) ? 1 : 0,
    isConnected(card, hand) ? 1 : 0,
    -handCardPoints(card),
  ];
  return options.reduce((best, card) => {
    const a = rank(card);
    const b = rank(best);
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i]! < b[i]! ? card : best;
    }
    return card.id < best.id ? card : best;
  });
}

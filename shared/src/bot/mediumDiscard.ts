import { handCardPoints } from "../cards.js";
import { meldFit } from "../rules.js";
import type { Card, Meld } from "../types.js";
import { cardKey } from "./melds.js";
import type { Packing } from "./packing.js";

/** What a medium discard weighs besides the hand: the table, and how close a rival is to going out. */
export interface DiscardContext {
  melds: Meld[];
  /** Cards in the hand of the opponent closest to going out; Infinity when unknown. */
  opponentMinCards: number;
  /** Whether this player has opened: before that, the table's melds are out of reach. */
  hasLaidDown: boolean;
}

/** An opponent with this many cards or fewer may go out soon: high cards stop being worth keeping. */
const SHED_AT = 3;

const RANKS_IN_SUIT = 13;

/** Ranks a card can stand for in a run: an ace is both low and high. */
function runValues(card: Card): number[] {
  return card.rank === 1 ? [1, 14] : [card.rank!];
}

/** How many copies of a card the table has not shown this player: his hand and the melds are known. */
function unseen(counts: Map<string, number>, suit: string, rank: number): number {
  const key = `${suit}-${rank === 14 ? 1 : rank}`;
  return Math.max(0, 2 - (counts.get(key) ?? 0));
}

/**
 * How much a card is worth keeping for the melds it could still join: pairs of one rank, and
 * same-suit neighbours, each counted with the copies still out there to complete them.
 */
function potential(card: Card, hand: Card[], counts: Map<string, number>): number {
  if (card.joker) return 1000;
  let total = 0;
  for (const other of hand) {
    if (other === card || other.joker) continue;
    if (other.rank === card.rank) {
      if (other.suit === card.suit) continue;
      const outs = (["hearts", "diamonds", "clubs", "spades"] as const)
        .filter((suit) => suit !== card.suit && suit !== other.suit)
        .reduce((sum, suit) => sum + unseen(counts, suit, card.rank!), 0);
      total += 20 + Math.min(outs, 4) * 10;
      continue;
    }
    if (other.suit !== card.suit) continue;
    let best = 0;
    for (const a of runValues(card)) {
      for (const b of runValues(other)) {
        const gap = Math.abs(a - b);
        if (gap === 1) {
          const lo = Math.min(a, b);
          const outs = [lo - 1, lo + 2]
            .filter((r) => r >= 1 && r <= RANKS_IN_SUIT + 1)
            .reduce((sum, r) => sum + unseen(counts, card.suit!, r), 0);
          best = Math.max(best, 20 + outs * 10);
        } else if (gap === 2) {
          best = Math.max(best, 10 + unseen(counts, card.suit!, Math.min(a, b) + 1) * 10);
        }
      }
    }
    total += best;
  }
  return total;
}

/**
 * The medium level's discard. Jokers and the hand's best melds stay; among the rest the card
 * least likely to become part of a meld goes, high cards first, and sooner when a rival is close
 * to going out. A card that would take a joker back or join a meld on the table stays as long as
 * anything else can go, since the next player may pick it up from the discard pile.
 * The card just taken from the discard pile never goes back, unless it is the last one.
 */
export function chooseDiscardMedium(
  hand: Card[],
  drewFromDiscardCardId: string | null,
  keep: Packing | null | undefined,
  context: DiscardContext,
): Card {
  if (hand.length === 1) return hand[0]!;
  const options = hand.filter((c) => c.id !== drewFromDiscardCardId);
  const inMeld = new Set((keep?.melds ?? []).flat().map((c) => c.id));
  const counts = new Map<string, number>();
  for (const card of [...hand, ...context.melds.flatMap((m) => m.cards)]) {
    if (!card.joker) counts.set(cardKey(card), (counts.get(cardKey(card)) ?? 0) + 1);
  }
  const shed = context.opponentMinCards <= SHED_AT;
  const weight = shed ? 8 : 4;
  const worth = (card: Card): number => {
    if (card.joker) return 10_000;
    let value = potential(card, hand, counts) - handCardPoints(card) * weight;
    if (inMeld.has(card.id)) value += 500;
    if (!context.hasLaidDown && context.melds.some((m) => meldFit(m, [card]))) value += 100;
    return value;
  };
  return options.reduce((best, card) => {
    const a = worth(card);
    const b = worth(best);
    if (a !== b) return a < b ? card : best;
    return card.id < best.id ? card : best;
  });
}

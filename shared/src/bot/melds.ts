import { SUITS } from "../cards.js";
import { analyzeMeld } from "../rules.js";
import type { Card, MeldKind, Rank } from "../types.js";

/**
 * A card's identity for the search: the two decks hold two copies of every card, and the four
 * jokers are interchangeable, so the search works on these keys and counts, never on ids.
 */
export type CardKey = string;

export const JOKER_KEY: CardKey = "joker";

export function cardKey(card: Card): CardKey {
  return card.joker ? JOKER_KEY : `${card.suit}-${card.rank}`;
}

/** A meld the hand can form. `keys` and `cards` are in play order, the order sent to the engine. */
export interface CandidateMeld {
  kind: MeldKind;
  keys: CardKey[];
  /** One concrete card per key, taken from the hand (first copies). */
  cards: Card[];
  /** Points as the engine counts them for the first laydown. */
  points: number;
  pure: boolean;
}

/** How many of each key the hand holds. */
export function countKeys(cards: Card[]): Map<CardKey, number> {
  const counts = new Map<CardKey, number>();
  for (const card of cards) counts.set(cardKey(card), (counts.get(cardKey(card)) ?? 0) + 1);
  return counts;
}

/** All combinations of `k` items of `items`, in order. */
function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i <= items.length - k; i++) {
    for (const rest of combinations(items.slice(i + 1), k - 1)) out.push([items[i]!, ...rest]);
  }
  return out;
}

/**
 * Every meld the hand can form: sets of distinct suits, same-suit runs with the ace low or high,
 * jokers filling gaps or standing in for a card the hand holds (that card may be wanted
 * elsewhere). Melds made of the same cards are listed once, under their best-scoring reading.
 * The engine's `analyzeMeld` is the final judge of every candidate.
 */
export function enumerateMelds(hand: Card[]): CandidateMeld[] {
  const byKey = new Map<CardKey, Card>();
  for (const card of hand) if (!byKey.has(cardKey(card))) byKey.set(cardKey(card), card);
  const jokerCards = hand.filter((c) => c.joker);
  const jokers = jokerCards.length;
  const best = new Map<string, CandidateMeld>();

  const consider = (kind: MeldKind, keys: CardKey[]) => {
    let j = 0;
    const cards = keys.map((key) => (key === JOKER_KEY ? jokerCards[j++]! : byKey.get(key)!));
    const analysis = analyzeMeld(cards);
    if (!analysis || analysis.kind !== kind) return;
    const id = `${kind}:${[...keys].sort().join(",")}`;
    const previous = best.get(id);
    if (previous && previous.points >= analysis.points) return;
    best.set(id, { kind, keys, cards, points: analysis.points, pure: analysis.pure });
  };

  // Sets: k real cards of distinct suits plus j jokers, j <= k, 3 or 4 cards in all.
  for (let rank = 1; rank <= 13; rank++) {
    const suits = SUITS.filter((s) => byKey.has(`${s}-${rank}`));
    for (let k = 1; k <= suits.length; k++) {
      for (const chosen of combinations(suits, k)) {
        for (let j = 0; j <= Math.min(jokers, k); j++) {
          if (k + j < 3 || k + j > 4) continue;
          consider("set", [...chosen.map((s) => `${s}-${rank}`), ...Array<CardKey>(j).fill(JOKER_KEY)]);
        }
      }
    }
  }

  // Runs: every window of consecutive values in one suit, ace low (1..13) or high (2..14).
  for (const suit of SUITS) {
    for (const [low, high] of [[1, 13], [2, 14]] as const) {
      const keyOf = (v: number): CardKey => `${suit}-${(v === 14 ? 1 : v) as Rank}`;
      for (let start = low; start <= high - 2; start++) {
        for (let end = start + 2; end <= high; end++) {
          const values: number[] = [];
          for (let v = start; v <= end; v++) values.push(v);
          const missing = values.filter((v) => !byKey.has(keyOf(v)));
          // Windows only grow: once the gaps exceed the jokers, longer ones cannot do better.
          if (missing.length > jokers) break;
          const present = values.filter((v) => byKey.has(keyOf(v)));
          const spare = jokers - missing.length;
          for (let extra = 0; extra <= spare; extra++) {
            const total = missing.length + extra;
            if (total > values.length - total) break;
            for (const replaced of combinations(present, extra)) {
              const asJoker = new Set([...missing, ...replaced]);
              consider("run", values.map((v) => (asJoker.has(v) ? JOKER_KEY : keyOf(v))));
            }
          }
        }
      }
    }
  }
  return [...best.values()];
}

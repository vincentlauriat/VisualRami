import type { Card, Rank, Suit } from "./types.js";

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

export const RANK_LABEL: Record<Rank, string> = {
  1: "A",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
};

/** Two 52-card decks plus 4 jokers = 108 cards. */
export function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${suit}-${rank}-${copy}`, suit, rank, joker: false });
      }
    }
  }
  for (let j = 0; j < 4; j++) {
    cards.push({ id: `joker-${j}`, suit: null, rank: null, joker: true });
  }
  return cards;
}

export type Rng = () => number;

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/** Deterministic PRNG (mulberry32) for tests and replays. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cardLabel(card: Card): string {
  if (card.joker) return "Joker";
  return `${RANK_LABEL[card.rank!]}${SUIT_SYMBOL[card.suit!]}`;
}

/** Points of a card counted in hand at the end of a round. */
export function handCardPoints(card: Card): number {
  if (card.joker) return 20;
  const rank = card.rank!;
  if (rank === 1) return 11;
  if (rank >= 10) return 10;
  return rank;
}

export function sortBySuit(cards: Card[]): Card[] {
  return cards.slice().sort((a, b) => {
    if (a.joker !== b.joker) return a.joker ? 1 : -1;
    if (a.joker) return 0;
    const s = SUITS.indexOf(a.suit!) - SUITS.indexOf(b.suit!);
    if (s !== 0) return s;
    return a.rank! - b.rank!;
  });
}

export function sortByRank(cards: Card[]): Card[] {
  return cards.slice().sort((a, b) => {
    if (a.joker !== b.joker) return a.joker ? 1 : -1;
    if (a.joker) return 0;
    const r = a.rank! - b.rank!;
    if (r !== 0) return r;
    return SUITS.indexOf(a.suit!) - SUITS.indexOf(b.suit!);
  });
}

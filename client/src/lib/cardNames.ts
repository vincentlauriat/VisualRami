import type { Card, Rank, Suit } from "@visualrami/shared";

// Spoken names for assistive technology. The interface is French (`lang="fr"`), so a card has to
// be announced as "Roi de pique", not "K spades". Kept in one place so an i18n layer can replace
// this table wholesale rather than hunting strings through components.

const RANK_NAME: Record<Rank, string> = {
  1: "As",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "Valet",
  12: "Dame",
  13: "Roi",
};

const SUIT_NAME: Record<Suit, string> = {
  hearts: "cœur",
  diamonds: "carreau",
  clubs: "trèfle",
  spades: "pique",
};

export function cardName(card: Card): string {
  if (card.joker) return "Joker";
  return `${RANK_NAME[card.rank!]} de ${SUIT_NAME[card.suit!]}`;
}

export function cardList(cards: Card[]): string {
  return cards.map(cardName).join(", ");
}

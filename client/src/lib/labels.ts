import type { Card } from "@visualrami/shared";
import { cardList, cardName } from "./cardNames";

// Spoken labels built from game data. Grouped here, next to the card names, so the coming i18n
// layer has one place to replace instead of strings scattered through components.

/** "de Bruno", but "d'Alice": French elides before a vowel or a mute h. */
export function deName(name: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûüœæ]/i.test(name) ? `d'${name}` : `de ${name}`;
}

export const labels = {
  turnOf: (name: string) => `Tour ${deName(name)}`,
  stock: (count: number, canDraw: boolean) => (canDraw ? `Piocher dans le talon, ${count} cartes` : `Talon, ${count} cartes`),
  discard: (card: Card, canDraw: boolean) =>
    canDraw ? `Prendre dans la défausse : ${cardName(card)}` : `Défausse : ${cardName(card)}`,
  emptyDiscard: "Défausse vide",
  meld: (owner: string) => `Combinaison ${deName(owner)}`,
  meldTarget: (owner: string, cards: Card[]) => `Ajouter la sélection à la combinaison ${deName(owner)} : ${cardList(cards)}`,
  unstage: (cards: Card[]) => `Retirer ${cardList(cards)}`,
  selectedCard: (card: Card, order: number) => `${cardName(card)}, choix ${order}`,
  sideToggle: (messages: number) => (messages > 0 ? `Journal et chat, ${messages} messages` : "Journal et chat"),
  dismissMessage: "Fermer le message",
};

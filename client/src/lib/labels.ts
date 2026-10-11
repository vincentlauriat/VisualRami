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

  // Table guidance: what to do now, and why an action is not available yet.
  hintDraw: "Touchez le talon ou la défausse.",
  hintPlay: "Préparez une combinaison, ou défaussez une carte.",
  hintTargets: "Touchez une combinaison dorée pour y ajouter la sélection.",
  hintKeepDiscard: "Carte prise dans la défausse : gardez-la ce tour-ci.",
  laydownProgress: (points: number, min: number) =>
    points >= min ? `${points} pts : seuil de ${min} atteint` : `${points} / ${min} pts · encore ${min - points}`,
  pureRunDone: "Tierce franche ✓",
  pureRunMissing: "Tierce franche à trouver",
  laydownPoints: (points: number) => `${points} pts à poser`,

  // Why a selection is not a combination. Each names the fix, not just the failure.
  meldTooShort: "Une combinaison compte au moins 3 cartes.",
  meldTooManyJokers: "Pas plus de jokers que de vraies cartes.",
  meldSetTooLong: "Un brelan ou un carré compte 4 cartes au plus.",
  meldSetSameSuit: "Un brelan demande des couleurs toutes différentes.",
  meldMixedSuits: "Une suite se fait dans une seule couleur.",
  meldRunDuplicate: "Une suite ne peut pas contenir deux fois la même carte.",
  meldRunMissing: (cards: Card[]) => `Il manque ${cardList(cards)} pour faire la suite.`,
  meldRunGap: "Trop d'écart entre ces cartes pour une suite.",
  meldNoFit: "Ces cartes ne complètent pas cette combinaison.",
  laydownFirst: "Faites d'abord votre première pose avant de compléter les combinaisons.",
};

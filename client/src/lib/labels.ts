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

  // Each player's melds sit in front of their seat.
  zone: (owner: string) => `Combinaisons ${deName(owner)}`,
  myZone: "Vos combinaisons",
  seatJump: (owner: string) => `Voir les combinaisons ${deName(owner)}`,
  firstLaydownBadge: (points: number) => `1re pose · ${points} pts`,
  firstLaydownSpoken: (owner: string, points: number, mine: boolean) =>
    mine ? `Vous posez pour la première fois : ${points} points.` : `${owner} pose pour la première fois : ${points} points.`,
  selectedCard: (card: Card, order: number) => `${cardName(card)}, choix ${order}`,
  sideToggle: (messages: number) =>
    messages > 0 ? `Journal, chat et règles, ${messages} messages` : "Journal, chat et règles",
  dismissMessage: "Fermer le message",

  // Arriving and finding a table.
  tableNotFound: "Table introuvable : vérifiez le code",

  // End of round: the count, face up on the felt.
  youWinRound: "Vous remportez la manche",
  winsRound: (name: string) => `${name} remporte la manche`,
  winnerTile: "remporte la manche",
  winnerTileShort: "gagne",
  newRound: "Nouvelle manche",
  ready: "Prêt",
  readyTag: "prêt",
  host: "hôte",
  readyPrompt: "Dites à l'hôte que vous êtes prêt pour la suite.",
  waitingHost: "En attente de l'hôte pour la manche suivante…",
  readySummary: (ready: string[], waiting: string[], absent: string[]) =>
    [
      waiting.length === 0 ? "Tout le monde est prêt" : ready.length > 0 ? `Prêts : ${ready.join(", ")}` : null,
      waiting.length > 0 ? `en attente : ${waiting.join(", ")}` : null,
      absent.length > 0 ? `absent : ${absent.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" · ")
      .replace(/^./, (c) => c.toUpperCase()),
  youName: (name: string) => `${name} (vous)`,
  handEmpty: "a tout posé",
  revealedHand: (name: string) => `Cartes restantes ${deName(name)}`,
  winnerPoints: "0 (gagnant)",
  doubledPenalty: "×2 : pas posé",
  total: (score: number) => `${score} pts au total`,

  // Presence: your own connection, and the other players'.
  connectionLost: "Connexion perdue — reconnexion…",
  hintOffline: "Hors ligne : la table reprend dès le retour de la connexion.",
  peerAbsent: "absent",
  peerSeatKept: "sa place est gardée",
  micOff: (name: string) => `Micro coupé : ${name}`,
  leave: "Quitter la table",
  leaveAsk: "Quitter la table ?",
  leaveConfirm: "Quitter",
  leaveCancel: "Rester",
  leaveHint: "Votre place reste réservée : revenez avec le code de la table",

  // Table guidance: what to do now, and why an action is not available yet.
  hintDraw: "Touchez le talon ou la défausse.",
  hintPlay: "Préparez une combinaison, ou défaussez une carte.",
  hintTargets: "Touchez une combinaison dorée pour y ajouter la sélection.",
  hintKeepDiscard: "Carte prise dans la défausse : gardez-la ce tour-ci.",
  hintAfterLaydown: "Cette carte ira sur la table après votre première pose.",
  hintDiscardStaged: "Défausser maintenant abandonne la préparation.",
  discardAnyway: "Défausser quand même",
  discardAnywayShort: "Défausser ?",
  laydownProgress: (points: number, min: number) =>
    points >= min ? `${points} pts : seuil de ${min} atteint` : `${points} / ${min} pts · encore ${min - points}`,
  pureRunDone: "Tierce franche ✓",
  pureRunMissing: "Tierce franche à trouver",
  laydownPoints: (points: number) => `${points} pts à poser`,
  selection: (count: number, points: number, toGo: number | null, min: number) =>
    `${count} carte${count > 1 ? "s" : ""} · ${points} pts` +
    (toGo === null ? "" : toGo > 0 ? ` · encore ${toGo} pour ${min}` : ` · seuil de ${min} atteint`),

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

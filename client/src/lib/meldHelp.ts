import { analyzeMeld, type Card, type Meld, type Rank } from "@visualrami/shared";
import { labels } from "./labels";

export type MeldFit =
  | { type: "extend"; position: "start" | "end"; cardIds: string[] }
  | { type: "swapJoker"; cardId: string };

/** Selection sorted by rank, jokers last: the order a run extension is most likely to need. */
function byRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => (a.joker ? 99 : a.rank!) - (b.joker ? 99 : b.rank!));
}

/**
 * How the selection can join a meld on the table, if at all. Used both to light only the melds
 * that will accept it and to send the matching action, so the two can never disagree.
 */
export function meldFit(meld: Meld, selection: Card[]): MeldFit | null {
  if (selection.length === 0) return null;
  for (const sel of [selection, byRank(selection)]) {
    const ids = sel.map((c) => c.id);
    const end = analyzeMeld([...meld.cards, ...sel]);
    if (end && end.kind === meld.kind) return { type: "extend", position: "end", cardIds: ids };
    const start = analyzeMeld([...sel, ...meld.cards]);
    if (start && start.kind === meld.kind) return { type: "extend", position: "start", cardIds: ids };
  }
  const card = selection[0]!;
  if (selection.length === 1 && !card.joker) {
    for (let i = 0; i < meld.cards.length; i++) {
      if (!meld.cards[i]!.joker) continue;
      const candidate = meld.cards.slice();
      candidate[i] = card;
      const analysis = analyzeMeld(candidate);
      if (analysis && analysis.kind === meld.kind) return { type: "swapJoker", cardId: card.id };
    }
  }
  return null;
}

/** Why a selection is not a combination, phrased as what would fix it. */
export function invalidMeldReason(cards: Card[]): string {
  const real = cards.filter((c) => !c.joker);
  const jokers = cards.length - real.length;
  if (cards.length < 3) return labels.meldTooShort;
  if (real.length === 0 || jokers > real.length) return labels.meldTooManyJokers;
  const ranks = new Set(real.map((c) => c.rank));
  if (ranks.size === 1) return cards.length > 4 ? labels.meldSetTooLong : labels.meldSetSameSuit;
  const suit = real[0]!.suit;
  if (!real.every((c) => c.suit === suit)) return labels.meldMixedSuits;
  if (ranks.size < real.length) return labels.meldRunDuplicate;
  // Same suit, distinct ranks: name the missing cards for whichever ace reading needs fewer.
  let missing: Rank[] | null = null;
  for (const aceHigh of [false, true]) {
    const values: number[] = real.map((c) => (c.rank === 1 && aceHigh ? 14 : c.rank!)).sort((a, b) => a - b);
    const gaps: Rank[] = [];
    for (let v = values[0]!; v <= values[values.length - 1]!; v++) {
      if (!values.includes(v)) gaps.push((v === 14 ? 1 : v) as Rank);
    }
    if (!missing || gaps.length < missing.length) missing = gaps;
  }
  const needed = (missing ?? []).length - jokers;
  if (needed > 0 && needed <= 2) {
    return labels.meldRunMissing((missing ?? []).slice(0, needed).map((rank) => ({ id: "", suit, rank, joker: false })));
  }
  return labels.meldRunGap;
}

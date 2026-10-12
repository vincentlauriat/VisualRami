import { type Card, type Rank } from "@visualrami/shared";
import { labels } from "./labels";

export { meldFit, type MeldFit } from "@visualrami/shared";

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

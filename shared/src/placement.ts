import { checkFirstLaydown, meldFit } from "./rules.js";
import { enumerateMelds, cardKey } from "./bot/melds.js";
import { bestPackings, type SearchBudget } from "./bot/packing.js";
import { planPlay } from "./bot/plan.js";
import type { Card, GameOptions, Meld } from "./types.js";

type OpeningRules = Pick<GameOptions, "firstMeldMinPoints" | "requirePureRun">;

/** Time the engine gives the check; the node ceiling of each search is the deterministic backstop. */
const CHECK_BUDGET_MS = 150;

/**
 * Whether `card`, held in `hand` with the rest of it, can still reach the table this turn: by
 * taking a joker back, by extending a meld (alone, or with one other card of the hand), or in a
 * laydown that includes it and, for a player who has not opened, reaches the opening rule. A
 * laydown must keep a card to discard, an extension must leave one too.
 *
 * It decides whether a card may be taken from the discard pile (the rule: only to put it on the
 * table), and whether it may stay in hand at the discard. When the search runs out of time it
 * answers no: refusing a draw costs nothing, the player draws from the stock.
 */
export function canPlaceCard(
  hand: Card[],
  card: Card,
  melds: Meld[],
  hasLaidDown: boolean,
  rules: OpeningRules,
): boolean {
  if (hasLaidDown) {
    for (const meld of melds) {
      if (meldFit(meld, [card])?.type === "swapJoker") return true;
      if (hand.length > 1 && meldFit(meld, [card])?.type === "extend") return true;
      if (hand.length > 2) {
        for (const other of hand) {
          if (other.id !== card.id && meldFit(meld, [card, other])?.type === "extend") return true;
        }
      }
    }
  }
  const budget: SearchBudget = { deadline: performance.now() + CHECK_BUDGET_MS, exceeded: false };
  const key = cardKey(card);
  const pureRun = (c: { kind: string; pure: boolean }) => c.kind === "run" && c.pure;
  for (const candidate of enumerateMelds(hand)) {
    if (!candidate.keys.includes(key)) continue;
    // One concrete card per key: the candidate may hold the card's twin, which is the same card.
    const used = new Set<string>();
    const cards: Card[] = [];
    const pool = hand.slice();
    for (const k of candidate.keys) {
      const index = pool.findIndex((c) => cardKey(c) === k);
      cards.push(pool[index]!);
      used.add(pool[index]!.id);
      pool.splice(index, 1);
    }
    if (pool.length === 0) continue;
    if (hasLaidDown) return true;
    if (candidate.points >= rules.firstMeldMinPoints && (!rules.requirePureRun || pureRun(candidate))) {
      if (checkFirstLaydown([cards], rules.firstMeldMinPoints, rules.requirePureRun).ok) return true;
    }
    // The rest of the hand adds the other melds the opening needs.
    const [more] = bestPackings(
      pool,
      [
        {
          minRest: 1,
          minPoints: rules.firstMeldMinPoints - candidate.points,
          accept: (s) =>
            s.rest > 0 &&
            candidate.points + s.points >= rules.firstMeldMinPoints &&
            (!rules.requirePureRun || pureRun(candidate) || s.hasPureRun),
        },
      ],
      { budget },
    );
    if (more && checkFirstLaydown([cards, ...more.melds], rules.firstMeldMinPoints, rules.requirePureRun).ok) {
      return true;
    }
    if (budget.exceeded) return false;
  }
  // Longer chains (extend with one card so another fits, a joker taken back, then a laydown):
  // a play phase the computer player can replay move by move places the card, so it is placeable.
  if (budget.exceeded) return false;
  const plan = planPlay({ hand, melds, hasLaidDown, drewFromDiscardCardId: card.id, options: rules }, budget);
  return !budget.exceeded && !plan.hand.some((c) => c.id === card.id);
}

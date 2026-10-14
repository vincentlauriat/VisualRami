import { describe, expect, it } from "vitest";
import { chooseDiscardMedium } from "../src/bot/index.js";
import type { Card, Meld, Rank, Suit } from "../src/types.js";

const c = (rank: Rank, suit: Suit, id: string): Card => ({ id, rank, suit, joker: false });
const joker = (id: string): Card => ({ id, rank: null, suit: null, joker: true }) as unknown as Card;
const calm = { melds: [] as Meld[], opponentMinCards: 14, hasLaidDown: true };

describe("medium discard", () => {
  it("keeps a card with a neighbour and drops the isolated one", () => {
    const hand = [c(5, "hearts", "a"), c(6, "hearts", "b"), c(12, "spades", "lone")];
    expect(chooseDiscardMedium(hand, null, null, calm).id).toBe("lone");
  });

  it("never discards a joker while anything else can go", () => {
    const hand = [joker("j"), c(2, "clubs", "x"), c(3, "spades", "y")];
    expect(chooseDiscardMedium(hand, null, null, calm).id).not.toBe("j");
  });

  it("never gives back the card just taken from the discard pile", () => {
    const hand = [c(13, "clubs", "k"), c(2, "spades", "s2")];
    expect(chooseDiscardMedium(hand, "k", null, calm).id).toBe("s2");
  });

  it("sheds its high card sooner when a rival is close to going out", () => {
    // J♠ 10♠ are neighbours worth keeping while nothing presses; a lone 2♥ costs almost nothing.
    const hand = [c(11, "spades", "j"), c(10, "spades", "t"), c(2, "hearts", "two")];
    expect(chooseDiscardMedium(hand, null, null, calm).id).toBe("two");
    expect(chooseDiscardMedium(hand, null, null, { ...calm, opponentMinCards: 2 }).id).toBe("j");
  });

  it("holds back a card the table would take before it has opened", () => {
    const meld: Meld = { id: "m", kind: "run", ownerId: "b", cards: [c(5, "hearts", "p5"), c(6, "hearts", "p6"), c(7, "hearts", "p7")] };
    const hand = [c(8, "hearts", "eight"), c(9, "clubs", "nine"), c(1, "spades", "ace")];
    const open = chooseDiscardMedium(hand, null, null, { melds: [meld], opponentMinCards: 14, hasLaidDown: false });
    expect(open.id).not.toBe("eight");
  });
});

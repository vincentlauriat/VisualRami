import { describe, expect, it } from "vitest";
import { labels } from "../src/lib/labels";

describe("exhausted stock", () => {
  it("names the stock with the warning, whether or not it can be drawn", () => {
    expect(labels.stock(12, true)).toBe("Piocher dans le talon, 12 cartes");
    expect(labels.stock(0, true, true)).toBe("Piocher dans le talon, 0 cartes. Piocher ici termine la manche (manche nulle)");
    expect(labels.stock(0, false, true)).toBe("Talon, 0 cartes. Piocher ici termine la manche (manche nulle)");
  });

  it("warns in the turn hint, without forbidding the discard pile", () => {
    expect(labels.stockEndsRound).toBe("Piocher ici termine la manche (manche nulle)");
    expect(labels.hintDrawEndsRound).toMatch(/termine la manche/);
    expect(labels.hintDrawEndsRound).toMatch(/défausse/);
  });
});

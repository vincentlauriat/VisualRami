import { describe, expect, it } from "vitest";
import { resultTitle } from "../src/lib/roundResult";

const players = [
  { id: "a", name: "Alice" },
  { id: "b", name: "Bruno" },
];

describe("resultTitle", () => {
  it("names the winner, or speaks to them", () => {
    expect(resultTitle({ winnerId: "b", players, you: { id: "a" } })).toBe("Bruno remporte la manche");
    expect(resultTitle({ winnerId: "a", players, you: { id: "a" } })).toBe("Vous remportez la manche");
  });

  it("says a round without a winner was drawn on an exhausted stock", () => {
    expect(resultTitle({ winnerId: null, players, you: { id: "a" } })).toBe("Manche nulle : talon épuisé");
  });
});

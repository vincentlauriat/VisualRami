import { describe, expect, it } from "vitest";
import { validateAction } from "../src/validate.js";

describe("validateAction", () => {
  it("rejects malformed payloads that used to crash the reducer", () => {
    expect(validateAction({ type: "layDown" })).toBeNull();
    expect(validateAction({ type: "layDown", melds: "abc" })).toBeNull();
    expect(validateAction({ type: "layDown", melds: [["a", 1]] })).toBeNull();
    expect(validateAction({ type: "extend", meldId: "m1" })).toBeNull();
    expect(validateAction({ type: "extend", meldId: "m1", cardIds: ["c"], position: "middle" })).toBeNull();
    expect(validateAction({ type: "draw", source: "hand" })).toBeNull();
    expect(validateAction({ type: "discard" })).toBeNull();
    expect(validateAction("start")).toBeNull();
    expect(validateAction(null)).toBeNull();
    expect(validateAction({ type: "nope" })).toBeNull();
  });
  it("accepts well-formed actions and strips extra fields", () => {
    expect(validateAction({ type: "start", extra: 1 })).toEqual({ type: "start" });
    expect(validateAction({ type: "draw", source: "stock" })).toEqual({ type: "draw", source: "stock" });
    expect(validateAction({ type: "layDown", melds: [["a", "b", "c"]] })).toEqual({
      type: "layDown",
      melds: [["a", "b", "c"]],
    });
    expect(validateAction({ type: "extend", meldId: "m", cardIds: ["x"], position: "end" })).toEqual({
      type: "extend",
      meldId: "m",
      cardIds: ["x"],
      position: "end",
    });
    expect(validateAction({ type: "swapJoker", meldId: "m", cardId: "x" })).toEqual({
      type: "swapJoker",
      meldId: "m",
      cardId: "x",
    });
  });
});

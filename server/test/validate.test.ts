import { describe, expect, it } from "vitest";
import { sanitizeOptions, validateAction, validateAddBot, validateRemoveBot } from "../src/validate.js";

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
    expect(validateAction({ type: "ready" })).toBeNull();
    expect(validateAction({ type: "ready", ready: "yes" })).toBeNull();
  });
  it("accepts well-formed actions and strips extra fields", () => {
    expect(validateAction({ type: "start", extra: 1 })).toEqual({ type: "start" });
    expect(validateAction({ type: "ready", ready: true, extra: 1 })).toEqual({ type: "ready", ready: true });
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

describe("sanitizeOptions", () => {
  it("caps the first-laydown threshold at 100 and keeps sane values", () => {
    expect(sanitizeOptions({ firstMeldMinPoints: 51 })).toEqual({ firstMeldMinPoints: 51 });
    expect(sanitizeOptions({ firstMeldMinPoints: 100 })).toEqual({ firstMeldMinPoints: 100 });
    expect(sanitizeOptions({ firstMeldMinPoints: 150 })).toEqual({ firstMeldMinPoints: 100 });
    expect(sanitizeOptions({ firstMeldMinPoints: 72.9 })).toEqual({ firstMeldMinPoints: 72 });
  });

  it("drops what it cannot read", () => {
    expect(sanitizeOptions({ firstMeldMinPoints: -5, requirePureRun: "yes" })).toEqual({});
    expect(sanitizeOptions({ firstMeldMinPoints: Number.NaN })).toEqual({});
    expect(sanitizeOptions(null)).toEqual({});
    expect(sanitizeOptions({ requirePureRun: false })).toEqual({ requirePureRun: false });
  });
});

describe("computer player payloads", () => {
  it("reads the level to add, easy by default, and nothing else", () => {
    expect(validateAddBot(undefined)).toEqual({ level: "easy" });
    expect(validateAddBot({})).toEqual({ level: "easy" });
    expect(validateAddBot({ level: "easy" })).toEqual({ level: "easy" });
    expect(validateAddBot({ level: "hard" })).toBeNull();
    expect(validateAddBot({ level: 1 })).toBeNull();
  });

  it("reads the computer player to remove", () => {
    expect(validateRemoveBot({ playerId: "abc123" })).toEqual({ playerId: "abc123" });
    expect(validateRemoveBot({ playerId: "" })).toBeNull();
    expect(validateRemoveBot({ playerId: 3 })).toBeNull();
    expect(validateRemoveBot("abc")).toBeNull();
  });
});

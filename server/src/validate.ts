import type { GameAction } from "@visualrami/shared";

const isString = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length <= 30 && v.every(isString);

/** Turn an untrusted socket payload into a well-formed GameAction, or null. */
export function validateAction(input: unknown): GameAction | null {
  if (!input || typeof input !== "object") return null;
  const a = input as Record<string, unknown>;
  switch (a.type) {
    case "start":
    case "newRound":
      return { type: a.type };
    case "draw":
      return a.source === "stock" || a.source === "discard" ? { type: "draw", source: a.source } : null;
    case "discard":
      return isString(a.cardId) ? { type: "discard", cardId: a.cardId } : null;
    case "layDown":
      return Array.isArray(a.melds) && a.melds.length <= 10 && a.melds.every(isStringArray)
        ? { type: "layDown", melds: a.melds as string[][] }
        : null;
    case "extend":
      return isString(a.meldId) && isStringArray(a.cardIds) && (a.position === "start" || a.position === "end")
        ? { type: "extend", meldId: a.meldId, cardIds: a.cardIds, position: a.position }
        : null;
    case "swapJoker":
      return isString(a.meldId) && isString(a.cardId)
        ? { type: "swapJoker", meldId: a.meldId, cardId: a.cardId }
        : null;
    default:
      return null;
  }
}

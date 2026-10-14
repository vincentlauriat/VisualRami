import type { BotLevel, GameAction, GameOptions } from "@visualrami/shared";

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
    case "ready":
      return typeof a.ready === "boolean" ? { type: "ready", ready: a.ready } : null;
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

/** Highest first-laydown threshold a table may ask for. */
export const MAX_FIRST_MELD_POINTS = 100;

/**
 * The room options a creator may set, from an untrusted payload. A threshold above the cap is
 * brought down to it; anything unreadable is dropped and the default applies. Tables saved with a
 * higher threshold before the cap keep theirs: the reshuffle limit still ends their rounds.
 */
export function sanitizeOptions(input: unknown): Partial<GameOptions> {
  if (!input || typeof input !== "object") return {};
  const o = input as Record<string, unknown>;
  const out: Partial<GameOptions> = {};
  if (typeof o.firstMeldMinPoints === "number" && o.firstMeldMinPoints >= 0) {
    out.firstMeldMinPoints = Math.min(Math.floor(o.firstMeldMinPoints), MAX_FIRST_MELD_POINTS);
  }
  if (typeof o.requirePureRun === "boolean") out.requirePureRun = o.requirePureRun;
  return out;
}

/** `room:addBot`: the level of the computer player to seat, "easy" when omitted. */
export function validateAddBot(input: unknown): { level: BotLevel } | null {
  if (input === undefined || input === null) return { level: "easy" };
  if (typeof input !== "object") return null;
  const level = (input as Record<string, unknown>).level;
  if (level === undefined) return { level: "easy" };
  return level === "easy" || level === "medium" ? { level } : null;
}

/** `room:removeBot`: the computer player to take off the table. */
export function validateRemoveBot(input: unknown): { playerId: string } | null {
  if (!input || typeof input !== "object") return null;
  const playerId = (input as Record<string, unknown>).playerId;
  return isString(playerId) ? { playerId } : null;
}

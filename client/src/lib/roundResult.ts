import type { PublicGameState } from "@visualrami/shared";
import { labels } from "./labels";

/** The heading of the end-of-round panel. No winner means the round was drawn: the stock ran out. */
export function resultTitle(state: Pick<PublicGameState, "winnerId" | "you"> & { players: { id: string; name: string }[] }): string {
  if (state.winnerId === null) return labels.drawnRound;
  if (state.winnerId === state.you.id) return labels.youWinRound;
  return labels.winsRound(state.players.find((p) => p.id === state.winnerId)?.name ?? "?");
}

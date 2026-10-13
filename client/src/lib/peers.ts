/**
 * The players to open a media connection with. A computer player has no socket: the server drops
 * signals to it and the connection would stay "new", rebuilt by the watchdog every 8 s forever.
 */
export function mediaPeers(players: { id: string; isBot: boolean }[]): string[] {
  return players.filter((p) => !p.isBot).map((p) => p.id);
}

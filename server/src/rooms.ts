import { randomBytes } from "node:crypto";
import {
  addPlayer,
  applyAction,
  autoPlayTurn,
  currentPlayer,
  createGame,
  removePlayer,
  setConnected,
  toPublicState,
  type GameAction,
  type GameOptions,
  type GameState,
  type PublicGameState,
} from "@visualrami/shared";

export interface Room {
  id: string;
  state: GameState;
  /** playerId -> secret token used to rejoin after a reload. */
  tokens: Map<string, string>;
  /** playerId -> socket id currently attached. */
  sockets: Map<string, string>;
  lastActivity: number;
}

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type JoinResult =
  | { ok: true; room: Room; playerId: string; token: string }
  | { ok: false; error: string };
export type RejoinResult = { ok: true; room: Room } | { ok: false; error: string };

export class RoomManager {
  private rooms = new Map<string, Room>();

  private makeCode(): string {
    for (;;) {
      const bytes = randomBytes(5);
      let code = "";
      for (const b of bytes) code += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length];
      if (!this.rooms.has(code)) return code;
    }
  }

  private makeId(): string {
    return randomBytes(8).toString("hex");
  }

  private makeToken(): string {
    return randomBytes(16).toString("hex");
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  create(name: string, socketId: string, options: Partial<GameOptions> = {}) {
    const id = this.makeCode();
    const playerId = this.makeId();
    const token = this.makeToken();
    const room: Room = {
      id,
      state: createGame(id, { id: playerId, name }, options),
      tokens: new Map([[playerId, token]]),
      sockets: new Map([[playerId, socketId]]),
      lastActivity: Date.now(),
    };
    this.rooms.set(id, room);
    return { room, playerId, token };
  }

  join(roomId: string, name: string, socketId: string): JoinResult {
    const room = this.get(roomId);
    if (!room) return { ok: false, error: "Salle introuvable" };
    const playerId = this.makeId();
    const result = addPlayer(room.state, { id: playerId, name });
    if (!result.ok) return { ok: false, error: result.error };
    const token = this.makeToken();
    room.state = result.state;
    room.tokens.set(playerId, token);
    room.sockets.set(playerId, socketId);
    room.lastActivity = Date.now();
    return { ok: true, room, playerId, token };
  }

  rejoin(roomId: string, playerId: string, token: string, socketId: string): RejoinResult {
    const room = this.get(roomId);
    if (!room) return { ok: false, error: "Salle introuvable" };
    if (room.tokens.get(playerId) !== token) return { ok: false, error: "Session invalide" };
    if (!room.state.players.some((p) => p.id === playerId)) {
      return { ok: false, error: "Joueur inconnu dans cette salle" };
    }
    room.sockets.set(playerId, socketId);
    room.state = setConnected(room.state, playerId, true);
    room.lastActivity = Date.now();
    return { ok: true, room };
  }

  leave(room: Room, playerId: string, socketId: string): boolean {
    if (room.sockets.get(playerId) !== socketId) return false;
    room.sockets.delete(playerId);
    room.state = removePlayer(room.state, playerId);
    if (room.state.phase === "lobby") room.tokens.delete(playerId);
    room.lastActivity = Date.now();
    if (room.state.players.length === 0 || room.sockets.size === 0 && room.state.phase === "lobby") {
      this.rooms.delete(room.id);
    }
    return true;
  }

  /** If the current player is still disconnected, play their turn for them. Returns true when the state changed. */
  autoPlayIfAbsent(room: Room, playerId: string): boolean {
    const current = currentPlayer(room.state);
    if (!current || current.id !== playerId || current.connected) return false;
    if (room.state.phase !== "draw" && room.state.phase !== "play") return false;
    const result = autoPlayTurn(room.state, playerId);
    if (!result.ok) return false;
    room.state = result.state;
    room.lastActivity = Date.now();
    return true;
  }

  act(room: Room, playerId: string, action: GameAction) {
    const result = applyAction(room.state, playerId, action);
    if (result.ok) {
      room.state = result.state;
      room.lastActivity = Date.now();
    }
    return result;
  }

  publicStateFor(room: Room, playerId: string): PublicGameState {
    return toPublicState(room.state, playerId);
  }

  /** Remove rooms idle for longer than `maxIdleMs`. */
  sweep(maxIdleMs: number): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, room] of this.rooms) {
      if (now - room.lastActivity > maxIdleMs && room.sockets.size === 0) {
        this.rooms.delete(id);
        removed++;
      }
    }
    return removed;
  }

  get size(): number {
    return this.rooms.size;
  }
}

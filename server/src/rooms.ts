import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  addBot,
  addPlayer,
  applyAction,
  autoPlayTurn,
  currentPlayer,
  createGame,
  removeBot,
  removePlayer,
  setConnected,
  toPublicState,
  type BotLevel,
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

export type JoinResult =
  | { ok: true; room: Room; playerId: string; token: string; resumed: boolean }
  | { ok: false; error: string };
export type RejoinResult = { ok: true; room: Room } | { ok: false; error: string };

export interface RoomManagerOptions {
  /** JSON file where rooms are persisted so a game survives a server restart. */
  persistPath?: string;
  /** Idle time after which an empty lobby is dropped. */
  lobbyTtlMs?: number;
  /** Idle time after which a started game is dropped. */
  gameTtlMs?: number;
}

interface PersistedRoom {
  id: string;
  state: GameState;
  tokens: [string, string][];
  lastActivity: number;
}

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const HOUR = 60 * 60 * 1000;

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase("fr");
}

/** Names handed to computer players, in order: card suits, then the joker. Five at most join a human. */
export const BOT_NAMES = ["Ordi Trèfle", "Ordi Carreau", "Ordi Cœur", "Ordi Pique", "Ordi Joker"];

/**
 * A name only a computer player may carry: "Ordi" or "Ordinateur" as its first word, whatever
 * the case, the accents, invisible format characters (a zero-width space) or the separator
 * ("Ordi-Trèfle"). A leading zero reads as an O: "0rdi" looks the same on a seat. Other digit
 * look-alikes are not chased; the "ordi" tag on a real computer's seat stays the honest signal.
 */
export function isReservedName(name: string): boolean {
  const plain = name.normalize("NFD").replace(/[\p{M}\p{Cf}]/gu, "").trim().toLowerCase().replace(/^0/, "o");
  const first = plain.split(/[\s\-_.'’]+/)[0] ?? "";
  return first === "ordi" || first === "ordinateur";
}

const RESERVED_NAME_ERROR = "Ce prénom est réservé à l'ordinateur";

export class RoomManager {
  private rooms = new Map<string, Room>();
  private readonly persistPath: string | undefined;
  private readonly lobbyTtlMs: number;
  private readonly gameTtlMs: number;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: RoomManagerOptions = {}) {
    this.persistPath = options.persistPath;
    this.lobbyTtlMs = options.lobbyTtlMs ?? 6 * HOUR;
    this.gameTtlMs = options.gameTtlMs ?? 7 * 24 * HOUR;
    if (this.persistPath) this.load(this.persistPath);
  }

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
    this.scheduleSave();
    return { room, playerId, token };
  }

  /**
   * Join a lobby as a new player, or — when the game has started — take back the seat of a
   * disconnected player with the same name. The code plus the name are all a player needs to
   * come back from another device.
   */
  join(roomId: string, name: string, socketId: string): JoinResult {
    const room = this.get(roomId);
    if (!room) return { ok: false, error: "Table introuvable" };
    if (room.state.phase !== "lobby") {
      // Only a human seat can be taken back, even one whose name predates the reserved names.
      const wanted = normalizeName(name);
      const seat = room.state.players.find((p) => !p.isBot && normalizeName(p.name) === wanted);
      if (!seat && isReservedName(name)) return { ok: false, error: RESERVED_NAME_ERROR };
      if (!seat) {
        return {
          ok: false,
          error: `Partie en cours : entrez le prénom d'un joueur de la table (${room.state.players
            .filter((p) => !p.isBot)
            .map((p) => p.name)
            .join(", ")})`,
        };
      }
      if (seat.connected && room.sockets.has(seat.id)) {
        return { ok: false, error: `${seat.name} est déjà connecté à cette table` };
      }
      const token = this.makeToken();
      room.tokens.set(seat.id, token);
      room.sockets.set(seat.id, socketId);
      room.state = setConnected(room.state, seat.id, true);
      room.lastActivity = Date.now();
      this.scheduleSave();
      return { ok: true, room, playerId: seat.id, token, resumed: true };
    }
    if (isReservedName(name)) return { ok: false, error: RESERVED_NAME_ERROR };
    const playerId = this.makeId();
    const result = addPlayer(room.state, { id: playerId, name });
    if (!result.ok) return { ok: false, error: result.error };
    const token = this.makeToken();
    room.state = result.state;
    room.tokens.set(playerId, token);
    room.sockets.set(playerId, socketId);
    room.lastActivity = Date.now();
    this.scheduleSave();
    return { ok: true, room, playerId, token, resumed: false };
  }

  rejoin(roomId: string, playerId: string, token: string, socketId: string): RejoinResult {
    const room = this.get(roomId);
    if (!room) return { ok: false, error: "Table introuvable" };
    if (room.tokens.get(playerId) !== token) return { ok: false, error: "Session invalide" };
    if (!room.state.players.some((p) => p.id === playerId)) {
      return { ok: false, error: "Joueur inconnu dans cette salle" };
    }
    room.sockets.set(playerId, socketId);
    room.state = setConnected(room.state, playerId, true);
    room.lastActivity = Date.now();
    this.scheduleSave();
    return { ok: true, room };
  }

  /** The host seats a computer player, in the lobby. It gets the first computer name still free. */
  addBot(room: Room, hostId: string, level: BotLevel): { ok: true; botId: string } | { ok: false; error: string } {
    if (room.state.hostId !== hostId) return { ok: false, error: "Seul l'hôte peut ajouter l'ordinateur" };
    const taken = new Set(room.state.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !taken.has(n));
    if (!name) return { ok: false, error: "La table est pleine" };
    const botId = this.makeId();
    const result = addBot(room.state, { id: botId, name, level });
    if (!result.ok) return { ok: false, error: result.error };
    room.state = result.state;
    room.lastActivity = Date.now();
    this.scheduleSave();
    return { ok: true, botId };
  }

  /** The host takes a computer player off the table, in the lobby. */
  removeBot(room: Room, hostId: string, botId: string): { ok: true } | { ok: false; error: string } {
    if (room.state.hostId !== hostId) return { ok: false, error: "Seul l'hôte peut retirer l'ordinateur" };
    const result = removeBot(room.state, botId);
    if (!result.ok) return { ok: false, error: result.error };
    room.state = result.state;
    room.lastActivity = Date.now();
    this.scheduleSave();
    return { ok: true };
  }

  /**
   * A computer player's last resort, when its move and the plainest one were both refused: the
   * same minimal turn as for an absent player, without the absence line.
   */
  playBotLastResort(room: Room, botId: string): boolean {
    const result = autoPlayTurn(room.state, botId, Math.random, null);
    if (!result.ok) return false;
    room.state = result.state;
    room.lastActivity = Date.now();
    this.scheduleSave();
    return true;
  }

  /** Whether a human is at the table right now: computer players only play while one is. */
  hasHumanPresent(room: Room): boolean {
    return room.state.players.some((p) => !p.isBot && p.connected && room.sockets.has(p.id));
  }

  /** `explicit`: the player chose to leave (Quitter). Only then does a started game log it. */
  leave(room: Room, playerId: string, socketId: string, explicit = false): boolean {
    if (room.sockets.get(playerId) !== socketId) return false;
    room.sockets.delete(playerId);
    room.state = removePlayer(room.state, playerId, explicit);
    if (room.state.phase === "lobby") room.tokens.delete(playerId);
    room.lastActivity = Date.now();
    if (room.state.players.length === 0 || (room.sockets.size === 0 && room.state.phase === "lobby")) {
      this.rooms.delete(room.id);
    }
    this.scheduleSave();
    return true;
  }

  /** If the current player is still disconnected, play their turn for them. Returns true when the state changed. */
  autoPlayIfAbsent(room: Room, playerId: string): boolean {
    const current = currentPlayer(room.state);
    // A computer player is played by the bot scheduler, never by the absence timer.
    if (!current || current.id !== playerId || current.connected || current.isBot) return false;
    if (room.state.phase !== "draw" && room.state.phase !== "play") return false;
    const result = autoPlayTurn(room.state, playerId);
    if (!result.ok) return false;
    room.state = result.state;
    room.lastActivity = Date.now();
    this.scheduleSave();
    return true;
  }

  act(room: Room, playerId: string, action: GameAction) {
    const result = applyAction(room.state, playerId, action);
    if (result.ok) {
      room.state = result.state;
      room.lastActivity = Date.now();
      this.scheduleSave();
    }
    return result;
  }

  publicStateFor(room: Room, playerId: string): PublicGameState {
    return toPublicState(room.state, playerId);
  }

  /** Remove idle rooms: empty lobbies after `lobbyTtlMs`, started games after `gameTtlMs`. */
  sweep(now = Date.now()): number {
    let removed = 0;
    for (const [id, room] of this.rooms) {
      if (room.sockets.size > 0) continue;
      const ttl = room.state.phase === "lobby" ? this.lobbyTtlMs : this.gameTtlMs;
      if (now - room.lastActivity > ttl) {
        this.rooms.delete(id);
        removed++;
      }
    }
    if (removed > 0) this.scheduleSave();
    return removed;
  }

  get size(): number {
    return this.rooms.size;
  }

  /** Rooms whose game is in progress, for diagnostics. */
  get activeGames(): number {
    let n = 0;
    for (const room of this.rooms.values()) if (room.state.phase !== "lobby") n++;
    return n;
  }

  // ---- persistence -------------------------------------------------------------------------

  private scheduleSave() {
    if (!this.persistPath || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveNow();
    }, 500);
    this.saveTimer.unref();
  }

  /** Write every room (started games and lobbies alike) to disk atomically. */
  saveNow(): void {
    if (!this.persistPath) return;
    const rooms: PersistedRoom[] = [];
    for (const room of this.rooms.values()) {
      rooms.push({
        id: room.id,
        state: room.state,
        tokens: Array.from(room.tokens.entries()),
        lastActivity: room.lastActivity,
      });
    }
    try {
      mkdirSync(path.dirname(this.persistPath), { recursive: true });
      const tmp = `${this.persistPath}.tmp`;
      writeFileSync(tmp, JSON.stringify({ version: 1, savedAt: Date.now(), rooms }));
      renameSync(tmp, this.persistPath);
    } catch (err) {
      console.error("room persistence failed", err);
    }
  }

  private load(file: string): void {
    let raw: string;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      return; // first start: nothing to restore
    }
    try {
      const data = JSON.parse(raw) as { version: number; rooms: PersistedRoom[] };
      for (const saved of data.rooms) {
        // Nobody is attached after a restart; players come back by token or by code + name.
        // Snapshots written before readiness or the reshuffle count existed lack those fields.
        let state: GameState = {
          ...saved.state,
          ready: Array.isArray(saved.state.ready) ? saved.state.ready : [],
          reshuffles: Number.isInteger(saved.state.reshuffles) && saved.state.reshuffles >= 0 ? saved.state.reshuffles : 0,
        };
        // Computer players have no socket and stay connected: they would otherwise look absent.
        state = { ...state, players: state.players.map((p) => (p.isBot ? { ...p, connected: true } : p)) };
        for (const p of state.players) if (!p.isBot) state = setConnected(state, p.id, false);
        this.rooms.set(saved.id, {
          id: saved.id,
          state,
          tokens: new Map(saved.tokens),
          sockets: new Map(),
          lastActivity: saved.lastActivity,
        });
      }
      console.log(`restored ${this.rooms.size} room(s) from ${file}`);
    } catch (err) {
      console.error("could not restore rooms, starting empty", err);
    }
  }
}

import { io, type Socket } from "socket.io-client";

export const socket: Socket = io({ autoConnect: true, transports: ["websocket", "polling"] });

export interface Session {
  roomId: string;
  playerId: string;
  token: string;
  name: string;
}

/** A seat we hold at a table, remembered across tabs and browser restarts. */
export interface Seat extends Session {
  savedAt: number;
}

const SESSION_KEY = "visualrami.session"; // this tab's live session (sessionStorage: one player per tab)
const SEATS_KEY = "visualrami.seats"; // every table we sat at (localStorage: survives closing the browser)
const NAME_KEY = "visualrami.name";

function read<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: Storage, key: string, value: unknown): void {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode, quota): the feature degrades gracefully
  }
}

export function loadSession(): Session | null {
  const s = read<Partial<Session>>(sessionStorage, SESSION_KEY);
  return s && s.roomId && s.playerId && s.token ? (s as Session) : null;
}

export function saveSession(session: Session | null): void {
  write(sessionStorage, SESSION_KEY, session);
  if (session) saveSeat(session);
}

export function loadSeats(): Seat[] {
  const seats = read<Record<string, Seat>>(localStorage, SEATS_KEY) ?? {};
  return Object.values(seats)
    .filter((s) => s && s.roomId && s.playerId && s.token)
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function loadSeat(roomId: string): Seat | null {
  return loadSeats().find((s) => s.roomId === roomId.toUpperCase()) ?? null;
}

export function saveSeat(session: Session): void {
  const seats = read<Record<string, Seat>>(localStorage, SEATS_KEY) ?? {};
  seats[session.roomId] = { ...session, savedAt: Date.now() };
  write(localStorage, SEATS_KEY, seats);
}

export function forgetSeat(roomId: string): void {
  const seats = read<Record<string, Seat>>(localStorage, SEATS_KEY) ?? {};
  delete seats[roomId];
  write(localStorage, SEATS_KEY, seats);
}

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}

export function request<T>(event: string, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(8000).emit(event, payload, (err: Error | null, response: T | { error: string }) => {
      if (err) return reject(new Error("Le serveur ne répond pas"));
      if (response && typeof response === "object" && "error" in response) {
        return reject(new Error((response as { error: string }).error));
      }
      resolve(response as T);
    });
  });
}

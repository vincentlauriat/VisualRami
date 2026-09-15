import { io, type Socket } from "socket.io-client";

export const socket: Socket = io({ autoConnect: true, transports: ["websocket", "polling"] });

export interface Session {
  roomId: string;
  playerId: string;
  token: string;
  name: string;
}

const KEY = "visualrami.session";

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (parsed.roomId && parsed.playerId && parsed.token) return parsed as Session;
    return null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  try {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
    else sessionStorage.removeItem(KEY);
  } catch {
    // storage unavailable: session simply will not survive a reload
    // (sessionStorage is per tab, so several players can test from one browser)
  }
}

export function loadName(): string {
  try {
    return localStorage.getItem("visualrami.name") ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem("visualrami.name", name);
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

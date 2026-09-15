import { readFileSync, existsSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server, type Socket } from "socket.io";
import type { GameOptions } from "@visualrami/shared";
import { RoomManager, type Room } from "./rooms.js";
import { validateAction } from "./validate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SocketData {
  roomId?: string;
  playerId?: string;
}

type Ack<T> = (response: T | { error: string }) => void;

/** Delay before an absent player's turn is played automatically. */
export const ABSENT_TURN_DELAY_MS = 45_000;

export interface AppOptions {
  /** Serve the built client from this directory when it exists. */
  clientDist?: string;
  /** Paths to a TLS key/cert pair to serve HTTPS (needed for camera access over LAN). */
  tls?: { key: string; cert: string };
  /** Override of the absent-player delay (tests). */
  absentTurnDelayMs?: number;
  /** Allowed CORS origin(s) for the socket. Unset = same origin only. */
  corsOrigin?: string | string[];
  /** JSON file where rooms are persisted across restarts. Unset = memory only. */
  persistPath?: string;
}

/** Sliding-window rate limiter, one bucket per socket and event. */
class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private readonly max: number, private readonly windowMs: number) {}
  allow(key: string): boolean {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.max) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }
  forget(key: string) {
    this.hits.delete(key);
  }
}

const MAX_SIGNAL_BYTES = 16 * 1024;

function isValidSignal(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  const keys = Object.keys(d);
  if (keys.length !== 1) return false;
  if (keys[0] === "description") {
    const desc = d.description as Record<string, unknown> | null;
    return !!desc && typeof desc === "object" && typeof desc.type === "string" && (desc.sdp === undefined || typeof desc.sdp === "string");
  }
  if (keys[0] === "candidate") {
    const c = d.candidate as Record<string, unknown> | null;
    return !!c && typeof c === "object" && typeof c.candidate === "string";
  }
  return false;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  app.disable("x-powered-by");

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, rooms: rooms.size, games: rooms.activeGames });
  });

  const clientDist = options.clientDist ?? path.resolve(__dirname, "../../client/dist");
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  const server = options.tls
    ? https.createServer(
        { key: readFileSync(options.tls.key), cert: readFileSync(options.tls.cert) },
        app,
      )
    : http.createServer(app);

  const io = new Server<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>(
    server,
    options.corsOrigin ? { cors: { origin: options.corsOrigin } } : {},
  );
  const rooms = new RoomManager({ persistPath: options.persistPath });
  const signalLimiter = new RateLimiter(120, 5000);
  const chatLimiter = new RateLimiter(8, 5000);

  function broadcast(room: Room) {
    for (const [playerId, socketId] of room.sockets) {
      io.to(socketId).emit("room:state", rooms.publicStateFor(room, playerId));
    }
    scheduleAbsentTurn(room);
  }

  const absentTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const absentDelay = options.absentTurnDelayMs ?? ABSENT_TURN_DELAY_MS;

  /** When the player whose turn it is has no socket, play for them after a grace period. */
  function scheduleAbsentTurn(room: Room) {
    const existing = absentTimers.get(room.id);
    if (existing) {
      clearTimeout(existing);
      absentTimers.delete(room.id);
    }
    const state = room.state;
    if (state.phase !== "draw" && state.phase !== "play") return;
    const current = state.players[state.currentIndex];
    if (!current || current.connected) return;
    const timer = setTimeout(() => {
      absentTimers.delete(room.id);
      const live = rooms.get(room.id);
      if (!live) return;
      if (rooms.autoPlayIfAbsent(live, current.id)) broadcast(live);
    }, absentDelay);
    timer.unref();
    absentTimers.set(room.id, timer);
  }

  function sanitizeName(name: unknown): string {
    const value = typeof name === "string" ? name.trim().slice(0, 24) : "";
    return value || "Joueur";
  }

  function sanitizeOptions(input: unknown): Partial<GameOptions> {
    if (!input || typeof input !== "object") return {};
    const o = input as Record<string, unknown>;
    const out: Partial<GameOptions> = {};
    if (typeof o.firstMeldMinPoints === "number" && o.firstMeldMinPoints >= 0 && o.firstMeldMinPoints <= 200) {
      out.firstMeldMinPoints = Math.floor(o.firstMeldMinPoints);
    }
    if (typeof o.requirePureRun === "boolean") out.requirePureRun = o.requirePureRun;
    return out;
  }

  function attach(socket: Socket, room: Room, playerId: string) {
    socket.data.roomId = room.id;
    socket.data.playerId = playerId;
    socket.join(room.id);
  }

  /** Leave whatever room this socket is attached to (no-op when unattached). */
  function detach(socket: Socket) {
    const ctx = currentRoom(socket);
    if (ctx) {
      rooms.leave(ctx.room, ctx.playerId, socket.id);
      socket.leave(ctx.room.id);
      socket.to(ctx.room.id).emit("rtc:peer-left", { playerId: ctx.playerId });
      if (rooms.get(ctx.room.id)) broadcast(ctx.room);
    }
    socket.data.roomId = undefined;
    socket.data.playerId = undefined;
  }

  function currentRoom(socket: Socket): { room: Room; playerId: string } | null {
    const { roomId, playerId } = socket.data;
    if (!roomId || !playerId) return null;
    const room = rooms.get(roomId);
    if (!room) return null;
    if (room.sockets.get(playerId) !== socket.id) return null;
    return { room, playerId };
  }

  io.on("connection", (socket) => {
    socket.on(
      "room:create",
      (payload: { name?: string; options?: unknown }, ack: Ack<{ roomId: string; playerId: string; token: string }>) => {
        if (typeof ack !== "function") return;
        if (currentRoom(socket)) return ack({ error: "Déjà dans une salle" });
        const { room, playerId, token } = rooms.create(
          sanitizeName(payload?.name),
          socket.id,
          sanitizeOptions(payload?.options),
        );
        attach(socket, room, playerId);
        ack({ roomId: room.id, playerId, token });
        broadcast(room);
      },
    );

    socket.on(
      "room:join",
      (
        payload: { roomId?: string; name?: string },
        ack: Ack<{ roomId: string; playerId: string; token: string; resumed: boolean }>,
      ) => {
        if (typeof ack !== "function") return;
        if (currentRoom(socket)) return ack({ error: "Déjà dans une salle" });
        const roomId = typeof payload?.roomId === "string" ? payload.roomId.trim() : "";
        const result = rooms.join(roomId, sanitizeName(payload?.name), socket.id);
        if (!result.ok) return ack({ error: result.error });
        attach(socket, result.room, result.playerId);
        ack({ roomId: result.room.id, playerId: result.playerId, token: result.token, resumed: result.resumed });
        if (result.resumed) socket.to(result.room.id).emit("rtc:peer-reset", { playerId: result.playerId });
        broadcast(result.room);
      },
    );

    socket.on(
      "room:rejoin",
      (payload: { roomId?: string; playerId?: string; token?: string }, ack: Ack<{ roomId: string; playerId: string }>) => {
        if (typeof ack !== "function") return;
        const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
        const playerId = typeof payload?.playerId === "string" ? payload.playerId : "";
        const token = typeof payload?.token === "string" ? payload.token : "";
        detach(socket);
        const result = rooms.rejoin(roomId, playerId, token, socket.id);
        if (!result.ok) return ack({ error: result.error });
        attach(socket, result.room, playerId);
        ack({ roomId: result.room.id, playerId });
        // Ask the other peers to renegotiate their media connection with this player.
        socket.to(result.room.id).emit("rtc:peer-reset", { playerId });
        broadcast(result.room);
      },
    );

    socket.on("room:leave", (...args: unknown[]) => {
      // Clients emit ("room:leave", undefined, ack): the callback is the last function argument.
      const ack = args.find((a): a is Ack<{ ok: true }> => typeof a === "function");
      detach(socket);
      if (ack) ack({ ok: true });
    });

    socket.on("game:action", (payload: unknown, ack?: Ack<{ ok: true }>) => {
      const ctx = currentRoom(socket);
      if (!ctx) {
        if (typeof ack === "function") ack({ error: "Pas dans une salle" });
        return;
      }
      const action = validateAction(payload);
      if (!action) {
        if (typeof ack === "function") ack({ error: "Action invalide" });
        return;
      }
      let result: ReturnType<RoomManager["act"]>;
      try {
        result = rooms.act(ctx.room, ctx.playerId, action);
      } catch (err) {
        console.error("action failed", action.type, err);
        result = { ok: false, error: "Action invalide" };
      }
      if (!result.ok) {
        if (typeof ack === "function") ack({ error: result.error });
        return;
      }
      if (typeof ack === "function") ack({ ok: true });
      broadcast(ctx.room);
    });

    socket.on("rtc:signal", (payload: { to?: string; data?: unknown }) => {
      const ctx = currentRoom(socket);
      if (!ctx || typeof payload?.to !== "string" || payload.to === ctx.playerId) return;
      if (!signalLimiter.allow(socket.id)) return;
      if (!isValidSignal(payload.data)) return;
      if (JSON.stringify(payload.data).length > MAX_SIGNAL_BYTES) return;
      const target = ctx.room.sockets.get(payload.to);
      if (!target) return;
      io.to(target).emit("rtc:signal", { from: ctx.playerId, data: payload.data });
    });

    socket.on("chat:message", (text: unknown) => {
      const ctx = currentRoom(socket);
      if (!ctx || typeof text !== "string") return;
      if (!chatLimiter.allow(socket.id)) return;
      const trimmed = text.trim().slice(0, 300);
      if (!trimmed) return;
      const player = ctx.room.state.players.find((p) => p.id === ctx.playerId);
      io.to(ctx.room.id).emit("chat:message", {
        from: ctx.playerId,
        name: player?.name ?? "?",
        text: trimmed,
        at: Date.now(),
      });
    });

    socket.on("disconnect", () => {
      signalLimiter.forget(socket.id);
      chatLimiter.forget(socket.id);
      detach(socket);
    });
  });

  const sweeper = setInterval(() => rooms.sweep(), 10 * 60 * 1000);
  sweeper.unref();
  // Graceful stop: persist the rooms, close the listener, then exit. Installing a signal
  // handler replaces Node's default exit, so the handler MUST terminate the process itself.
  const shutdown = () => {
    rooms.saveNow();
    io.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  return { app, server, io, rooms };
}

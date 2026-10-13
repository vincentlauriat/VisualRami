import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { GameAction, PublicGameState } from "@visualrami/shared";
import { createApp, type AppOptions } from "../src/app.js";
import { BotScheduler } from "../src/botScheduler.js";
import { RoomManager } from "../src/rooms.js";

const dir = mkdtempSync(path.join(tmpdir(), "visualrami-bots-"));
const PACE = { minMs: 30, maxMs: 40, discardMs: 40, readyMs: 30 };
const stops: (() => void)[] = [];
afterAll(() => {
  for (const stop of stops) stop();
  rmSync(dir, { recursive: true, force: true });
});

async function server(options: AppOptions = {}) {
  const app = createApp({ clientDist: "/nonexistent", botPacing: PACE, ...options });
  await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const { port } = app.server.address() as AddressInfo;
  const stop = () => {
    app.bots.stop();
    app.io.close();
    app.server.close();
  };
  stops.push(stop);
  return { ...app, url: `http://127.0.0.1:${port}`, stop };
}

function client(url: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect(url, { transports: ["websocket"], forceNew: true });
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
  });
}

function emit<T>(socket: Socket, event: string, payload?: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, (response: T) => resolve(response)));
}

function stateWhere(socket: Socket, predicate: (s: PublicGameState) => boolean): Promise<PublicGameState> {
  return new Promise((resolve) => {
    const onState = (s: PublicGameState) => {
      if (predicate(s)) {
        socket.off("room:state", onState);
        resolve(s);
      }
    };
    socket.on("room:state", onState);
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A human who plays the plainest turn: draw from the stock, discard the last card. */
function plainHuman(socket: Socket, playerId: string, current: PublicGameState): () => void {
  let busy = false;
  let latest = current;
  const onState = async (s: PublicGameState) => {
    latest = s;
    if (busy || s.currentPlayerId !== playerId) return;
    busy = true;
    if (s.phase === "draw") await emit(socket, "game:action", { type: "draw", source: "stock" });
    else if (s.phase === "play") {
      const card = [...s.you.hand].reverse().find((c) => c.id !== s.drewFromDiscardCardId) ?? s.you.hand[0]!;
      await emit(socket, "game:action", { type: "discard", cardId: card.id });
    }
    busy = false;
    // A state may have come in while the action was on its way: act on the latest one.
    if (latest !== s) void onState(latest);
  };
  socket.on("room:state", onState);
  void onState(current);
  return () => socket.off("room:state", onState);
}

/** Alice's own plain turn: draw from the stock, then discard the last card. */
async function playTurn(socket: Socket) {
  const drawn = stateWhere(socket, (s) => s.phase === "play");
  await emit(socket, "game:action", { type: "draw", source: "stock" });
  const hand = (await drawn).you.hand;
  await emit(socket, "game:action", { type: "discard", cardId: hand.at(-1)!.id });
}

/** Alice alone at a table with one computer player, the game started: Alice plays first. */
async function soloTable(url: string) {
  const alice = await client(url);
  const created = await emit<{ roomId: string; playerId: string; token: string }>(alice, "room:create", { name: "Alice" });
  const added = await emit<{ ok?: true; playerId: string }>(alice, "room:addBot", { level: "easy" });
  const started = stateWhere(alice, (s) => s.phase === "draw");
  await emit(alice, "game:action", { type: "start" });
  return { alice, created, botId: added.playerId, first: await started };
}

describe("computer players at the table", () => {
  it("adds and removes a computer player: host only, in the lobby, with a reserved name", async () => {
    const { url } = await server();
    const a = await client(url);
    const b = await client(url);
    expect(await emit<{ error?: string }>(a, "room:create", { name: "Ordi Cœur" })).toMatchObject({ error: expect.stringMatching(/réservé/) });
    const created = await emit<{ roomId: string }>(a, "room:create", { name: "Alice" });
    await emit(b, "room:join", { roomId: created.roomId, name: "Bob" });
    expect(await emit<{ error?: string }>(b, "room:addBot", {})).toMatchObject({ error: expect.stringMatching(/hôte/) });
    expect(await emit<{ error?: string }>(a, "room:addBot", { level: "hard" })).toEqual({ error: "Niveau inconnu" });
    const seen = stateWhere(b, (s) => s.players.some((p) => p.isBot));
    const added = await emit<{ ok?: true; playerId: string }>(a, "room:addBot", {});
    expect(added.ok).toBe(true);
    const lobby = await seen;
    expect(lobby.players.find((p) => p.isBot)).toMatchObject({ name: "Ordi Trèfle", level: "easy", connected: true });
    const gone = stateWhere(b, (s) => !s.players.some((p) => p.isBot));
    expect(await emit(a, "room:removeBot", { playerId: added.playerId })).toEqual({ ok: true });
    await gone;
    a.disconnect();
    b.disconnect();
  });

  it("plays whole turns through the reducer, and a round with a human can end", async () => {
    // A round can last a few hundred turns: a near-zero pace keeps it short.
    const { url } = await server({ botPacing: { minMs: 0, maxMs: 2, discardMs: 2, readyMs: 2 } });
    const { alice, created, botId, first } = await soloTable(url);
    const botTurnSeen = stateWhere(alice, (s) => s.log.some((l) => l.startsWith("Ordi Trèfle défausse")));
    const finishedSeen = stateWhere(alice, (s) => s.phase === "finished");
    const readySeen = stateWhere(alice, (s) => s.ready.includes(botId));
    const stopHuman = plainHuman(alice, created.playerId, first);
    // The computer's turns show up in the log, one action after the other.
    const botTurn = await botTurnSeen;
    expect(botTurn.log.some((l) => /^Ordi Trèfle (pioche|prend)/.test(l))).toBe(true);
    const finished = await finishedSeen;
    expect(finished.lastRoundPoints).not.toBeNull();
    // Between rounds the computer says it is ready by itself.
    const ready = await readySeen;
    expect(ready.ready).toEqual([botId]);
    stopHuman();
    alice.disconnect();
  }, 60_000);

  it("pauses while no human is connected, and resumes when one comes back", async () => {
    const app = await server();
    const { alice, created, first } = await soloTable(app.url);
    expect(first.currentPlayerId).toBe(created.playerId);
    // Alice plays her turn, then leaves while it is the computer's turn.
    await playTurn(alice);
    alice.disconnect();
    await sleep(300);
    const room = app.rooms.get(created.roomId)!;
    const paused = room.state;
    expect(paused.players[paused.currentIndex]!.isBot).toBe(true);
    expect(paused.phase).toBe("draw");
    expect(app.bots.isArmed(created.roomId)).toBe(false);

    const back = await client(app.url);
    const resumed = stateWhere(back, (s) => s.currentPlayerId === created.playerId);
    expect(await emit(back, "room:rejoin", created)).toMatchObject({ roomId: created.roomId });
    expect((await resumed).log.some((l) => l.startsWith("Ordi Trèfle défausse"))).toBe(true);
    back.disconnect();
  });

  it("picks the game up again after a server restart", async () => {
    const persistPath = path.join(dir, "rooms.json");
    const before = await server({ persistPath });
    const { alice, created } = await soloTable(before.url);
    await playTurn(alice);
    alice.disconnect();
    await sleep(100);
    before.rooms.saveNow();
    before.stop();

    const after = await server({ persistPath });
    const restored = after.rooms.get(created.roomId)!.state;
    expect(restored.players.find((p) => p.isBot)).toMatchObject({ connected: true });
    const back = await client(after.url);
    const resumed = stateWhere(back, (s) => s.currentPlayerId === created.playerId);
    await emit(back, "room:rejoin", created);
    expect((await resumed).log.some((l) => l.startsWith("Ordi Trèfle défausse"))).toBe(true);
    back.disconnect();
  });

  it("never makes a computer host, and keeps its seat from anyone typing its name", async () => {
    const { url } = await server();
    const a = await client(url);
    const b = await client(url);
    const created = await emit<{ roomId: string; playerId: string }>(a, "room:create", { name: "Alice" });
    await emit(a, "room:addBot", {});
    const joined = await emit<{ playerId: string }>(b, "room:join", { roomId: created.roomId, name: "Bob" });
    const started = stateWhere(b, (s) => s.phase !== "lobby");
    await emit(a, "game:action", { type: "start" });
    await started;
    const handedOver = stateWhere(b, (s) => s.hostId !== created.playerId);
    a.disconnect();
    expect((await handedOver).hostId).toBe(joined.playerId);
    const intruder = await client(url);
    expect(await emit<{ error?: string }>(intruder, "room:join", { roomId: created.roomId, name: "ordi trèfle" })).toMatchObject({
      error: expect.stringMatching(/réservé/),
    });
    intruder.disconnect();
    b.disconnect();
  });
});

describe("bot scheduler", () => {
  /** Alice and a computer, the game started and Alice's first turn played: the computer is to draw. */
  function botToDraw() {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.create("Alice", "sock-a");
    rooms.addBot(room, playerId, "easy");
    rooms.act(room, playerId, { type: "start" });
    rooms.act(room, playerId, { type: "draw", source: "stock" });
    const me = room.state.players.find((p) => p.id === playerId)!;
    rooms.act(room, playerId, { type: "discard", cardId: me.hand.at(-1)!.id });
    return { rooms, room, playerId };
  }

  /** A scheduler that re-arms itself after each move, like the server's broadcast does. */
  function scheduler(rooms: RoomManager, options: ConstructorParameters<typeof BotScheduler>[2] = {}) {
    let changes = 0;
    const bots: BotScheduler = new BotScheduler(rooms, (r) => {
      changes++;
      bots.schedule(r);
    }, { pacing: PACE, ...options });
    stops.push(() => bots.stop());
    return { bots, changes: () => changes };
  }

  it("does not search when a broadcast re-arms the timer: the move is planned when it is due", async () => {
    const { rooms, room } = botToDraw();
    const planner = vi.fn(() => [] as GameAction[]);
    const { bots } = scheduler(rooms, { planner });
    for (let i = 0; i < 5; i++) bots.schedule(room);
    expect(planner).not.toHaveBeenCalled();
    bots.stop();
    await sleep(80);
    expect(planner).not.toHaveBeenCalled();
  });

  it("keeps the table moving when the planner throws", async () => {
    const { rooms, room, playerId } = botToDraw();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { bots } = scheduler(rooms, {
      planner: () => {
        throw new Error("boom");
      },
    });
    bots.schedule(room);
    await sleep(300);
    expect(room.state.players[room.state.currentIndex]!.id).toBe(playerId);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it("falls back to the plain turn when both the plan and the safe move are refused", async () => {
    const { rooms, room, playerId } = botToDraw();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const refuse = vi.spyOn(rooms, "act").mockReturnValueOnce({ ok: false, error: "no" }).mockReturnValueOnce({ ok: false, error: "no" });
    const { bots } = scheduler(rooms);
    bots.schedule(room);
    await sleep(300);
    expect(refuse).toHaveBeenCalledTimes(2);
    expect(room.state.players[room.state.currentIndex]!.id).toBe(playerId);
    expect(room.state.log.some((l) => /absent/.test(l))).toBe(false);
    errors.mockRestore();
  });

  it("never throws when everything fails, and tries again later", async () => {
    const { rooms, room } = botToDraw();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(rooms, "act").mockReturnValue({ ok: false, error: "no" });
    vi.spyOn(rooms, "playBotLastResort").mockReturnValue(false);
    const { bots, changes } = scheduler(rooms);
    expect(() => bots.schedule(room)).not.toThrow();
    await sleep(150);
    expect(changes()).toBe(0);
    expect(bots.isArmed(room.id)).toBe(true);
    errors.mockRestore();
  });

  it("does nothing once stopped", () => {
    const { rooms, room } = botToDraw();
    const { bots } = scheduler(rooms);
    bots.stop();
    bots.schedule(room);
    expect(bots.isArmed(room.id)).toBe(false);
  });

  it("drops a planned discard when the table changed during the beat before it", async () => {
    const { rooms, room, playerId } = botToDraw();
    // The computer has drawn: its next move is the discard, which waits a beat longer.
    rooms.act(room, room.state.players[room.state.currentIndex]!.id, { type: "draw", source: "stock" });
    const { bots, changes } = scheduler(rooms, { pacing: { minMs: 5, maxMs: 5, discardMs: 200, readyMs: 5 } });
    bots.schedule(room);
    await sleep(60);
    // The turn goes back to the human before the discard is due: it must not be applied.
    const moved = { ...room.state, currentIndex: room.state.players.findIndex((p) => p.id === playerId) };
    room.state = moved;
    await sleep(300);
    expect(room.state).toBe(moved);
    expect(changes()).toBe(0);
  });
});

describe("socket guards", () => {
  it("rate-limits table creation and computer requests per socket", async () => {
    const { url } = await server();
    const a = await client(url);
    await emit(a, "room:create", { name: "Alice" });
    const replies: { error?: string }[] = [];
    for (let i = 0; i < 10; i++) replies.push(await emit(a, "room:removeBot", { playerId: "nobody" }));
    // The create counted too: the tenth request after it is one too many.
    expect(replies.slice(0, 9).every((r) => r.error === "Ordinateur introuvable")).toBe(true);
    expect(replies[9]!.error).toMatch(/Trop de demandes/);
    a.disconnect();
  });

  it("does not play for an absent player while no human is at the table", async () => {
    const app = await server({ absentTurnDelayMs: 40 });
    const a = await client(app.url);
    const b = await client(app.url);
    const created = await emit<{ roomId: string }>(a, "room:create", { name: "Alice" });
    await emit(b, "room:join", { roomId: created.roomId, name: "Bob" });
    const started = stateWhere(b, (s) => s.phase === "draw");
    await emit(a, "game:action", { type: "start" });
    await started;
    a.disconnect();
    b.disconnect();
    await sleep(80);
    const before = app.rooms.get(created.roomId)!.state;
    await sleep(200);
    expect(app.rooms.get(created.roomId)!.state).toBe(before);
    expect(before.discard).toHaveLength(1);
  });
});

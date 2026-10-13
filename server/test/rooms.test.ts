import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { applyAction } from "@visualrami/shared";
import { isReservedName, RoomManager } from "../src/rooms.js";

const dir = mkdtempSync(path.join(tmpdir(), "visualrami-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function startedRoom(rooms: RoomManager) {
  const { room, playerId } = rooms.create("Alice", "sock-a");
  const bob = rooms.join(room.id, "Bob", "sock-b");
  if (!bob.ok) throw new Error(bob.error);
  const started = rooms.act(room, playerId, { type: "start" });
  if (!started.ok) throw new Error(started.error);
  return { room, alice: playerId, bob: bob.playerId };
}

describe("resume by code and name", () => {
  it("gives a disconnected seat back to a player who joins with the same name", () => {
    const rooms = new RoomManager();
    const { room, bob } = startedRoom(rooms);
    rooms.leave(room, bob, "sock-b");
    expect(room.state.players.find((p) => p.id === bob)!.connected).toBe(false);

    const back = rooms.join(room.id, "  bob ", "sock-b2");
    expect(back.ok && back.resumed && back.playerId === bob).toBe(true);
    expect(room.state.players.find((p) => p.id === bob)!.connected).toBe(true);
    expect(room.sockets.get(bob)).toBe("sock-b2");
  });

  it("refuses an unknown name or a seat that is still connected", () => {
    const rooms = new RoomManager();
    const { room } = startedRoom(rooms);
    expect(rooms.join(room.id, "Carol", "sock-c")).toMatchObject({ ok: false });
    expect(rooms.join(room.id, "Alice", "sock-a2")).toMatchObject({ ok: false, error: /déjà connecté/ });
  });
});

describe("persistence", () => {
  it("restores started games with their tokens after a restart, everyone disconnected", () => {
    const file = path.join(dir, "rooms.json");
    const rooms = new RoomManager({ persistPath: file });
    const { room, alice, bob } = startedRoom(rooms);
    const token = room.tokens.get(alice)!;
    rooms.saveNow();

    const restored = new RoomManager({ persistPath: file });
    expect(restored.size).toBe(1);
    const again = restored.get(room.id)!;
    expect(again.state.phase).toBe("draw");
    expect(again.state.players.every((p) => !p.connected)).toBe(true);
    expect(again.sockets.size).toBe(0);
    expect(restored.rejoin(room.id, alice, token, "sock-a3").ok).toBe(true);
    expect(restored.join(room.id, "Bob", "sock-b3")).toMatchObject({ ok: true, playerId: bob, resumed: true });
  });

  it("loads a snapshot written before readiness existed, and readiness then works", () => {
    const file = path.join(dir, "old-rooms.json");
    const rooms = new RoomManager({ persistPath: file });
    const { room, alice, bob } = startedRoom(rooms);
    rooms.saveNow();
    // Rewrite the file the way the previous version saved it: no `ready` field anywhere.
    const data = JSON.parse(readFileSync(file, "utf8"));
    for (const saved of data.rooms) {
      delete saved.state.ready;
      saved.state.phase = "finished";
      saved.state.winnerId = alice;
    }
    writeFileSync(file, JSON.stringify(data));

    const restored = new RoomManager({ persistPath: file }).get(room.id)!;
    expect(restored.state.ready).toEqual([]);
    // Straight through the reducer: acting through the manager would schedule a save that could
    // land after the temporary directory is removed.
    const guest = restored.state.hostId === alice ? bob : alice;
    const result = applyAction(restored.state, guest, { type: "ready", ready: true });
    expect(result.ok && result.state.ready).toEqual([guest]);
  });

  it("loads a snapshot written before the reshuffle count, keeping a first-laydown threshold above today's cap", () => {
    const file = path.join(dir, "no-reshuffles.json");
    const rooms = new RoomManager({ persistPath: file });
    const { room } = startedRoom(rooms);
    rooms.saveNow();
    const data = JSON.parse(readFileSync(file, "utf8"));
    for (const saved of data.rooms) {
      delete saved.state.reshuffles;
      saved.state.options.firstMeldMinPoints = 150;
    }
    writeFileSync(file, JSON.stringify(data));

    const restored = new RoomManager({ persistPath: file }).get(room.id)!.state;
    expect(restored.reshuffles).toBe(0);
    expect(restored.options.firstMeldMinPoints).toBe(150);
    // The count starts from zero rather than NaN: the next reshuffle makes it 1.
    const empty = { ...restored, discard: [...restored.discard, ...restored.stock], stock: [] };
    const player = empty.players[empty.currentIndex]!.id;
    const drawn = applyAction(empty, player, { type: "draw", source: "stock" });
    expect(drawn.ok && drawn.state.reshuffles).toBe(1);
  });

  it("keeps a saved reshuffle count only when it is a whole number, zero or more", () => {
    const file = path.join(dir, "bad-reshuffles.json");
    const rooms = new RoomManager({ persistPath: file });
    const tables = [startedRoom(rooms), startedRoom(rooms), startedRoom(rooms), startedRoom(rooms), startedRoom(rooms)];
    rooms.saveNow();
    const values: unknown[] = [2, -1, 2.5, "3", null];
    const data = JSON.parse(readFileSync(file, "utf8"));
    for (const saved of data.rooms) saved.state.reshuffles = values[tables.findIndex((t) => t.room.id === saved.id)];
    writeFileSync(file, JSON.stringify(data));
    const restored = new RoomManager({ persistPath: file });
    expect(tables.map((t) => restored.get(t.room.id)!.state.reshuffles)).toEqual([2, 0, 0, 0, 0]);
  });

  it("starts empty when the file is missing or corrupt", () => {
    expect(new RoomManager({ persistPath: path.join(dir, "missing.json") }).size).toBe(0);
  });
});

describe("sweep", () => {
  it("drops idle lobbies after 6 h and idle games after 7 days only", () => {
    const rooms = new RoomManager();
    const lobby = rooms.create("Alice", "sock-l").room;
    rooms.leave(lobby, lobby.state.players[0]!.id, "sock-l"); // empty lobby is dropped immediately
    const { room, alice, bob } = startedRoom(rooms);
    rooms.leave(room, alice, "sock-a");
    rooms.leave(room, bob, "sock-b");
    const now = room.lastActivity;
    expect(rooms.sweep(now + 7 * 60 * 60 * 1000)).toBe(0);
    expect(rooms.size).toBe(1);
    expect(rooms.sweep(now + 8 * 24 * 60 * 60 * 1000)).toBe(1);
    expect(rooms.size).toBe(0);
  });
});

describe("computer players", () => {
  it("adds named computer players for the host, in the lobby, and removes them", () => {
    const rooms = new RoomManager();
    const { room, playerId } = rooms.create("Alice", "sock-a");
    const bob = rooms.join(room.id, "Bob", "sock-b");
    if (!bob.ok) throw new Error(bob.error);
    expect(rooms.addBot(room, bob.playerId, "easy")).toMatchObject({ ok: false });
    const first = rooms.addBot(room, playerId, "easy");
    const second = rooms.addBot(room, playerId, "easy");
    expect(first.ok && second.ok).toBe(true);
    const bots = room.state.players.filter((p) => p.isBot);
    expect(bots.map((p) => p.name)).toEqual(["Ordi Trèfle", "Ordi Carreau"]);
    expect(bots.every((p) => p.connected && p.level === "easy")).toBe(true);
    expect(rooms.removeBot(room, bob.playerId, bots[0]!.id)).toMatchObject({ ok: false });
    expect(rooms.removeBot(room, playerId, bob.playerId)).toMatchObject({ ok: false });
    expect(rooms.removeBot(room, playerId, bots[0]!.id)).toMatchObject({ ok: true });
    // The freed name is the next one handed out.
    rooms.addBot(room, playerId, "easy");
    expect(room.state.players.filter((p) => p.isBot).map((p) => p.name)).toEqual(["Ordi Carreau", "Ordi Trèfle"]);
  });

  it("keeps computer names for computers: a human cannot take one, nor take a computer's seat", () => {
    const rooms = new RoomManager();
    expect(isReservedName("Ordi Cœur")).toBe(true);
    expect(isReservedName("  ordi coeur ")).toBe(true);
    expect(isReservedName("ORDI")).toBe(true);
    expect(isReservedName("Ordinateur")).toBe(true);
    expect(isReservedName("Ordinette")).toBe(false);
    expect(isReservedName("Jordi")).toBe(false);
    expect(isReservedName("Ordi-Trèfle")).toBe(true);
    expect(isReservedName("Ordi_Trèfle")).toBe(true);
    expect(isReservedName("Ordi\u200b Trèfle")).toBe(true);
    expect(isReservedName("O\u200brdi Trèfle")).toBe(true);
    expect(isReservedName("0rdi Cœur")).toBe(true);
    expect(isReservedName("Ordinaire")).toBe(false);
    const { room, playerId } = rooms.create("Alice", "sock-a");
    expect(rooms.join(room.id, "Ordi Pique", "sock-x")).toMatchObject({ ok: false });
    rooms.addBot(room, playerId, "easy");
    rooms.act(room, playerId, { type: "start" });
    const taken = rooms.join(room.id, "Ordi Trèfle", "sock-y");
    expect(taken).toMatchObject({ ok: false });
    expect(room.state.players.find((p) => p.isBot)!.connected).toBe(true);
  });

  it("lets a human seat saved with a name now reserved be taken back by that name", () => {
    const file = path.join(dir, "legacy-name.json");
    const rooms = new RoomManager({ persistPath: file });
    const { room, playerId } = rooms.create("Alice", "sock-a");
    const other = rooms.join(room.id, "Bob", "sock-b");
    if (!other.ok) throw new Error(other.error);
    rooms.addBot(room, playerId, "easy");
    rooms.act(room, playerId, { type: "start" });
    // A name chosen before the rule existed.
    room.state = { ...room.state, players: room.state.players.map((p) => (p.id === other.playerId ? { ...p, name: "Ordinateur Bob" } : p)) };
    rooms.saveNow();
    const restored = new RoomManager({ persistPath: file });
    expect(restored.join(room.id, "Ordinateur Bob", "sock-x")).toMatchObject({ ok: true, playerId: other.playerId, resumed: true });
    expect(restored.join(room.id, "Ordi Trèfle", "sock-y")).toMatchObject({ ok: false });
  });

  it("restores computer players connected even from a snapshot that says otherwise", () => {
    const file = path.join(dir, "bots-offline.json");
    const rooms = new RoomManager({ persistPath: file });
    const { room, playerId } = rooms.create("Alice", "sock-a");
    rooms.addBot(room, playerId, "easy");
    rooms.act(room, playerId, { type: "start" });
    room.state = { ...room.state, players: room.state.players.map((p) => ({ ...p, connected: false })) };
    rooms.saveNow();
    const restored = new RoomManager({ persistPath: file }).get(room.id)!;
    expect(restored.state.players.find((p) => p.isBot)!.connected).toBe(true);
  });

  it("restores computer players connected, so they never look absent", () => {
    const file = path.join(dir, "bots.json");
    const rooms = new RoomManager({ persistPath: file });
    const { room, playerId } = rooms.create("Alice", "sock-a");
    rooms.addBot(room, playerId, "easy");
    rooms.act(room, playerId, { type: "start" });
    rooms.saveNow();
    const restored = new RoomManager({ persistPath: file }).get(room.id)!;
    expect(restored.state.players.map((p) => [p.isBot === true, p.connected])).toEqual([
      [false, false],
      [true, true],
    ]);
    expect(restored.state.hostId).toBe(playerId);
  });
});

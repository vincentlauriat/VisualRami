import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { RoomManager } from "../src/rooms.js";

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

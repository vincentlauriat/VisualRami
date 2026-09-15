import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import type { AddressInfo } from "node:net";
import type { PublicGameState } from "@visualrami/shared";
import { createApp } from "../src/app.js";

let url = "";
let close: () => void;

beforeAll(async () => {
  const { server, io } = createApp({ clientDist: "/nonexistent", absentTurnDelayMs: 150, persistPath: undefined });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  url = `http://127.0.0.1:${port}`;
  close = () => {
    io.close();
    server.close();
  };
});

afterAll(() => close());

function client(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect(url, { transports: ["websocket"], forceNew: true });
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
  });
}

function emit<T>(socket: Socket, event: string, payload?: unknown): Promise<T> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response: T) => resolve(response));
  });
}

function nextState(socket: Socket): Promise<PublicGameState> {
  return new Promise((resolve) => socket.once("room:state", resolve));
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

describe("socket server", () => {
  it("creates a room, joins, starts, plays a turn and relays signaling", async () => {
    const a = await client();
    const b = await client();

    const created = await emit<{ roomId: string; playerId: string; token: string }>(a, "room:create", {
      name: "Alice",
    });
    expect(created.roomId).toHaveLength(5);

    const bStatePromise = nextState(b);
    const joined = await emit<{ roomId: string; playerId: string; token: string }>(b, "room:join", {
      roomId: created.roomId.toLowerCase(),
      name: "Bob",
    });
    expect("error" in joined).toBe(false);
    const lobby = await bStatePromise;
    expect(lobby.players.map((p) => p.name)).toEqual(["Alice", "Bob"]);
    expect(lobby.you.id).toBe(joined.playerId);

    const notHost = await emit<{ error?: string }>(b, "game:action", { type: "start" });
    expect(notHost.error).toMatch(/hôte/);

    const aStatePromise = stateWhere(a, (s) => s.phase === "draw");
    const started = await emit<{ ok?: true; error?: string }>(a, "game:action", { type: "start" });
    expect(started.ok).toBe(true);
    const state = await aStatePromise;
    expect(state.phase).toBe("draw");
    expect(state.you.hand).toHaveLength(14);
    expect(state.players.find((p) => p.id === joined.playerId)!.handCount).toBe(14);

    const current = state.currentPlayerId === created.playerId ? a : b;
    const malformed = await emit<{ error?: string }>(current, "game:action", { type: "layDown" });
    expect(malformed.error).toBe("Action invalide");
    const stillAlive = await emit<{ error?: string }>(current, "game:action", { type: "layDown", melds: "abc" });
    expect(stillAlive.error).toBe("Action invalide");
    const stateAfterDraw = stateWhere(current, (s) => s.phase === "play");
    const draw = await emit<{ ok?: true; error?: string }>(current, "game:action", {
      type: "draw",
      source: "stock",
    });
    expect(draw.ok).toBe(true);
    const afterDraw = await stateAfterDraw;
    expect(afterDraw.phase).toBe("play");
    expect(afterDraw.you.hand).toHaveLength(15);

    const stateAfterDiscard = stateWhere(current, (s) => s.phase === "draw" && s.discardCount === 2);
    const discard = await emit<{ ok?: true; error?: string }>(current, "game:action", {
      type: "discard",
      cardId: afterDraw.you.hand[0]!.id,
    });
    expect(discard.ok).toBe(true);
    const afterDiscard = await stateAfterDiscard;
    expect(afterDiscard.currentPlayerId).not.toBe(afterDraw.you.id);
    expect(afterDiscard.discardCount).toBe(2);
    expect((afterDiscard as unknown as { discard?: unknown }).discard).toBeUndefined();

    // Signaling relay
    const relayed = new Promise<{ from: string; data: unknown }>((resolve) =>
      b.once("rtc:signal", resolve),
    );
    a.emit("rtc:signal", { to: joined.playerId, data: { hello: "world" } }); // dropped: not SDP/ICE
    a.emit("rtc:signal", { to: joined.playerId, data: { candidate: { candidate: "candidate:1 1 udp 1 1.2.3.4 5 typ host" } } });
    const signal = await relayed;
    expect(signal.from).toBe(created.playerId);
    expect(signal.data).toEqual({ candidate: { candidate: "candidate:1 1 udp 1 1.2.3.4 5 typ host" } });

    // Rejoin after a reload with the same token
    const peerReset = new Promise<{ playerId: string }>((resolve) => a.once("rtc:peer-reset", resolve));
    b.disconnect();
    const b2 = await client();
    const rejoined = await emit<{ roomId?: string; error?: string }>(b2, "room:rejoin", {
      roomId: created.roomId,
      playerId: joined.playerId,
      token: joined.token,
    });
    expect(rejoined.roomId).toBe(created.roomId);
    expect((await peerReset).playerId).toBe(joined.playerId);

    const badToken = await emit<{ error?: string }>(await client(), "room:rejoin", {
      roomId: created.roomId,
      playerId: joined.playerId,
      token: "nope",
    });
    expect(badToken.error).toBeTruthy();

    // A socket that rejoins from inside another room is detached from it first.
    const c = await client();
    const other = await emit<{ roomId: string }>(c, "room:create", { name: "Carol" });
    expect(other.roomId).not.toBe(created.roomId);
    const cRejoin = await emit<{ roomId?: string; error?: string }>(c, "room:rejoin", {
      roomId: created.roomId,
      playerId: joined.playerId,
      token: joined.token,
    });
    expect(cRejoin.roomId).toBe(created.roomId);
    const gone = await emit<{ error?: string }>(await client(), "room:join", { roomId: other.roomId, name: "Dan" });
    expect(gone.error).toBe("Salle introuvable");
    c.disconnect();

    a.disconnect();
    b2.disconnect();
  });

  it("plays the turn of a player who stays disconnected and hands the host role over", async () => {
    const a = await client();
    const b = await client();
    const created = await emit<{ roomId: string; playerId: string }>(a, "room:create", { name: "Alice" });
    const joined = await emit<{ playerId: string }>(b, "room:join", { roomId: created.roomId, name: "Bob" });
    const started = stateWhere(b, (s) => s.phase === "draw");
    await emit(a, "game:action", { type: "start" });
    const state = await started;
    const absent = state.currentPlayerId === created.playerId ? a : b;
    const stayer = absent === a ? b : a;
    const absentId = absent === a ? created.playerId : joined.playerId;

    const afterLeave = stateWhere(stayer, (s) => s.players.some((p) => !p.connected));
    absent.disconnect();
    const left = await afterLeave;
    expect(left.players.find((p) => p.id === absentId)!.connected).toBe(false);
    expect(left.hostId).not.toBe(absentId);

    const afterAuto = await stateWhere(stayer, (s) => s.currentPlayerId !== absentId);
    expect(afterAuto.currentPlayerId).toBe(afterAuto.you.id);
    expect(afterAuto.discardCount).toBe(2);
    expect(afterAuto.log.at(-1)).toMatch(/absent/);
    stayer.disconnect();
  });

  it("acknowledges room:leave even when emitted with an undefined payload", async () => {
    const s = await client();
    await emit(s, "room:create", { name: "Eve" });
    const res = await Promise.race([
      emit<{ ok?: true }>(s, "room:leave", undefined),
      new Promise<{ ok?: true }>((_, reject) => setTimeout(() => reject(new Error("no ack")), 1500)),
    ]);
    expect(res.ok).toBe(true);
    s.disconnect();
  });

  it("lets a player come back into a started game with the code and their name", async () => {
    const a = await client();
    const b = await client();
    const created = await emit<{ roomId: string; playerId: string }>(a, "room:create", { name: "Alice" });
    const joined = await emit<{ playerId: string }>(b, "room:join", { roomId: created.roomId, name: "Bob" });
    const started = stateWhere(a, (s) => s.phase === "draw");
    await emit(a, "game:action", { type: "start" });
    await started;

    const gone = stateWhere(a, (s) => s.players.some((p) => !p.connected));
    b.disconnect();
    await gone;

    const b2 = await client();
    const reset = new Promise<{ playerId: string }>((resolve) => a.once("rtc:peer-reset", resolve));
    const statePromise = stateWhere(b2, (s) => s.you.id === joined.playerId);
    const back = await emit<{ playerId?: string; resumed?: boolean; error?: string }>(b2, "room:join", {
      roomId: created.roomId,
      name: "bob",
    });
    expect(back).toMatchObject({ playerId: joined.playerId, resumed: true });
    expect((await reset).playerId).toBe(joined.playerId);
    const state = await statePromise;
    expect(state.you.hand).toHaveLength(14);
    expect(state.players.every((p) => p.connected)).toBe(true);
    a.disconnect();
    b2.disconnect();
  });

  it("rejects joining an unknown room", async () => {
    const s = await client();
    const res = await emit<{ error?: string }>(s, "room:join", { roomId: "ZZZZZ", name: "X" });
    expect(res.error).toBe("Salle introuvable");
    s.disconnect();
  });
});

// End-to-end probe of a deployed VisualRami server over the network:
// two Socket.IO clients (WebSocket transport only), create/join/start, one full turn,
// one signalling relay. Usage: node Scripts/probe-remote.mjs https://host
import { io } from "socket.io-client";

const url = process.argv[2];
if (!url) {
  console.error("usage: node Scripts/probe-remote.mjs <url>");
  process.exit(2);
}

const connect = () =>
  new Promise((resolve, reject) => {
    const s = io(url, { transports: ["websocket"], forceNew: true, timeout: 10000 });
    s.on("connect", () => resolve(s));
    s.on("connect_error", (e) => reject(new Error(`connect_error: ${e.message}`)));
  });
const ask = (s, event, payload) =>
  new Promise((resolve, reject) =>
    s.timeout(10000).emit(event, payload, (err, res) => (err ? reject(err) : resolve(res))),
  );
const stateWhere = (s, pred) =>
  new Promise((resolve) => {
    const on = (st) => {
      if (pred(st)) {
        s.off("room:state", on);
        resolve(st);
      }
    };
    s.on("room:state", on);
  });

const t0 = Date.now();
const a = await connect();
const b = await connect();
console.log(`connected via ${a.io.engine.transport.name} in ${Date.now() - t0} ms`);
const created = await ask(a, "room:create", { name: "Alice" });
const joined = await ask(b, "room:join", { roomId: created.roomId, name: "Bob" });
if (joined.error) throw new Error(joined.error);
const started = stateWhere(a, (s) => s.phase === "draw");
await ask(a, "game:action", { type: "start" });
const st = await started;
const current = st.currentPlayerId === created.playerId ? a : b;
const afterDraw = stateWhere(current, (s) => s.phase === "play");
await ask(current, "game:action", { type: "draw", source: "stock" });
const drawn = await afterDraw;
const afterDiscard = stateWhere(current, (s) => s.phase === "draw" && s.discardCount === 2);
await ask(current, "game:action", { type: "discard", cardId: drawn.you.hand[0].id });
const done = await afterDiscard;
const relayed = new Promise((resolve) => b.once("rtc:signal", resolve));
a.emit("rtc:signal", { to: joined.playerId, data: { candidate: { candidate: "candidate:1 1 udp 1 1.2.3.4 5 typ host" } } });
const sig = await relayed;
console.log(`room ${created.roomId}: dealt ${st.you.hand.length} cards, turn passed to ${done.players.find((p) => p.id === done.currentPlayerId).name}, signal relayed from ${sig.from === created.playerId ? "Alice" : "?"}`);
await ask(a, "room:leave");
await ask(b, "room:leave");
a.disconnect();
b.disconnect();
console.log(`OK in ${Date.now() - t0} ms`);

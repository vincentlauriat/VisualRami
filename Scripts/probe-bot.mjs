// End-to-end probe of the computer player on a deployed VisualRami server:
// one human seat plus one bot, start, then wait until the bot has played a full turn
// (draw then discard) while the human is connected. Usage: node Scripts/probe-bot.mjs https://host
import { io } from "socket.io-client";

const url = process.argv[2];
if (!url) {
  console.error("usage: node Scripts/probe-bot.mjs <url>");
  process.exit(2);
}

const s = await new Promise((resolve, reject) => {
  const c = io(url, { transports: ["websocket"], forceNew: true, timeout: 10000 });
  c.on("connect", () => resolve(c));
  c.on("connect_error", (e) => reject(new Error(`connect_error: ${e.message}`)));
});
const ask = (event, payload) =>
  new Promise((resolve, reject) =>
    s.timeout(10000).emit(event, payload, (err, res) => (err ? reject(err) : resolve(res))),
  );
let last = null;
s.on("room:state", (st) => (last = st));
const stateWhere = (pred, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const who = last?.players.find((p) => p.id === last.currentPlayerId);
      reject(new Error(`timed out: phase=${last?.phase} turn=${who?.name} stock=${last?.stockCount} log=${JSON.stringify(last?.log.slice(-3))}`));
    }, ms);
    const on = (st) => {
      if (pred(st)) {
        clearTimeout(timer);
        s.off("room:state", on);
        resolve(st);
      }
    };
    s.on("room:state", on);
  });

const t0 = Date.now();
const created = await ask("room:create", { name: "Alice" });
const added = await ask("room:addBot", { level: "easy" });
if (added?.error) throw new Error(added.error);
const started = stateWhere((st) => st.phase === "draw", 10000);
await ask("game:action", { type: "start" });
let st = await started;
const bot = st.players.find((p) => p.isBot);
if (!bot) throw new Error("no bot seated");
if (st.currentPlayerId !== bot.id) {
  const handOver = stateWhere((x) => x.currentPlayerId === bot.id, 10000);
  const playing = stateWhere((x) => x.phase === "play", 10000);
  await ask("game:action", { type: "draw", source: "stock" });
  const mine = await playing;
  await ask("game:action", { type: "discard", cardId: mine.you.hand[0].id });
  st = await handOver;
}
const tBot = Date.now();
const back = await stateWhere((x) => x.currentPlayerId === created.playerId && x.phase === "draw", 20000);
console.log(`room ${created.roomId}: ${bot.name} played its turn in ${Date.now() - tBot} ms; log: ${back.log.slice(-2).map((l) => l.text ?? l).join(" | ")}`);
await ask("room:leave");
s.disconnect();
console.log(`OK in ${Date.now() - t0} ms`);

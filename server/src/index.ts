import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const tls =
  process.env.HTTPS_KEY && process.env.HTTPS_CERT
    ? { key: process.env.HTTPS_KEY, cert: process.env.HTTPS_CERT }
    : undefined;

const corsOrigin = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()).filter(Boolean);
// Rooms are persisted so a game survives a restart or a redeploy (on App Service, point DATA_DIR to /home/...).
const dataDir = process.env.DATA_DIR ?? "data";
const persistPath = process.env.DATA_DIR === "" ? undefined : `${dataDir}/rooms.json`;
const { server } = createApp({
  tls,
  corsOrigin: corsOrigin && corsOrigin.length > 0 ? corsOrigin : undefined,
  persistPath,
});

// A single bad request must never take every table down with it.
process.on("uncaughtException", (err) => console.error("uncaught exception", err));
process.on("unhandledRejection", (err) => console.error("unhandled rejection", err));

server.listen(port, host, () => {
  const scheme = tls ? "https" : "http";
  console.log(`VisualRami server listening on ${scheme}://${host}:${port}`);
  console.log(persistPath ? `rooms persisted in ${persistPath}` : "rooms kept in memory only (DATA_DIR is empty)");
  if (!tls) {
    console.log(
      "Camera/microphone only work on http://localhost or over HTTPS. Set HTTPS_KEY and HTTPS_CERT for LAN play.",
    );
  }
});

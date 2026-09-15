# VisualRami

[![CI](https://github.com/vincentlauriat/VisualRami/actions/workflows/ci.yml/badge.svg)](https://github.com/vincentlauriat/VisualRami/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Online French Rummy (**Rami 51**) for 2 to 6 players, with **live video and voice** between everyone at the
table. The game state is authoritative on the server; audio and video flow peer-to-peer over WebRTC.

Play: https://<app>.azurewebsites.net · Landing page: https://lauriat.fr/outils/visualrami/ · More apps: https://vincentlauriat.github.io

## Features

| Feature | Status |
|---|---|
| Rami 51 rules (2 × 52 cards + 4 jokers, 14 cards each) | ✅ |
| Runs (ace low or high) and sets, jokers allowed | ✅ |
| First laydown ≥ 51 points with a pure run (room options) | ✅ |
| Extend any meld on the table, swap a joker for the real card | ✅ |
| Round scoring (hand points, doubled if never laid down), cumulative score | ✅ |
| Room codes and share links, 2–6 players | ✅ |
| Video + audio mesh (WebRTC, STUN), mic/camera toggles | ✅ |
| Text chat and game log | ✅ |
| Reconnect after a page reload, absent-player auto-turn, host handover | ✅ |
| Games survive a server restart; come back with the table code and your name (7 days) | ✅ |
| Phone-friendly table layout (tested at 390 px) | ✅ |
| Azure App Service packaging + remote probe | ✅ |
| TURN relay for restrictive networks | ⚙️ configurable, bring your own server |
| Drag-and-drop hand, spectator mode, game history | ⏳ roadmap |

## Quick start

```bash
npm install
npm run build
npm start            # http://localhost:3000
```

Open the URL in two browser tabs (each tab is its own player), create a table, share the 5-letter code
or the link, start the game.

## Development

```bash
npm run dev          # server on :3000 (tsx watch) + Vite client on :5173 with socket proxy
npm test             # rules + reducer tests (shared), Socket.IO integration tests (server)
npm run typecheck
npm run package:azure                     # release/visualrami-azure.zip
npm run probe -- https://<host>           # end-to-end WebSocket check against a deployment
```

## Documentation

| Document | Content |
|---|---|
| [docs/EXECUTION_PLAN.md](docs/EXECUTION_PLAN.md) | Phases, deliverables, status, risks |
| [ARCHITECTURE_EN.md](ARCHITECTURE_EN.md) / [ARCHITECTURE.md](ARCHITECTURE.md) | Packages, state model, socket events, media, deployment (EN / FR) |
| [docs/GAME_RULES.md](docs/GAME_RULES.md) | The rules exactly as implemented |
| [docs/DEPLOYMENT_AZURE.md](docs/DEPLOYMENT_AZURE.md) | App Service procedure and the pitfalls met |
| [CHANGELOG.md](CHANGELOG.md) | Versions and notable changes |

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `PORT`, `HOST` | server | Listen address (default `0.0.0.0:3000`) |
| `HTTPS_KEY`, `HTTPS_CERT` | server | Serve HTTPS directly (camera/mic need HTTPS outside localhost) |
| `DATA_DIR` | server | Directory of `rooms.json`, the persisted tables (default `data/`; empty string = memory only; on App Service use `/home/data`) |
| `CORS_ORIGIN` | server | Comma-separated origins allowed to open the socket when the client is served elsewhere (default: same origin only) |
| `VITE_TURN_URL` | client build | Comma-separated TURN URLs (`turn:turn.example.com:3478`) |
| `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` | client build | TURN credentials |

### Playing over the LAN

Browsers only expose the camera and microphone on `http://localhost` or over HTTPS:

```bash
brew install mkcert && mkcert -install
mkdir certs && mkcert -key-file certs/key.pem -cert-file certs/cert.pem 192.168.1.20 localhost
HTTPS_KEY=certs/key.pem HTTPS_CERT=certs/cert.pem npm start   # https://192.168.1.20:3000
```

### Deploying

See [docs/DEPLOYMENT_AZURE.md](docs/DEPLOYMENT_AZURE.md). Any HTTPS host that forwards WebSockets to a single
Node instance works. Players behind strict NATs may need a TURN server.

## Project layout

```
shared/    card model, rules, pure game reducer (+ vitest)
server/    Express + Socket.IO: rooms, authoritative state, WebRTC signalling, static client
client/    React + Vite: lobby, table, hand interactions, WebRTC mesh hook
Scripts/   build-azure.sh (App Service package), probe-remote.mjs (end-to-end probe)
docs/      execution plan, game rules, Azure deployment guide
```

## Contributing

Issues and pull requests are welcome. Run `npm test` and `npm run typecheck` before opening a PR; CI runs both plus the build.

## License

[MIT](LICENSE) © 2026 Vincent Lauriat

## Rules in brief

- 14 cards each; draw from the stock or the discard pile, lay down, discard one card.
- Runs of 3+ same-suit consecutive cards (A-2-3 or Q-K-A) and sets of 3–4 same-rank cards; jokers never
  outnumber real cards.
- First laydown: at least 51 points including a pure run. Then extend any meld and take jokers back.
- The round ends on the last discard; others count their hand (joker 20, ace 11, faces 10), doubled if
  they never laid down. Lowest cumulative score wins.

Full rules: [docs/GAME_RULES.md](docs/GAME_RULES.md).

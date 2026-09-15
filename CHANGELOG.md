# Changelog

All notable changes to VisualRami. Format inspired by Keep a Changelog; versions follow SemVer.

## [Unreleased]

### Added
- Games survive a server restart (`DATA_DIR/rooms.json`) and stay open 7 days; a player comes back with the table code and the same name, or with one click from the remembered seats on the home page.

### Changed
- Tables seat 2 to 6 players (was 4). Opponent tiles shrink to fit five of them.

## [0.1.0] — 2026-09-15

### Added
- Rami 51 rules engine (`shared`): card model, run/set analysis with jokers and ace low/high, first-laydown
  check (51 points + pure run, configurable), pure reducer for the whole turn cycle, round scoring.
- Server (`server`): Express 5 + Socket.IO 4, rooms with 5-letter codes and rejoin tokens, strict payload
  validation, WebRTC signalling relay with size and rate limits, chat, absent-player auto-turn, host handover,
  optional HTTPS, static serving of the built client.
- Client (`client`): React 19 + Vite 7, home / lobby / table screens, ordered hand selection, staging area
  for the first laydown, meld targets (extend or swap joker), log and chat panel, round result overlay,
  session persistence in `sessionStorage`, full-mesh WebRTC hook with perfect negotiation and watchdog.
- Azure App Service packaging (`Scripts/build-azure.sh`) and remote WebSocket probe (`Scripts/probe-remote.mjs`).
- Documentation: README, architecture (EN/FR), execution plan, Azure deployment guide, game rules.
- CI workflow: typecheck, tests and build on every push.

### Fixed (from the independent code review of 2026-09-14)
- Malformed `game:action` payloads crashed the whole server process.
- Leaving a table did not close peer connections nor release the camera.
- A lost WebRTC offer left a peer black forever; the mesh is now reset on socket connect and rebuilt by a watchdog.
- The game froze when the current player disconnected; the host role was stuck on a departed host.
- `room:rejoin` did not detach the socket from its previous room.
- The card taken from the discard pile could not be discarded as the last card (dead turn).
- Unbounded `rtc:signal` and `chat:message` payloads; CORS reflected any origin.
- The full discard pile was sent to clients although only the top card is shown.
- `room:leave` was never acknowledged when emitted without payload.

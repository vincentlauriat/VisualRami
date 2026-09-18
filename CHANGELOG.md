# Changelog

All notable changes to VisualRami. Format inspired by Keep a Changelog; versions follow SemVer.

## [Unreleased]

### Added
- Device-aware layout beyond the phone: a tablet-portrait tier (real card and opponent sizes instead of phone sizing), a landscape tier that moves opponents to a left rail and pins the game to the viewport so the hand never falls below the fold, and touch-sized controls on any coarse pointer regardless of viewport width.
- Product record (`PRODUCT.md`) and a UI technical audit (`docs/AUDIT_UI.md`).
- Public repository under the MIT license; landing page on lauriat.fr, listed on vincentlauriat.github.io and the GitHub profile.
- Games survive a server restart (`DATA_DIR/rooms.json`) and stay open 7 days; a player comes back with the table code and the same name, or with one click from the remembered seats on the home page.

### Fixed
- The camera/microphone error was hidden on phones: the rule that hid it matched nothing else, so "Accès caméra/micro refusé" never appeared on the device where it happens most.
- Safe-area insets were inert without `viewport-fit=cover`, so the sticky action bar sat under the iPhone home indicator.
- The round-result overlay could be covered by the log/chat panel on phones.
- Native checkboxes, number inputs and scrollbars rendered in light mode on the dark table (`color-scheme`).

### Changed
- Phone layout (≤ 900 px): stacked sections, opponents in a scrollable strip, smaller cards, sticky action bar with 44 px targets, log/chat as a bottom sheet behind a 💬 button, iOS safe areas and no zoom on input focus.
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

# Changelog

All notable changes to VisualRami. Format inspired by Keep a Changelog; versions follow SemVer.

## [Unreleased]

### Added
- Device-aware layout beyond the phone: a tablet-portrait tier (real card and opponent sizes instead of phone sizing), a landscape tier that moves opponents to a left rail and pins the game to the viewport so the hand never falls below the fold, and touch-sized controls on any coarse pointer regardless of viewport width.
- Product record (`PRODUCT.md`) and a UI technical audit (`docs/AUDIT_UI.md`).
- Design system record (`DESIGN.md`, with the `.impeccable/design.json` sidecar): tokens, layout tiers, elevation and component rules extracted from the shipped client.
- Public repository under the MIT license; landing page on lauriat.fr, listed on vincentlauriat.github.io and the GitHub profile.
- Games survive a server restart (`DATA_DIR/rooms.json`) and stay open 7 days; a player comes back with the table code and the same name, or with one click from the remembered seats on the home page.

### Fixed
- A run was only accepted when its cards were tapped in sequence; the selection is now put in order (jokers filling the gaps) before it is checked, and an invalid one says what is wrong ("Il manque le 6 de cœur pour faire la suite.", "Une suite se fait dans une seule couleur.") instead of blaming the order.
- The rule that a card taken from the discard pile cannot be thrown back was only a mouse tooltip; it is now said on the table.
- Accessibility pass on the table: melds you can add to are real buttons; the round result is a modal dialog that takes focus and makes the page behind it inert; the closed log/chat sheet leaves the tab order; cards, the stock and the discard are announced in French ("Dame de cœur", "Piocher dans le talon, 78 cartes"); the turn banner is a live region; designed focus rings, distinct from the gold selection ring on cards; a targeted `prefers-reduced-motion` mode.
- Contrast: the "À vous" turn banner and text on the felt use felt-calibrated colours (≥ 5:1), and error text is lifted to 5.7:1.
- The desktop page was 32 px wider than the window (the chat input's intrinsic width widened the side column) and auto-scrolled sideways when the log updated.
- A hovered card turned panel-green on desktop.
- A player who turned their camera off showed as a black tile to the others instead of their initials: a disabled track keeps sending black frames, so camera on/off is now sent to peers over the signalling relay (also on every new or rebuilt connection).
- The camera/microphone error was hidden on phones: the rule that hid it matched nothing else, so "Accès caméra/micro refusé" never appeared on the device where it happens most.
- Safe-area insets were inert without `viewport-fit=cover`, so the sticky action bar sat under the iPhone home indicator.
- The round-result overlay could be covered by the log/chat panel on phones.
- Native checkboxes, number inputs and scrollbars rendered in light mode on the dark table (`color-scheme`).

### Changed
- Phone (portrait): the whole table fits one screen — your hand, the piles and the next action are always in view without scrolling. One-row top bar (icons), your seat in the opponents' strip, one action row; "Poser" joins the bar while melds are staged.
- First laydown is guided: staged melds wait on the felt in a tray with a gauge toward 51 ("encore 11"), a pure-run marker, and "Poser" lighting up once the threshold is reached.
- Gold follows "yours, now": the piles are ringed while you must draw, Défausser and Poser turn gold only once usable, only melds that accept the selection light up, and other players' "posé" badge is neutral. The turn banner adds one line saying what you can do next.
- Card indices are French (V, D, R) on faces and in the log; "Trier A→R".
- Controls are tactile: raised buttons stand on a darker edge with a lit rim and sink flush when pressed (no layout shift); disabled ones lie flush. Ghost buttons, tabs and dismiss buttons stay flat. Control emoji (mic, camera, chat, close) are replaced by drawn SVG icons; checkboxes take the gold accent.
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

# Changelog

All notable changes to VisualRami. Format inspired by Keep a Changelog; versions follow SemVer.

## [Unreleased]

### Added
- Device-aware layout beyond the phone: a tablet-portrait tier (real card and opponent sizes instead of phone sizing), a landscape tier that moves opponents to a left rail and pins the game to the viewport so the hand never falls below the fold, and touch-sized controls on any coarse pointer regardless of viewport width.
- Presence at the table: losing your own connection shows a "Connexion perdue — reconnexion…" strip (a polite live region) and stills the piles, play buttons, chat and "Nouvelle manche" until the seat is back; nothing tapped offline is sent later. An absent player's tile reads "absent · sa place est gardée", a muted microphone shows a drawn glyph on that player's tile for everyone (sent over the same `media` signal as the camera), and pressing Quitter logs "X a quitté la table".
- End of round on the felt: the result is no longer a modal over a dark scrim but a panel on the table, so faces, log and chat stay usable for everyone. Every losing hand is revealed with its points ("×2 : pas posé" when doubled), the winner reads "0 (gagnant)" instead of "+0" and their tile carries "remporte la manche". The other players press "Prêt" and the host sees who is ready before dealing ("Nouvelle manche"). New `ready` action and `GameState.ready` field (older snapshots load without it); other players' hands reach the client only once the round is over.
- Quitter asks first: one press arms "Quitter la table ?" with Quitter / Rester, which disarms by itself after 5 s or on Escape.
- Product record (`PRODUCT.md`) and a UI technical audit (`docs/AUDIT_UI.md`).
- Design system record (`DESIGN.md`, with the `.impeccable/design.json` sidecar): tokens, layout tiers, elevation and component rules extracted from the shipped client.
- Public repository under the MIT license; landing page on lauriat.fr, listed on vincentlauriat.github.io and the GitHub profile.
- Games survive a server restart (`DATA_DIR/rooms.json`) and stay open 7 days; a player comes back with the table code and the same name, or with one click from the remembered seats on the home page.

### Fixed
- Phone seats: names lost their room to "(vous)" and "posé" ("Od… (vous)", then only "(vous) posé" after a laydown). The pill now holds the name alone (Bérangère, Jean-Pierre whole at 92px), "posé" is a corner chip opposite the mic pip, and your "(vous)" is read out but not shown in the strip. Seat text is 12px at least.
- Phone, five opponents: following the active seat scrolled your own seat off screen; it is now pinned at the head of the strip.
- Phone: "Défausser quand même" took three lines and made the action bar jump; it reads "Défausser ?" on phones (full words kept for screen readers) and the action buttons no longer wrap.
- Phone top bar: the round tag was clipped with a wide table code and an unread chat badge. The unread count now sits on the chat icon, the 🃏 mark leaves the in-game bar, and the bar holds at 360px.
- Round result (audit P1): the modal made the whole page inert for players who could only wait for the host, and dimmed every face. It is now a labelled region whose heading takes focus on appearance, with no focus trap and nothing inert; non-hosts can chat, open the log and say they are ready.
- Phone top bar: an unread chat badge folded the microphone and camera buttons into a column.
- A reconnection whose `room:rejoin` got no answer (the socket dropped again mid-request, or the 8 s timeout) threw the player back to the home page and forgot the remembered seat, as if the server had refused it. Only a real refusal ("Session invalide", "Salle introuvable") clears the seat now; no answer keeps it and asks again. Resuming from the home page keeps the seat the same way, and a `room:rejoin` from the socket that already holds the seat is now a refresh (it used to drop a lobby player).
- The browser's `offline` event now shows the connection loss at once, instead of after the ~45 s a half-open socket takes to notice.
- A tap made while the connection was down was buffered by Socket.IO and replayed on reconnect: an action when the link came back within 8 s (it then landed late, on a table the player had stopped watching), a chat message whenever it came back. Actions, chat and leave are now sent only while the seat is attached.
- Phone top bar wrapped to two rows when the table code was wide (e.g. "MUWVR"): the title now clips instead.
- Laptop with five opponents: the seat row wrapped to two lines and crushed the felt to 44px at 1280×720; seats now stay on one row sized by player count and the felt keeps at least 200px.
- Phone with 15 cards: the staging tray slid out of the felt. The tray now leads the felt, the piles shrink once you have drawn, and a 15-card hand fans into two rows of eight.
- Discarding while melds were staged silently threw the staging away with Défausser lit gold; it now stays neutral and asks for a second press ("Défausser quand même").
- Phone: the strip scrolls to the seat whose turn it is; names stay on one line with an ellipsis and your "(vous)" stays visible; icon buttons are 44px wide on touch screens; keyboard focus returns to the hand after adding to a meld.
- Before the first laydown, selecting a card that would fit a meld on the table now says so.
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
- The players sit around the felt on laptops: opponents take the left, top and right edges clockwise from your left in turn order, and each one's melds lie in front of their face instead of in one anonymous heap; yours sit above your hand. On phones and tablets the faces stay in the strip, the melds are grouped by player on the felt, and touching a face scrolls to that player's melds.
- Melds on the table fan like a closed hand, each card showing its index strip, so long runs take less room.
- A first laydown is a table event: the player's zone lights up with "1re pose · N pts" for everyone, and screen readers hear it.
- Between 901 and 1365px wide, the log and chat open as a drawer from the right, so the table gets the whole width.
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

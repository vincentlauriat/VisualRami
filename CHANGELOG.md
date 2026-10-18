# Changelog

All notable changes to VisualRami. Format inspired by Keep a Changelog; versions follow SemVer.

## [Unreleased]

### Added
- Presentation video on the home page: 25 seconds (1280×720, 0.8 MB) on what the game is: the players around the felt, a table code to join, 51 points for the first laydown, a game kept for 7 days, the computer taking a seat. It sits under the hero on wide screens and after the way in on a phone; `preload="none"` with a real frame as poster, so nothing is downloaded until play is pressed. Native controls, no autoplay, sound effects only (no music track). It replaces the static table capture (`client/public/table.webp`), whose frame is now in the video.
- Play against the computer. On the home page, "Seul ? Jouez contre l'ordinateur" creates a table with 1 to 3 computer players and starts it. In the lobby, the host can add computers ("Ajouter l'ordinateur", up to 6 seats) or remove them. A computer seat shows a drawn card back and an "ordi" tag, never a face or initials, and has no video, microphone or chat.
- The computer (easy level) plays on the server, from the public view of its seat only, one move at a time: about a second between moves, a beat more before the discard. Every move goes through the same rules as a human's. It pauses while no human is connected, picks up again after a server restart, and says it is ready for the next round by itself. It is never host, and nobody can take its seat by typing its name: names starting with "Ordi" are kept for computers.
- New socket events `room:addBot` and `room:removeBot`; `Player.isBot` and `level` (older snapshots load as humans).
- Computer player, phase 1 (`shared/src/bot/`, engine only: not playable at a table yet). Meld search over a hand (sets, runs with the ace low or high, jokers in gaps, the two decks' twin cards), best set of disjoint melds, first laydown at the room's threshold with a pure run and one card kept, extensions and joker swaps on the table, discard choice, and `planTurn(view)` for the easy level. The bot decides from `PublicGameState` alone. Unit, property (`fast-check`, new dev dependency of `shared`, on a fixed seed) and bot-versus-bot simulation tests: at 2 to 6 bots, 150 rounds at 51 points, 30 at 100 and 5 at 200 in CI, with no illegal action and the 108 cards checked after every action.
- Drawn round: the stock may be reshuffled 3 times in a round; a draw from the empty stock after that ends the round with no winner. Everyone counts their hand, doubled when they never laid down; the log reads "Talon épuisé 3 fois : manche nulle" and the end-of-round panel "Manche nulle : talon épuisé", with every hand shown. Rounds where nobody could go out (a first-laydown threshold of 120 or 200) used to go on forever. New `GameState.reshuffles`, reset at each deal; older snapshots (or an unreadable count) load with 0. The log counts the reshuffles ("… mélangée (2/3)"), the public view carries `reshufflesLeft`, and once the stock is empty with none left the stock warns before anyone draws: an Alerte ring and pill, "Piocher ici termine la manche (manche nulle)", never gold, repeated in the drawing player's turn hint.
- The first-laydown threshold of a new table is capped at 100 points: the form keeps it between 0 and 100 (an emptied field keeps the last valid value instead of sending 0) and the server brings a higher request down to 100. Tables saved with a higher threshold keep it; the reshuffle limit ends their rounds.
- `applyAction` takes an optional id source (`{ meldId }`), so simulations and replays are reproducible; the server's call is unchanged.
- Device-aware layout beyond the phone: a tablet-portrait tier (real card and opponent sizes instead of phone sizing), a landscape tier that moves opponents to a left rail and pins the game to the viewport so the hand never falls below the fold, and touch-sized controls on any coarse pointer regardless of viewport width.
- Presence at the table: losing your own connection shows a "Connexion perdue — reconnexion…" strip (a polite live region) and stills the piles, play buttons, chat and "Nouvelle manche" until the seat is back; nothing tapped offline is sent later. An absent player's tile reads "absent · sa place est gardée", a muted microphone shows a drawn glyph on that player's tile for everyone (sent over the same `media` signal as the camera), and pressing Quitter logs "X a quitté la table".
- End of round on the felt: the result is no longer a modal over a dark scrim but a panel on the table, so faces, log and chat stay usable for everyone. Every losing hand is revealed with its points ("×2 : pas posé" when doubled), the winner reads "0 (gagnant)" instead of "+0" and their tile carries "remporte la manche". The other players press "Prêt" and the host sees who is ready before dealing ("Nouvelle manche"). New `ready` action and `GameState.ready` field (older snapshots load without it); other players' hands reach the client only once the round is over.
- Arriving by an invitation link (`?table=CODE`) shows one card, "Rejoindre la table CODE", with the name field and one gold button ("Reprendre" when a seat is remembered for that table); creating another table is a discreet link below.
- Règles tab beside Journal and Chat at the table (drawer on laptops, sheet on phones): card values, the first laydown as this table plays it, joker, end of round and ×2, in short sentences shared with the home page.
- Live points on the selection: "3 cartes · 27 pts" above the hand, and before the first laydown "· encore 24 pour 51" for a real meld.
- Quitter asks first: one press arms "Quitter la table ?" with Quitter / Rester, which disarms by itself after 5 s or on Escape.
- Product record (`PRODUCT.md`) and a UI technical audit (`docs/AUDIT_UI.md`).
- Design system record (`DESIGN.md`, with the `.impeccable/design.json` sidecar): tokens, layout tiers, elevation and component rules extracted from the shipped client.
- Public repository under the MIT license; landing page on lauriat.fr, listed on vincentlauriat.github.io and the GitHub profile.
- Games survive a server restart (`DATA_DIR/rooms.json`) and stay open 7 days; a player comes back with the table code and the same name, or with one click from the remembered seats on the home page.

### Fixed
- End-of-hand trap: with every card in hand prepared, Poser was gold, the laydown failed with "Vous devez garder une carte à défausser", and the only way out was the tray's ×. Poser now stays neutral and disabled while no card would be left, the turn line says "Gardez une carte pour défausser : retirez-en une de la préparation", and touching a prepared card in the hand takes it back (its combination keeps the rest when they still form one). Client and server share the rule (`leavesACard`).
- The "1re pose · N pts" tag never went away once anyone played after the laydown: its 4 s timer was cancelled by every state update. It now fades after about 4 s.
- Phone: at rest, the fade beside your pinned seat covered the neighbour's name and card count ("ximilien", "rtes · 0 pts"); the strip now starts after the fade.
- Chat counts: the Chat tab counted every message and the button never fell back. One unread count (the others' messages since you last looked at the Chat tab) now drives the tab, the button, the phone bubble and its label, and drops to zero when you read.
- End of round: "Tout le monde est prêt · absent : Bruno" when the only guest was away now reads "Absent : Bruno"; an absent phone seat no longer piles "absent", "posé" and the initial on each other.
- "Poser sur la table" (desktop) and "Poser" (phone) are one label, shortened where it does not fit; seat counts read "1 carte".
- Desktop and laptop with two or three players: the piles stood at the far left and the turn line at the far right of an empty felt, 750–900px apart; they now sit together at its centre, as with side seats.
- At 1100px a 15-card hand left one card alone on a second row; from 15 cards the hand closes up and stays on one row (901–1365px).
- Phone landscape (844×390): the felt was 139px tall and "Aucune combinaison…" was cut off. Your face joins the left rail and the turn line sits beside the piles; the felt is 187px and the line shows.
- Lamp Rule: the armed discard ("Défausser ?" / "Défausser quand même") was gold next to a gold Poser; it is now a ghost with a danger outline, like the armed Quitter.
- Phone: the tile scrolling under your pinned seat showed sliced ("aximilien"); it now fades into the seat's edge.
- Reduced motion: the first-laydown gauge animated its width and kept moving under `prefers-reduced-motion`; it fills by `scaleX` and holds still.
- No emoji left: the joker's centre is a drawn jester's cap, and the 🃏 logo (home, lobby, top bar, favicon) is a drawn card mark.
- Log: "pose 1 combinaison(s)" is now "1 combinaison" / "2 combinaisons".
- The chat badge counted your own messages; it counts only the others'.
- Home and lobby: the background gradient repeated on a long page, leaving a seam (around 1270px on a phone); it is painted once, then plain.
- Lobby: "Copier le lien" is the main action (gold, unless the host can start) and stays on the code's line on a phone; each copy button confirms its own copy.
- Règles and Journal tabs no longer show the message field, which belongs to Chat.
- Rules: "figures et 10 : 10" (two colons) reads "figures et 10 valent 10".
- Top bar: the table and round tags had their text touching the pill; they have 4px above and below.
- The card you just drew is marked in your hand for the rest of the turn (a small green pip, and a short settle that reduced motion turns off); screen readers hear "piochée à l'instant".
- The home page had two equal gold buttons (Créer and Rejoindre, three with Reprendre); it now has one, the likely next step. Its hero line and rules ran 103–109 characters per line on a desktop; they now stay at about 70.
- A wrong code showed its error under "Votre prénom"; it now sits under the code field, or on the invitation card, as "Table introuvable : vérifiez le code". Server messages say "table" instead of "salle" ("Table introuvable", "Déjà à une table", "Pas à une table").
- Phone seats: names lost their room to "(vous)" and "posé" ("Od… (vous)", then only "(vous) posé" after a laydown). The pill now holds the name alone (Bérangère, Jean-Pierre whole at 92px), "posé" is a corner chip opposite the mic pip, and your "(vous)" is read out but not shown in the strip. Seat text is 12px at least.
- Phone, five opponents: following the active seat scrolled your own seat off screen; it is now pinned at the head of the strip.
- Phone: "Défausser quand même" took three lines and made the action bar jump; it reads "Défausser ?" on phones (full words kept for screen readers) and the action buttons no longer wrap.
- Phone top bar: the round tag was clipped with a wide table code and an unread chat badge. The unread count now sits on the chat icon, the 🃏 mark leaves the in-game bar, and the bar holds at 360px.
- Round result (audit P1): the modal made the whole page inert for players who could only wait for the host, and dimmed every face. It is now a labelled region whose heading takes focus on appearance, with no focus trap and nothing inert; non-hosts can chat, open the log and say they are ready.
- Phone top bar: an unread chat badge folded the microphone and camera buttons into a column.
- A reconnection whose `room:rejoin` got no answer (the socket dropped again mid-request, or the 8 s timeout) threw the player back to the home page and forgot the remembered seat, as if the server had refused it. Only a real refusal ("Session invalide", "Table introuvable") clears the seat now; no answer keeps it and asks again. Resuming from the home page keeps the seat the same way, and a `room:rejoin` from the socket that already holds the seat is now a refresh (it used to drop a lobby player).
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
- A table whose humans all left now pauses: the 45 s absence timer only plays for an absent player while another human is at the table. Before, a deserted table was played automatically turn after turn until the round was drawn.
- `room:create`, `room:addBot` and `room:removeBot` are rate-limited together (10 per 10 s per socket).
- Computer players are left out of the WebRTC mesh, so no connection is rebuilt every 8 s towards a seat with no socket. The search's plan cache holds 32 entries shared by all tables instead of one.
- Computer player search: each packing is visited once (twin cards no longer try the same laydown twice), branches that cannot leave less in hand or reach the threshold are pruned, the draw decision's plan is reused for the play phase, and each decision has a 25 ms time budget on top of the node ceiling. The reviewer's worst hands went from 180–600 ms to 1–3 ms per decision.
- `meldFit` (how a selection joins a meld on the table) moved from the client to `shared/src/rules.ts`, where the computer player reuses it; `client/src/lib/meldHelp.ts` re-exports it unchanged.
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

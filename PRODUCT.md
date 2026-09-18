# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — a dispersed circle of friends and family who already play Rami 51 together.**
They know the rules; what they lack is a table. They are in different places and want the evening
they used to have around one, not a rules engine. The table code travels hand to hand — a message,
a call — never through discovery inside the product.

**Secondary — a stranger who arrives cold**, from the public repository or the landing page, with
nobody to explain anything. The product is meant to become a real public one, so arrival must stand
on its own: a first-time visitor has to understand what this is, what Rami 51 is, and get into a
game without a spoken introduction.

**Third — a technical reader** evaluating the work: the running game is the demonstration. Code
legibility, documented decisions and a green CI are part of what is being shown, not incidental to it.

These three are not phases. They are simultaneous, and the tension between the first and the second
is the defining design problem of the product: zero friction for people who were invited, full
self-sufficiency for people who were not.

## Product Purpose

Play Rami 51 online, 2 to 6 players, seeing and hearing each other while playing. Nothing to
install, no account, no password: create a table, share a five-letter code, play.

Success is an evening that felt like the real thing — players talking over the game rather than at
an app, and nobody dropping out because something broke. A round that ends with everyone still at
the table is the measure.

## Positioning

**The video is the table, not a call running beside it.** Other online rummy exists, and video calls
exist; the combination normally means two apps and two windows, where you watch a grid of faces and
a board that do not know about each other. Here the faces sit around the board: whose turn it is,
how many cards they hold and whether they have laid down are readable from the person, not from a
separate panel. Game state and presence are one surface.

The mechanism a neighbouring product could not truthfully copy without rebuilding: game state is
authoritative on one server, while audio and video travel peer-to-peer in a full mesh that never
touches that server. Rules stay incorruptible; media stays private and cheap to run.

Secondary and real: **you can walk away and come back.** Tables survive a closed browser, a reload
and a server restart, for seven days. A game interrupted by real life is not a lost game.

## Operating Context

A table is arranged out of band — a message, a call — and joined with a five-letter code or a link.
Players are in different homes, on different networks, at the same time.

**Four usage scenes, all real and all supported:**

| Scene | What it constrains |
|---|---|
| Phone held in the hand | One thumb, 14 cards on a ~390 px screen, read at arm's length, variable brightness. The tightest case and the most common. |
| Laptop, 13–16" | The only scene where five opponents' video genuinely fits on screen. Mouse or trackpad. |
| Tablet, flat or propped | Touch at an intermediate size. Currently unaddressed: the single breakpoint is at 900 px. |
| Phone as the hand, next to another screen | Already on a video call or in front of a TV; the phone holds the cards. Built-in video becomes secondary and the hand becomes everything. |

Camera and microphone require HTTPS (or `localhost`), which constrains every deployment and every
LAN test. Peers behind symmetric NATs need a TURN relay; the configuration hook exists
(`VITE_TURN_*`) but no server is provisioned, so connectivity on restrictive networks is unproven.

## Capabilities and Constraints

**Rules, as implemented** (authoritative reference: `docs/GAME_RULES.md`): two 52-card decks plus 4
jokers; 14 cards each; draw from stock or discard, lay down, discard. Runs of 3+ same-suit cards
(ace low or high, never wrapping) and sets of 3–4 same-rank cards; jokers never outnumber real
cards. First laydown ≥ 51 points including a pure run, both room options. After laying down: extend
any meld on the table, take a joker back by playing the card it stands for. The round ends on a last
discard; the others count their hand (joker 20, ace 11, faces 10), doubled if they never laid down.
Lowest cumulative score wins.

**Technical constraints that shape product decisions:**

- One server instance, rooms in memory, snapshotted to `DATA_DIR/rooms.json`. No database. Scaling
  past one instance would require a Socket.IO adapter and a store — not planned.
- Room lifetime: empty lobbies 6 h, started games 7 days.
- Full-mesh WebRTC: each player holds *n − 1* peer connections. At six players that is five each,
  which is the practical ceiling of the architecture and the reason the cap is six.
- If the player whose turn it is stays disconnected 45 s, the server draws and discards for them.
  Host role moves to a connected player. A game never freezes on an absent person.
- Terminology is French and is the players' own: *talon*, *défausse*, *tierce franche*, *brelan*,
  *carré*, *poser*, *manche*. This vocabulary is product truth, not copy to be smoothed.

**Confirmed product decisions:**

- **Zero friction is core and must be preserved.** No account, no password, no sign-up — ever. A
  disconnected seat is recoverable with the table code and the same first name. This is a
  deliberately accepted trade: anyone holding both could take a seat. It stays.
- **Bilingual is a near-term structural constraint.** French is the reference language and stays so;
  English must be able to coexist soon. Practical consequence for all future interface work: stop
  hard-coding new French strings, and plan for an i18n layer before the next significant copy pass.
  What exists today is French-only with English leaking into a few machine-facing places — those are
  defects, not the beginning of i18n (see `docs/AUDIT_UI.md`, "English card labels").

**Explicitly undecided:**

- Whether the product ever gets in-product table discovery, or stays code-only. Public ambition
  points one way; zero friction points the other. Unresolved.
- Sound cues, spectator mode, per-round history, drag-and-drop hand reordering, an end-of-game
  target score: wanted, unscheduled (`docs/EXECUTION_PLAN.md`, Phase 7).
- Long-term hosting. Undecided and deliberately not recorded in this repository.

## Brand Commitments

- **Name: VisualRami.** Mark: 🃏, used as the logo in every header and as the favicon.
- **Interface language: French**, with the bilingual constraint above.
- **MIT, public repository**, `github.com/vincentlauriat/VisualRami`. Landing page at
  `lauriat.fr/outils/visualrami/`. The repository being readable and its CI green is part of what
  the product presents, because a technical reader is one of its audiences.
- **Documentation is English, the interface is French.** Deliberate split, already consistent
  across `README.md`, `ARCHITECTURE_EN.md` / `ARCHITECTURE.md` and `docs/`.
- **Hosting details stay out of this repository** — no deployment URLs, no infrastructure resource
  names, no employer reference, on any public surface.

## Evidence on Hand

**Real, verifiable:**

- Working v0.1.0: 2–6 players, WebRTC video/audio mesh, chat, session resume.
- 25 rule and reducer tests in `shared`, 5 Socket.IO integration tests in `server`; CI runs
  typecheck, tests and build on every push.
- `Scripts/probe-remote.mjs` — end-to-end WebSocket probe against a live deployment.
- An independent code review, 10 findings fixed and listed in `CHANGELOG.md`.
- A UI technical audit: `docs/AUDIT_UI.md` (2026-09-18, 12/20, 21 findings, contrast ratios
  computed rather than estimated).
- Full playthrough verified in Chrome across two tabs.

**Absences future work must not paper over:**

- **Video and audio have never been tested between two real devices.** Two browser tabs on one
  machine is not the same test. Every claim about call quality, six-way mesh behaviour or mobile
  camera handling is currently unproven.
- No TURN server exists, so behaviour on restrictive networks is unknown.
- **No real players have playtested the rules.** The 51 threshold, the pure-run requirement and the
  joker swap have never met anyone who did not write them.
- No usage numbers, no testimonials, no customers, no benchmarks. None of these may be invented.

## Product Principles

1. **The table comes before the app.** Every decision is judged by whether it makes the evening feel
   more like the one around a real table. If an interface element is not helping people play or talk
   to each other, it is in the way.
2. **Zero friction to join, permanently.** No account, no password, no install. Any future feature
   that would require identity has to justify itself against this, and the default answer is no.
3. **Invited or not, arrival works.** The circle that already knows the rules and the stranger who
   knows nothing must both get into a game. Anything readable only to someone who was briefed
   by phone is unfinished.
4. **A game interrupted is not a game lost.** Reconnection, seat recovery, absent-player handling
   and seven-day persistence are core product behaviour, not error handling.
5. **The phone is the real device.** The desk is where it is comfortable; the phone in one hand is
   where it is actually played. When the two conflict, the phone wins.

## Accessibility & Inclusion

No individual accessibility need is known in the current circle of players, so WCAG AA is the
quality floor rather than a response to a named person — and it is a floor the product does not yet
meet (`docs/AUDIT_UI.md`).

**The product-specific requirement is legibility in the real scenes above, and it outranks ARIA
semantics in priority order.** A player reads their hand at arm's length, on a phone, between two
turns, sometimes in bad light, while talking. Concretely, future interface work is judged on:

- card rank and suit readable at a glance at ~390 px, not merely present;
- touch targets sized for a thumb, not a cursor;
- turn state ("whose turn is it, what am I allowed to do now") legible without reading a sentence;
- contrast that holds against the table surface, not only against flat panels.

This ordering does not waive the accessibility work. It sequences it: legibility and target size
first, then keyboard operability and screen-reader semantics, which `docs/AUDIT_UI.md` lists with
severities.

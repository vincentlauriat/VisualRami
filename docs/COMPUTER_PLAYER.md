# Computer player — design

**Status:** Design accepted 2026-10-12 — not implemented yet.

## Summary

The bot runs **on the server**, as a full player in the room. It goes through the same `applyAction` as humans and only sees `toPublicState(state, botId)`. The rest of the architecture already fits: pure engine, JSON persistence and `seededRng`. What is really missing is **search intelligence**: the engine can *validate* a meld, it cannot *find* one. Four places in the server and client also assume that every player is a human with a socket and must be fixed. For v1 we ship two levels: "easy" (greedy) and "medium" (heuristics and discard-pile memory). Monte-Carlo comes later, and not on the B1.

---

## 1. Where the bot runs

| Option | Pros | Cons |
|---|---|---|
| **A. Server seat** (pseudo-player in the room) | One engine stays authoritative (`server/src/rooms.ts:188-196`). Persistence and resume come for free: the `GameState` is already serialised (`rooms.ts:240-259`). Works solo **and** to fill a table of friends. Cheating is impossible: the bot only receives the public view. | CPU on the shared B1: the cost per decision must be bounded. Needs a scheduler with timers. Touches 4 places that assume "player = human". |
| B. Client side (the host's browser drives the bot) | Zero server CPU. | The host's browser would need the bot's hand: information leak, or the server hands a private view to another client. If the host disconnects the bot dies, which contradicts principle 4 of `PRODUCT.md` ("An interrupted game is not a lost game"). |
| C. Offline solo, no server | The engine is pure and already imported client-side (`client/src/lib/meldHelp.ts` uses `analyzeMeld`). Works without a network. | Needs a second state adapter next to `useGame` (socket). No mixed friends + bot table. The 7-day resume becomes `localStorage`. A second code path to maintain. |

**Recommendation: A for v1.** C stays an option for later, if an offline PWA becomes a goal. The strategy module must live in `shared/` so that C remains possible without a rewrite.

**What to handle in the existing code (verified points)**

- **Video, endless rebuild loop.** `client/src/App.tsx:10` puts *every* player in `peerIds`. The client would create an `RTCPeerConnection` to the bot. The server drops the signal for lack of a target socket (`server/src/app.ts:278-279`). The connection stays in `new`, and the watchdog rebuilds it every 8 s forever (`client/src/lib/useWebRTC.ts:163-170`). Bots must be excluded from `peerIds`, which needs an `isBot` field in `PublicPlayer` (`shared/src/types.ts:69-76`).
- **What the bot's seat shows.** `VideoTile` already shows initials when there is no stream (`client/src/components/VideoTile.tsx:27-35`). Replace the initials with a drawn icon (from the `Icon.tsx` family) and a "computer" badge. See the UX note in section 4.
- **Host handover.** `setConnected` picks the first `connected` player (`shared/src/game.ts:68-71`). A bot could become host, and `start`/`newRound` would stay blocked. Bots must be excluded.
- **Taking a seat by first name.** `rooms.ts:116-134` lets anyone take a disconnected seat by typing its first name. A bot never has a socket (`rooms.ts:125`), so anyone could take the bot's seat by typing "Ordi". Forbid this case, or make it deliberately the "replace the bot" feature.
- **The absence timer and the value of `connected`.** `scheduleAbsentTurn` does nothing when `current.connected` is true (`app.ts:131`). On reload, everyone is marked disconnected (`rooms.ts:273`). A separate `BotScheduler` is needed, modelled on `absentTimers` (`app.ts:118-140`), with one timer per room. It must be re-armed on every `broadcast` and on restore.
- **Pause when no human is connected.** Otherwise, in solo, the bot plays, the absent human is auto-played every 45 s (`app.ts:22`), and the game runs with nobody there. Rule: the bot only plays while at least one human is connected.
- **Persistence.** If `isBot` and the difficulty live in `Player` (inside `GameState`), they are saved automatically. The medium bot's memory (seen cards) can go in `Room`. Otherwise we accept losing it on restart: the bot resumes from what is visible.
- **CPU on the B1.** Easy and medium cost under 5 ms per decision: a hand has at most 15 cards and the search stays exhaustive. That fits in the event loop. Monte-Carlo would block every table on the instance: it would need `worker_threads` and a time budget.

## 2. What the engine exposes, and what is missing

**What exists**
- Meld validation: `analyzeRun`/`analyzeSet`/`analyzeMeld` (`shared/src/rules.ts:24-88`). Ace low or high is handled, jokers never outnumber real cards, and points count a joker as the card it replaces.
- `arrangeMeld` (`rules.ts:96-128`) puts a selection back in order. Useful to turn a found run into a valid action.
- `checkFirstLaydown` (`rules.ts:141-173`) checks the 51-point threshold and the pure run.
- The full reducer: draw, `layDown`, `extend`, `swapJoker`, discard (`game.ts:217-373`). It forces keeping a card to discard (`game.ts:274`, `311`) and forbids re-discarding the card taken from the discard pile (`game.ts:358`).
- `autoPlayTurn` (`game.ts:79-95`) is a "zero bot": it draws from the stock and discards the last card.
- `seededRng` (`cards.ts:60`).

**What to add (new module `shared/src/bot/`)**
1. `enumerateMelds(hand)`: all candidate melds. Sets by rank, with distinct suits and jokers as fillers. Runs by suit, in contiguous windows, with jokers in the gaps and the ace at 1 or 14. With two decks, duplicate ids require de-duplicating by (rank, suit). This yields a few dozen to a few hundred candidates.
2. `bestPacking(candidates, objective)`: a set of disjoint melds that maximises an objective. The score is either "points laid down" or "points left in hand, minimised", under the constraint of keeping at least one card. A depth-first search with pruning over 15 cards takes a few milliseconds.
3. `findOpening(hand, options)`: the laydown that reaches at least `firstMeldMinPoints`, contains a pure run if `requirePureRun`, and leaves at least one card.
4. `findExtensions(hand, melds)` and `findJokerSwaps`: reuse the logic already in `client/src/lib/meldHelp.ts:23` and `game.ts:331-347`.
5. `chooseDiscard(hand, view, memory)`.
6. `planTurn(view, memory): GameAction[]`: a sequence of actions the server applies one by one.

**Details noted**
- The engine puts no restriction on taking from the discard pile (`game.ts:223-227`). Many house rules for Rami 51 impose one. The bot will exploit this; see the decisions section.
- `PublicGameState` only exposes `discardTop` (`types.ts:85`). The medium bot's memory must therefore be built by observing every broadcast state, not read from the state. This is fair: a human sees every discard go by.
- Meld ids depend on `Date.now()` and a module counter (`game.ts:18`, `278`). Legality is unaffected, but these ids must be neutralised for identical replays.
- Possible dead end: empty stock and a 1-card discard pile make `draw("stock")` fail (`game.ts:229-232`). Only taking from the discard pile is left. The bot must handle this fallback.

## 3. Strategy levels

| Level | Behaviour | Complexity | Cost per decision |
|---|---|---|---|
| **a. Easy** | Takes from the discard pile only if the card immediately completes a meld. Lays down as soon as a valid opening exists. Extends melds whenever possible. Discards the isolated card worth the most points. | ~300 lines plus tests (the bulk is the search in points 1 to 4) | < 2 ms |
| **b. Medium** | Evaluates the hand (melds + 2-card "near-runs" + pairs) rather than only the melds it could lay down. Keeps jokers. Delays the laydown if it would break a better potential. Remembers discards and opponents' pickups. Avoids discarding a card an opponent has shown interest in, or one that extends a meld on the table for the next player. Sheds its high cards when an opponent nears 0. | +200 to 300 lines, tuned by simulation | < 5 ms |
| c. Hard | Determinisation: sample N distributions of the unknown cards consistent with what was observed, play the game out with the "medium" policy, keep the move with the best average gain (simplified ISMCTS). | High: needs a fast round simulator and budget control | 100 ms to a few seconds. On the B1: `worker_threads` required, or client-side execution |

**Realistic for v1: easy and medium.** Hard adds little in a high-variance game like two-deck rummy, for a real infrastructure cost.

## 4. User experience

- **Start alone**: a "Play against the computer" button on Home. It creates the table, adds 1 to 3 bots, then starts the game. This is the frictionless path wanted by principle 2, and it also serves the visitor who arrives with no context and nobody to explain the game.
- **Fill a table**: in the lobby, an "Add a computer player" button reserved to the host, plus a remove control. This needs two new events, `room:addBot` and `room:removeBot`, validated in `server/src/validate.ts`. `addPlayer` already caps at 6 players (`game.ts:49`), and the "Start" button already accepts 1 human + 1 bot (`client/src/components/Lobby.tsx:82`).
- **Pacing**: a delay between each action, roughly 0.8 to 1.2 s, and 1.5 s before the discard. The server broadcasts after each step so that draw, laydown and discard are seen one after the other. Add a small random jitter so the bot does not look mechanical.
- **Log**: the current messages already suffice ("takes X from the discard pile", "lays down n meld(s)", "discards X", `game.ts:227-364`).
- **Identity**: reserved first names that cannot collide with a human (`normalizeName`, `rooms.ts:53`), a drawn icon and a "computer" badge on the seat. No chat.
- **Difficulty**: one setting per bot in the lobby, "easy" by default.
- **Fairness**: the decision function has the signature `(view: PublicGameState, memory) => GameAction[]`. It structurally cannot read `GameState`. Every action goes back through `rooms.act`, hence through the reducer. A test must check that it does not import `GameState`.

**UX note (from the concurrent UX critique)**
- A bot seat needs an honest identity: a drawn card-back avatar plus a "computer" badge, not initials imitating a person.
- Bot moves must be paced and visible (a log line, a discard animation) so that the long phase before the first laydown does not get emptier than it already is.

## 5. Test strategy

1. **Unit tests of the search** on constructed hands: opening at 51 with and without a pure run, jokers in gaps, ace high and low, refusal to lay down the whole hand, duplicate cards across the two decks.
2. **Property tests** (fast-check): every meld produced by `enumerateMelds` passes `analyzeMeld`. Every opening produced passes `checkFirstLaydown`. `planTurn` never produces an action the reducer rejects.
3. **Bot-versus-bot simulations** with a fixed seed (`seededRng`): 2 to 6 bots, thousands of rounds. Check 0 illegal actions, every round ending under a turn cap (to detect dead ends, including the "empty stock" case), and conservation of the 108 cards at every step. This fits in CI.
4. **Measurements**: medium must beat easy over N rounds (win rate, average score). This is the regression guard for tuning.
5. **Server integration**, modelled on `server/test/app.test.ts:170-183` with short delays: the bot plays, pauses when no human is connected, resumes after a restore, never becomes host, and its seat cannot be taken by its first name.

## 6. Phased plan

| Phase | Content | Size | Risks |
|---|---|---|---|
| **1. Meld search** (`shared/src/bot/`) | Points 1 to 6 of section 2, easy bot, unit and property tests, simulations | 2 to 3 d | Joker and ace edge cases; duplicates across the two decks |
| **2. Server integration** | `isBot` and `difficulty` in `Player` / `PublicPlayer`, `room:addBot` / `room:removeBot`, `BotScheduler`, exclusions (host, seat by first name), pause without humans, re-arm on restore, tests | 1.5 to 2 d | Races between timers and human actions: one timer per room, cancelled on every `broadcast` |
| **3. Client** | Solo button on Home, add and remove in the lobby, difficulty choice, seat without video, bots excluded from `peerIds`, strings ready for i18n (bilingual constraint of `PRODUCT.md`) | 1 to 2 d | Seat layout on phones |
| **4. Medium bot** | Potential evaluation, memory, defence against the next player, tuning by simulation | 2 to 3 d | Subjective tuning: plan a test game with real players |
| 5. Later | Hard level in `worker_threads` or client side; offline mode; replacing an absent human with a bot instead of the minimal `autoPlayTurn` | 1 to 2 weeks | B1 CPU; second code path |

Total for v1 (phases 1 to 4): about 7 to 10 days.

## 7. Decisions (2026-10-12)

The product owner decided:

1. **Solo entry: both places.** "Play against the computer" on Home, and "Add a computer player" in the lobby (host only).
2. **Bots may fill seats at a table with friends: yes.**
3. **When the last human leaves: the bot pauses.** It only plays while at least one human is connected.
4. **Taking from the discard pile: stays free in v1** (current engine behaviour). The house rule must be settled before the medium bot is tuned, because it changes its strategy. It also belongs in the test game with real players.
5. **Levels at release: easy and medium, easy by default.** Hard waits for a stated need.

## References

- `shared/src/rules.ts`: meld validation, `arrangeMeld`, `checkFirstLaydown`
- `shared/src/game.ts`: reducer, `autoPlayTurn`, host handover (68-71), non-deterministic ids (18, 278)
- `shared/src/types.ts`: `Player` and `PublicPlayer`, where to add `isBot`; `discardTop` only
- `server/src/rooms.ts`: seat taken by first name (116-134), persistence (240-286)
- `server/src/app.ts`: absence timer (118-140), RTC relay (272-281)
- `client/src/App.tsx:10` and `client/src/lib/useWebRTC.ts:163-170`: the rebuild loop towards a peer with no socket
- `client/src/components/VideoTile.tsx`: initials display already available for the bot's seat

# Computer player — design

**Status:** Design accepted 2026-10-12. Phase 1 (meld search and easy level, `shared/src/bot/`) done 2026-10-13, see [Phase 1 as built](#phase-1-as-built-2026-10-13); phases 2 to 4 not started.

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
| **1. Meld search** (`shared/src/bot/`) — **done 2026-10-13** | Points 1 to 6 of section 2, easy bot, unit and property tests, simulations | 2 to 3 d | Joker and ace edge cases; duplicates across the two decks |
| **2. Server integration** | `isBot` and `difficulty` in `Player` / `PublicPlayer`, `room:addBot` / `room:removeBot`, `BotScheduler`, exclusions (host, seat by first name), pause without humans, re-arm on restore, tests | 1.5 to 2 d | Races between timers and human actions: one timer per room, cancelled on every `broadcast` |
| **3. Client** | Solo button on Home, add and remove in the lobby, difficulty choice, seat without video, bots excluded from `peerIds`, strings ready for i18n (bilingual constraint of `PRODUCT.md`) | 1 to 2 d | Seat layout on phones |
| **4. Medium bot** | Potential evaluation, memory, defence against the next player, tuning by simulation | 2 to 3 d | Subjective tuning: plan a test game with real players |
| 5. Later | Hard level in `worker_threads` or client side; offline mode; replacing an absent human with a bot instead of the minimal `autoPlayTurn` | 1 to 2 weeks | B1 CPU; second code path |

Total for v1 (phases 1 to 4): about 7 to 10 days.

## Phase 1 as built (2026-10-13)

**Modules** (`shared/src/bot/`, exported from `@visualrami/shared`)

| File | Content |
|---|---|
| `melds.ts` | `enumerateMelds(hand)`: sets of distinct suits, same-suit runs with the ace low (1..13) or high (2..14), jokers in gaps, at the ends, or standing in for a card the hand holds. One candidate per multiset of cards, under its best-scoring reading. `analyzeMeld` is the final judge of every candidate. |
| `packing.ts` | `bestPacking(hand, score)`: depth-first search over card **keys and counts** (suit and rank, or joker), not ids, so the two copies of a card can sit in two different melds. Each packing is visited once (the first key left is either kept in hand or covered by a meld containing it), with a ceiling of 200,000 nodes. `findOpening(hand, rules)` (threshold, pure run, one card kept, then re-checked with `checkFirstLaydown`) and `findLaydown(hand)` once opened. The objective is to minimise the points left in hand. |
| `table.ts` | `findExtensions`, `findJokerSwaps`, `swapResult`. They reuse `meldFit`, moved from `client/src/lib/meldHelp.ts` into `shared/src/rules.ts` (the client re-exports it). `swapResult` mirrors the reducer: the card replaces the first joker it can stand for. |
| `discard.ts` | `chooseDiscard(hand, drewFromDiscardCardId)`. Priorities: jokers go last, then cards of the hand's best melds, then cards with a neighbour (a pair, or a same-suit card at most two ranks away, ace counted both ways). Among what is left, the card worth the most points goes first. The card taken from the discard pile never goes back, unless it is the last one. |
| `plan.ts` | `planPlay(context)` and `planTurn: BotPolicy`, typed `(view: PublicGameState, memory?: BotMemory) => GameAction[]`. |

**Design precisions and deviations**
- **A turn takes two calls to `planTurn`, not one.** The card drawn from the stock is unknown before the draw. So the plan covers the current phase only. In `draw` it returns `[draw]`. In `play`, on the view after the draw, it returns `[layDown?, extend*, swapJoker*, layDown*, …, discard]`. The caller applies the actions one by one and calls again while it is the bot's turn. This fits the server pacing of phase 2 (a broadcast after each action). Outside its turn the plan is empty.
- **The play phase is simulated on a local copy** of the hand and the table melds, so every step is checked as the engine will see it. A swapped joker returns to the hand and can be laid down or extended later in the same plan. Melds laid this turn get their ids from the engine, so the plan never extends them. That is not a loss: the packing already puts every card that fits them into the laydown.
- **Easy level, as specified, made precise.** The discard pile's top is taken only when replaying the play phase with that card in hand puts it on the table this very turn: in an opening that reaches the threshold, a later laydown, or an extension. Otherwise it would stay stuck in hand, since it cannot be discarded again. The bot opens as soon as a valid opening exists, then lays, extends (jokers included) and takes jokers back while anything fits.
- **Empty stock and a 1-card discard pile**: the bot takes that card before any other rule applies. In 300 simulated rounds this case never arose naturally (the discard pile has always grown by the time the stock runs out). A unit test builds it on purpose. The engine still has no rule to end a round where everyone keeps passing that single card around. No bot triggered it, but it remains an engine gap.
- **Deterministic ids**: `applyAction(state, playerId, action, rng, ids?)` takes an optional `{ meldId: () => string }`. Without it the ids stay `m<counter>-<time>`, and the server call (`rooms.ts:190`) is unchanged. A test replays a 4-bot game of 5 rounds twice from one seed and compares the final states.
- **Fairness**: enforced by the `BotPolicy` type, and by a test that reads the sources of `shared/src/bot/`. It fails on any mention of `GameState` (other than `PublicGameState`), on an import of `../game.js`, and on `applyAction` or `toPublicState`. A type-level test was ruled out: `shared/tsconfig.json` does not cover `test/`, and vitest does not typecheck. A second test feeds a deep-frozen view to check that the bot does not mutate it.
- `BotMemory` is `Readonly<Record<string, unknown>>` for now. The easy level ignores it, and the medium level will define it.

**Tests** (`shared/test/`)
- `bot.search.test.ts` (16): sets of distinct suits, a joker in a gap or at an end, ace low and high, never both, jokers never outnumbering real cards, twin cards de-duplicated. Opening at 51 with and without a pure run, below the threshold, with a joker, with a high ace, refusal to lay the whole hand, both twins in two runs. Extensions, joker swap, discard.
- `bot.play.test.ts` (11): fairness (3); forced draw from the discard pile; when to take the discard; a full turn (open, take a joker back with the last real card, go out on the joker); and five `fast-check` properties. Every meld found is valid and made of the hand's cards. No meld of 3 to 5 cards is missed (brute-force check over subsets). Every opening passes `checkFirstLaydown` and keeps a card. A bot turn on a random hand and table (jokers and both twins in a dense pool) is accepted by the reducer, with the 108 cards conserved. Full rounds from random seeds at 2 to 6 bots have no illegal action.
- `bot.sim.test.ts` (6): for each table size from 2 to 6 bots, 12 games of 5 rounds (`newRound` included), plus the replay test. A round over 600 turns fails with a dump of the piles and hands.
- `game.test.ts` (+1): the injected id source.
- Mutation check: swapping `start` and `end` in the extensions makes 9 of these tests fail.

**Measurements** (Apple Silicon, `vitest`, not asserted)

| Bots | Rounds | Turns per round (mean, max) | Mean decision |
|---|---|---|---|
| 2 | 60 | 21.2, 51 | 0.20 ms |
| 3 | 60 | 21.5, 43 | 0.20 ms |
| 4 | 60 | 22.0, 74 | 0.20 ms |
| 5 | 60 | 25.9, 57 | 0.21 ms |
| 6 | 60 | 27.0, 56 | 0.28 ms |

- A longer local run of 1,000 rounds (200 per table size) also had 0 illegal actions. Every round ended, the longest after 89 turns.
- Slowest single decision: 3 to 6 ms when the bot test files run alone, about 70 ms once under the parallel load of the full `npm test` (cause not measured).
- The "< 2 ms" estimate of section 3 for the easy level holds on average (0.2 ms), not in the worst case (5 ms on a dense hand). Nothing was measured on the B1.
- On dense 14 to 15 card hands (aces, faces, low cards, 4 jokers): 1 ms on average, 5 ms at worst. A hand never exceeds 15 cards in play. The search grows quickly beyond that (about 180 ms for 20 cards), hence the node ceiling.

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

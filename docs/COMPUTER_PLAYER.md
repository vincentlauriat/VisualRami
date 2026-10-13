# Computer player — design

**Status:** Design accepted 2026-10-12. Phase 1 (meld search and easy level, `shared/src/bot/`) done 2026-10-13, see [Phase 1 as built](#phase-1-as-built-2026-10-13); phases 2 (server) and 3 (client) done 2026-10-13, see [Phases 2 and 3 as built](#phases-2-and-3-as-built-2026-10-13); phase 4 (medium level) not started.

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
- **CPU on the B1.** Easy and medium should cost a few milliseconds per decision: a hand has at most 15 cards. Measured for easy on Apple Silicon (2026-10-13): 0.2 ms on average, about 10 ms on the worst constructed hands, and a 25 ms budget per decision as a ceiling. That fits in the event loop. Monte-Carlo would block every table on the instance: it would need `worker_threads` and a time budget.

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
- ~~Possible dead end: empty stock and a 1-card discard pile make `draw("stock")` fail.~~ *Wrong, corrected 2026-10-13:* that state cannot be reached at a draw. Every turn ends on a discard, so when the stock runs out the discard pile holds at least two cards, and a reshuffle leaves one that the same turn's discard brings back to two. The real endless round came from a first-laydown threshold nobody could reach: at 200 points, 20 rounds out of 20 never ended in the reviewer's simulation; at 120, 4 out of 20. See [the two rules](#rounds-that-cannot-end-2026-10-13).

## 3. Strategy levels

| Level | Behaviour | Complexity | Cost per decision |
|---|---|---|---|
| **a. Easy** | Takes from the discard pile only if the card immediately completes a meld. Lays down as soon as a valid opening exists. Extends melds whenever possible. Discards the isolated card worth the most points. | ~300 lines plus tests (the bulk is the search in points 1 to 4) | < 2 ms on average (measured 0.2 ms); about 10 ms at worst, 25 ms budget |
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
| **2. Server integration** — **done 2026-10-13** | `isBot` and `difficulty` in `Player` / `PublicPlayer`, `room:addBot` / `room:removeBot`, `BotScheduler`, exclusions (host, seat by first name), pause without humans, re-arm on restore, tests | 1.5 to 2 d | Races between timers and human actions: one timer per room, cancelled on every `broadcast` |
| **3. Client** — **done 2026-10-13** | Solo button on Home, add and remove in the lobby, difficulty choice, seat without video, bots excluded from `peerIds`, strings ready for i18n (bilingual constraint of `PRODUCT.md`) | 1 to 2 d | Seat layout on phones |
| **4. Medium bot** | Potential evaluation, memory, defence against the next player, tuning by simulation | 2 to 3 d | Subjective tuning: plan a test game with real players |
| 5. Later | Hard level in `worker_threads` or client side; offline mode; replacing an absent human with a bot instead of the minimal `autoPlayTurn` | 1 to 2 weeks | B1 CPU; second code path |

Total for v1 (phases 1 to 4): about 7 to 10 days.

## Phase 1 as built (2026-10-13)

**Modules** (`shared/src/bot/`, exported from `@visualrami/shared`)

| File | Content |
|---|---|
| `melds.ts` | `enumerateMelds(hand)`: sets of distinct suits, same-suit runs with the ace low (1..13) or high (2..14), jokers in gaps, at the ends, or standing in for a card the hand holds. One candidate per multiset of cards, under its best-scoring reading. `analyzeMeld` is the final judge of every candidate. |
| `packing.ts` | `bestPackings(hand, goals, { budget })`: one depth-first search over card **keys and counts** (suit and rank, or joker), not ids, so the two copies of a card can sit in two different melds, serving several goals at once (opening, laydown, the discard's "best melds"). Every goal minimises the points left in hand, then the cards left; `accept` filters complete packings. Each packing is visited exactly once: the first key left either goes into a meld containing it, taken in non-decreasing list order, or stays in hand with all its remaining copies. Branch-and-bound prunes a branch once it leaves more in hand than the best accepted packing of every goal (counting the card a laydown must keep), or once the threshold is out of reach (cards counted at their highest meld value, ace and joker 11). Ceiling of 100,000 nodes, plus a time budget. `findOpening` re-checks its result with `checkFirstLaydown`. |
| `table.ts` | `findExtensions`, `findJokerSwaps`, `swapResult`. They reuse `meldFit`, moved from `client/src/lib/meldHelp.ts` into `shared/src/rules.ts` (the client re-exports it). `swapResult` mirrors the reducer: the card replaces the first joker it can stand for. |
| `discard.ts` | `chooseDiscard(hand, drewFromDiscardCardId)`. Priorities: jokers go last, then cards of the hand's best melds, then cards with a neighbour (a pair, or a same-suit card at most two ranks away, ace counted both ways). Among what is left, the card worth the most points goes first. The card taken from the discard pile never goes back, unless it is the last one. |
| `plan.ts` | `planPlay(context, budget)` and `planTurn(view, memory?, options?)`, a `BotPolicy` (`(view: PublicGameState, memory?: BotMemory) => GameAction[]`) with an optional time budget (`budgetMs`, 25 ms by default, `Infinity` for replays). |

**Design precisions and deviations**
- **A turn takes two calls to `planTurn`, not one.** The card drawn from the stock is unknown before the draw. So the plan covers the current phase only. In `draw` it returns `[draw]`. In `play`, on the view after the draw, it returns `[layDown?, extend*, swapJoker*, layDown*, …, discard]`. The caller applies the actions one by one and calls again while it is the bot's turn. This fits the server pacing of phase 2 (a broadcast after each action). Outside its turn the plan is empty.
- **The play phase is simulated on a local copy** of the hand and the table melds, so every step is checked as the engine will see it. A swapped joker returns to the hand and can be laid down or extended later in the same plan. Melds laid this turn get their ids from the engine, so the plan never extends them. That is not a loss: the packing already puts every card that fits them into the laydown.
- **Easy level, as specified, made precise.** The discard pile's top is taken only when replaying the play phase with that card in hand puts it on the table this very turn: in an opening that reaches the threshold, a later laydown, or an extension. Otherwise it would stay stuck in hand, since it cannot be discarded again. The bot opens as soon as a valid opening exists, then lays, extends (jokers included) and takes jokers back while anything fits.
- **No special draw rule.** Phase 1 shipped one ("take the discard pile's only card when the stock is empty") for a state that cannot occur; it is gone. The simulation harness keeps a defensive check that fails on a draw with nothing to draw.
- **One time budget per decision**, shared by every search of that decision, including the draw decision's replay of the play phase. Once it is spent, the searches still to run return nothing at once: the bot then lays nothing more this turn and discards, which is always legal. A plan cut short is not cached.
- **The draw decision's plan is reused.** Deciding whether to take the discard pile's top plans the play phase with that card at the end of the hand, which is exactly what the engine does when the bot takes it. The next call finds that plan in a one-entry cache. The key covers everything `planPlay` reads: the hand in order, each table meld's id, kind and cards, the opening state, the card taken and the options. Callers get a deep copy of the cached actions.
- **A draw decision cut short by the budget draws from the stock.** A partial plan may be wrong about whether the discard pile's top goes on the table, and that card cannot be discarded again. Every search also checks the deadline when it starts, so a budget of 0 really stops it.
- **Deterministic ids**: `applyAction(state, playerId, action, rng, ids?)` takes an optional `{ meldId: () => string }`. Without it the ids stay `m<counter>-<time>`, and the server call (`rooms.ts:190`) is unchanged. A test replays a 4-bot game of 5 rounds twice from one seed and compares the final states.
- **Fairness**: enforced by the `BotPolicy` type, and by a test that reads the sources of `shared/src/bot/`. It fails on any mention of `GameState` (other than `PublicGameState`), on an import of `../game.js`, and on `applyAction` or `toPublicState`. A type-level test was ruled out: `shared/tsconfig.json` does not cover `test/`, and vitest does not typecheck. A second test feeds a deep-frozen view to check that the bot does not mutate it.
- `BotMemory` is `Readonly<Record<string, unknown>>` for now. The easy level ignores it, and the medium level will define it.

**Tests** (`shared/test/`, updated 2026-10-13)
- `bot.search.test.ts` (20): sets of distinct suits, a joker in a gap or at an end, ace low and high, never both, jokers never outnumbering real cards, twin cards de-duplicated. Opening at 51 with and without a pure run, below the threshold, with a joker, with a high ace, refusal to lay the whole hand, both twins in two runs. Extensions, joker swap, discard. The packing search:
  - every packing is visited once, on the reviewer's two slow hands (pruning off, every leaf compared);
  - a fast-check property compares the best packing of three goals with an exhaustive search without pruning, the algorithm as first written;
  - the slow hands return within 100 ms (measured 1 to 3 ms);
  - an exhausted budget still gives a legal answer.
- `bot.play.test.ts` (11): fairness (3); the bot's draw that ends a drawn round; when to take the discard; a full turn (open, take a joker back with the last real card, go out on the joker); five fast-check properties (every meld valid, none missed, every opening valid, a bot turn on a random hand and table accepted by the reducer with the 108 cards conserved, full rounds from random seeds legal).
- Generators draw hands from a dense pool (aces, faces, low cards, jokers), from a random window of five ranks in all four suits, or from the whole deck.
- **fast-check runs on a fixed seed** (`test/fcSeed.ts`). CI gates merges, so a red build must be reproducible and never a roll of the dice on an unrelated change. To explore, run locally with `FC_SEED=<n>` and a larger `numRuns`; fast-check prints the seed and path of any counterexample.
- `bot.sim.test.ts` (17): for each table size from 2 to 6 bots:
  - 6 games of 5 rounds at 51 points;
  - 3 games of 2 rounds at 100 points (the cap);
  - one round at 200 points (tables saved before the cap).

  Plus the replay test, without a time budget, and a test with no budget at all, where every search stops at once and the bot stays legal.
- Two error classes: `IllegalAction` (a refused action, an empty plan, a turn that does not end) and `TurnLimitExceeded` (a round past 1,000 turns, well above the longest measured: 317).
- Mutation checks:
  - swapping `start` and `end` in the extensions fails 9 tests;
  - over-pruning the bound fails the exhaustive comparison;
  - dropping the non-decreasing candidate order fails the visited-once test.

**Measurements** (Apple Silicon, not asserted)

The reviewer's slow hands, per call, before and after the 2026-10-13 rework:

| Hand | Threshold | Before: laydown search | Before: draw / play decision | After: laydown search | After: draw / play decision |
|---|---|---|---|---|---|
| H1: ♥9-10-J-Q-K-A, ♥10-J-Q twice, Q♠ Q♣, 4 jokers | 51 | 180 ms | 183 / 184 ms | 2 ms | 3 / 2 ms |
| H1 | 120 | | 179 / 180 ms | | 2 / 2 ms |
| H1 | 200 | | 361 / 355 ms | | 2 / 2 ms |
| H2: ♥9 to K twice, A♥, 4 jokers | 51 | 297 ms | 296 / 297 ms | 1 ms | 1 / 1 ms |
| H2 | 120 | | 296 / 293 ms | | 1 / 1 ms |
| H2 | 200 | | 595 / 599 ms | | 1 / 1 ms |

- **Visited once.** Packings visited for H1 went from 25,936 to 14,137, the number of distinct packings. H2 has 18,022 distinct packings.
- **Random dense hands**: 2,000 per pool and threshold (51, 100, 120), draw and play decisions. Pools: faces and aces, hearts and spades from 8 up, low cards, whole deck.
  - Worst 1.6 to 9.6 ms, mean 0.2 to 0.7 ms, no budget hit, in three runs.
  - One earlier run showed one 160 ms decision with 3 budget hits; it did not reproduce on the same sequence, and its cause is not established. The likeliest one, not verified, is a pause of the whole process (the machine was shared with other jobs), which the budget cannot interrupt.
- **Reviewer's simulation** (`sim.mjs`):

  | Run | Rounds | Never ended (before / after) | Slowest decision after | Longest round after |
  |---|---|---|---|---|
  | 51 points | 600 | 0 / 0 | 9.4 ms | 99 turns |
  | 120 points | 20 | 4 / 0 | 7.1 ms | 317 turns |
  | 200 points | 20 | 20 / 0 | 6.9 ms | 317 turns, all drawn |

  Before, the slowest decision took 320 to 640 ms.
- **CI simulations** (final full `npm test`):

  | Threshold | Rounds | Turns per round (mean, max) | Mean decision | Slowest | Drawn rounds | Budget hits |
  |---|---|---|---|---|---|---|
  | 51 | 150 | 19.8 to 28.7, max 56 | 0.16 to 0.29 ms | 7.9 ms | 0 | 0 |
  | 100 | 30 | 34.8 to 86.5, max 317 | 0.20 to 0.86 ms | 7.4 ms | 1 | 0 |
  | 200 | 5 | 93 to 317 | 0.29 to 1.35 ms | 11.5 ms | 5 (all) | 0 |

  The run before the out-of-time early exit was added did hit the budget under the parallel load of the full suite: 11 hits at 2 bots and 2 at 3 bots, both at 200 points, with decisions up to 52 ms.
- The "< 2 ms" estimate of section 3 holds on average (0.2 ms). In the worst case on constructed hands it does not: up to about 10 ms, 25 ms by budget. Nothing was measured on the B1.
- **Client bundle**: `client/dist/assets/index-*.js` is 318,644 bytes with and without the bot exported from `@visualrami/shared`, under the same content hash. Tree-shaking removes it, so no `@visualrami/shared/bot` subpath is needed.

## Rounds that cannot end (2026-10-13)

Decision of the product owner: both rules.

1. **The first-laydown threshold of a new table is capped at 100 points.** The form stops at 100. The server (`sanitizeOptions`, `server/src/validate.ts`) brings a higher request down to 100 rather than ignoring it. A table saved with a higher threshold loads unchanged.
2. **A round is drawn after 3 reshuffles.**
   - `GameState.reshuffles` counts the reshuffles of the stock. It is reset at each deal, and a snapshot without it loads as 0.
   - A draw from the empty stock once 3 reshuffles have taken place ends the round: no winner (`winnerId: null` in phase `finished`), everyone counts their hand with ×2 for those who never laid down, every hand is revealed.
   - The log reads "Talon épuisé 3 fois : manche nulle", and the panel "Manche nulle : talon épuisé".
   - `autoPlayTurn` returns that finished state.
   - The bot needs nothing special: its draw ends the round, and its next plan is empty.

## Phases 2 and 3 as built (2026-10-13)

**Model** (`shared`)
- `Player.isBot?` and `level?` (persisted; absent in older snapshots, read as a human). `PublicPlayer.isBot` and `level?`. `BotLevel` moved to `types.ts`, "easy" only.
- `addBot` and `removeBot` (lobby only, 6 seats at most).
- A computer player has no socket and is **always `connected: true`**, restores included. The host role never goes to it: `setConnected` and the lobby's `removePlayer` both skip bots. A table with only computers connected keeps its absent human as host.

**Server**
- **Socket events.** `room:addBot { level? }` (host only, lobby, "easy" by default) and `room:removeBot { playerId }`, both validated in `validate.ts` and acknowledged with `{ ok }` or `{ error }`.
- **Names.** "Ordi Trèfle", "Ordi Carreau", "Ordi Cœur", "Ordi Pique", "Ordi Joker"; the first free one is given.
  - A new human seat cannot take a name whose first word is "Ordi" or "Ordinateur" (`isReservedName`). Case, accents and format characters (a zero-width space) are ignored, the first word ends at a space, dash, underscore, dot or apostrophe, and a leading 0 reads as an O. Other digit look-alikes are not chased: the "ordi" tag on a real computer's seat stays the honest signal.
  - Taking a seat back by name only ever matches a human seat, so a computer's name finds nothing and is refused. A human seat saved with such a name before the rule existed can still be taken back by it.
- **`BotScheduler`** (`server/src/botScheduler.ts`), one timer per table (revised after review, 2026-10-13):
  - **A broadcast only re-arms the timer**, which is cheap: no search happens there. The move is planned when the timer fires, on the table as it is then, from `toPublicState(state, botId)` only (the fallback move too). Restored tables stay paused until a human comes back; there is no start-up loop.
  - **Stale plans.** Planning at fire time removed the stale-plan question for every move but one: the discard. It waits a beat more after being planned, so its second timer keeps the guard. The planned discard is applied only if `room.state` is still the same object, otherwise it is dropped, and the broadcast that changed the table has already re-armed the timer.
  - **One action per firing**, through `applyAction` via `rooms.act`, then a broadcast.
  - **Pace**: 0.8 to 1.2 s before each action, 1.5 s (±15%) in all before the discard, 1.2 s before a computer says it is ready for the next round. The pace, the randomness and the planner are injectable.
  - **Pause**: no move while no human is at the table (`hasHumanPresent`: a human with a socket attached).
  - **Failures never reach the broadcast.**
    - A planner that throws falls back to the plainest move: draw from the stock, or discard a card that may go back.
    - A refused move falls back to that plainest move, then to `playBotLastResort`: `autoPlayTurn` with no log line, since "est absent" would be false for a computer.
    - If nothing could be played, the server logs it and tries again after 2 s, 4 s, … up to 30 s.
  - **`stop()`** marks the scheduler stopped, so a later `schedule` does nothing. It is called on shutdown and in tests.
- **Absence**: the absence timer and `autoPlayIfAbsent` never play for a computer. *Changed in review:* the absence timer also waits for a human at the table, at every table. A table whose humans all left now pauses instead of being played automatically, turn after turn, until the round is drawn ("an interrupted game is not a lost game", `PRODUCT.md`).
- **Rate limit**: `room:create`, `room:addBot` and `room:removeBot` share a limit of 10 requests per 10 s per socket ("Trop de demandes : réessayez dans quelques secondes").
- **Plan cache**: the one-entry cache became a 32-entry LRU (`LruCache`, a read counts as a use), shared by every table of the process, rather than one Map per seat. `planPlay` is pure in its inputs and the key covers everything it reads, so sharing cannot change a decision. Only the hit rate mattered: bots at several tables, playing in turn, must not evict each other's plan between their draw and their play.

**Client**
- **Home**: a "Seul ? Jouez contre l'ordinateur" panel below Create and Join.
  - A choice of 1, 2 or 3 computers (pills, 1 by default, the chosen one outlined, never gold) and a neutral "Jouer contre l'ordinateur" button. It uses the rules set in the Create panel.
  - `useGame.playSolo` creates the table, seats the computers one acknowledgement at a time, then starts. A failure after the table exists leaves the player in its lobby with the error.
- **Lobby**: the host has a neutral "Ajouter l'ordinateur" (hidden at 6 seats) and a × on each computer's row ("Retirer Ordi Trèfle"). "Lancer la partie" keeps the lamp and accepts 1 human + 1 computer. While alone, the hint reads "Invitez un ami avec le lien, ou ajoutez l'ordinateur."
- **Computer seat** (`VideoTile bot`):
  - A drawn card back (the `bot` glyph of `Icon.tsx`) in the card-back blue, never initials. No `<video>`, no microphone pip, never "absent".
  - On the seat, the name without its "Ordi" prefix ("Trèfle") followed by an "ordi" tag. The full name is read out with ", ordinateur".
  - The player list shows the glyph and an "ordi" tag.
- **WebRTC**: `mediaPeers` leaves computers out of `peerIds`, which ends the 8 s rebuild loop towards a peer with no socket.
- **Log**: the existing lines read naturally ("Ordi Trèfle pioche une carte", "Ordi Trèfle pose 3 combinaisons", "Ordi Trèfle défausse R♦").
- **Accessibility**: the turn line read by the polite live region says "Tour d'Ordi Trèfle, l'ordinateur", once per turn; the computer's three or four moves do not each speak.

**Checks** (2026-10-13)
- Server tests (`server/test/bots.test.ts`):
  - adding and removing a computer;
  - whole turns, and a human + computer round to its end;
  - pause without a human, then resume;
  - resume after a restart;
  - never host, seat refused by name;
  - a stale plan is not applied.
- Browser run: system Chrome driven by `playwright-core` 1.58.2 from the local npx cache, fake media, server on port 3100 with a scratch `DATA_DIR`.
  - **Solo games to the end of a round**: one computer on a 1440px desktop, two on a 390px phone.
  - **Lobby**: two humans and one computer.
  - **Server restart mid-game**: the table reconnects and the computer plays on.
  - **No rebuild loop**: 0 `RTCPeerConnection` in solo; 1, stable over 20 s, at the table with two humans.
  - **Console**: no error beyond the socket refusals during the restart.

**Compatibility limits**
- **Old client bundle**: a client opened before this release, and not reloaded, does not know `isBot`. It puts the computers in its WebRTC mesh and rebuilds those connections every 8 s, until the page is reloaded. The game itself works.
- **Server rollback**: a server rolled back to an earlier release would read the computers as humans. They have no socket, so it would mark them absent and auto-play their turns every 45 s, and anyone could take their seat by typing their name.

**Deviations**
- The computers say "ready" by themselves between rounds, through the same timer and the same pause rule. The design did not mention it, but the host's "who is ready" line would otherwise wait for them.
- The seat shows the short name; the design asked for a badge, the badge carries the "ordi".

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

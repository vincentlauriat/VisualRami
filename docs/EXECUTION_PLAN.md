# Execution plan

Living plan for VisualRami. Phases are ordered; each lists its deliverables, its exit criterion and its status.
Dates are absolute. Status legend: ✅ done · 🔄 in progress · ⏳ planned · 💤 idea.

## Goal

An online French Rummy (Rami 51) for 2–6 friends who can **see and hear each other** while they play,
reachable from a browser with nothing to install, hosted on the Azure sandbox.

## Phase 0 — Foundations (2026-09-14) ✅

| Deliverable | Exit criterion | Status |
|---|---|---|
| npm workspaces `shared` / `server` / `client`, strict TypeScript | `npm run typecheck` green | ✅ |
| Card model, meld analysis (runs, sets, jokers, ace low/high) | 14 rule tests | ✅ |
| Pure game reducer: start, draw, layDown, extend, swapJoker, discard, newRound, scoring | 11 reducer tests | ✅ |
| Public state projection (own hand only, discard top + depth) | test asserts nothing leaks | ✅ |

## Phase 1 — Server (2026-09-14) ✅

| Deliverable | Exit criterion | Status |
|---|---|---|
| Rooms with 5-letter codes, per-player rejoin tokens, 6 h sweep | integration test | ✅ |
| Socket.IO handlers with strict payload validation (`validate.ts`) | malformed payloads answered, never crash | ✅ |
| WebRTC signalling relay (SDP/ICE only, size + rate limits) | relay test | ✅ |
| Chat, absent-player auto-turn (45 s), host handover | tests | ✅ |
| Serves the built client, optional HTTPS, CORS closed by default | manual | ✅ |

## Phase 2 — Client (2026-09-14) ✅

| Deliverable | Exit criterion | Status |
|---|---|---|
| Home (create / join), Lobby (code, link, video preview), Game table | two-tab browser run | ✅ |
| Hand selection with ordered runs, staging area for the first laydown, meld targets | two-tab browser run | ✅ |
| `useGame` (session in `sessionStorage`, auto-rejoin) | reload keeps the seat | ✅ |
| `useWebRTC` full mesh, perfect negotiation, watchdog, clean leave | code review + unit of behaviour in browser pending | ✅ |
| Log + chat side panel, round result overlay | two-tab browser run | ✅ |

## Phase 3 — Hardening (2026-09-14) ✅

Independent code review, 10 findings fixed (crash on malformed action, mesh leaks on leave,
stuck negotiation, frozen game on disconnect, rejoin not detaching, dead turn on last card,
unbounded signalling/chat, discard pile leak, TURN hook, open CORS). See `CHANGELOG.md`.

## Phase 4 — Azure sandbox deployment (2026-09-15) ✅

| Deliverable | Exit criterion | Status |
|---|---|---|
| `Scripts/build-azure.sh` self-contained package + local smoke test | zip boots locally | ✅ |
| Web App on the shared B1 plan, WebSockets on, Node 24 | `/healthz` 200 over HTTPS | ✅ |
| `Scripts/probe-remote.mjs` end-to-end WebSocket probe | OK in < 3 s against Azure | ✅ |
| `docs/DEPLOYMENT_AZURE.md` with the pitfalls met | written | ✅ |

URL: https://visualrami-vl-09150521.azurewebsites.net

## Phase 5 — Real-world validation ⏳

| Task | Exit criterion | Status |
|---|---|---|
| Play a full game from two devices on the Azure URL with camera and microphone | video and audio both ways for 6 players (5 peer connections each) | ⏳ |
| Measure WebRTC connectivity from home / mobile / corporate networks | list of networks needing TURN | ⏳ |
| Provision a TURN relay (coturn on a small VM or a hosted service) and set `VITE_TURN_*` | connection through symmetric NAT | ⏳ |
| Playtest the rules with real players (51 threshold, pure run, joker swap) | feedback logged in `TODOS.md` | ⏳ |

## Phase 6 — Delivery pipeline ⏳

| Task | Exit criterion | Status |
|---|---|---|
| GitHub Actions: typecheck + tests + build on every push (`.github/workflows/ci.yml`) | green badge | 🔄 |
| Deploy job: `build-azure.sh` + `az webapp deploy` on tag, OIDC login to Azure | tag → live | ⏳ |
| Decide the app's lifetime in the sandbox (keep on shared B1 or delete) | decision in `MEMORY.md` | ⏳ |

## Phase 7 — Product polish 💤

- Drag-and-drop hand reordering, keyboard shortcuts.
- Spectator mode, per-round history, end-of-game screen (target score).
- Sound cues (your turn, card drawn), mobile layout pass, accessibility audit.
- Persistent rooms (Redis or Azure Cache) if the server must scale beyond one instance
  (Socket.IO sticky sessions or adapter).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| WebRTC fails behind strict NATs | TURN relay (Phase 5); env hook already in place |
| Single in-memory server: restart loses rooms | acceptable for a sandbox; adapter + store if needed (Phase 7) |
| Free/Basic App Service limits (WebSocket count, cold start) | B1 plan chosen; Always On can be enabled on B1 |
| `az webapp deploy` CLI hangs after a successful deploy | verify via `az webapp log deployment list` and `/healthz` |

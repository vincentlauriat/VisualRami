# Architecture (source of truth)

## Overview

```
┌────────────┐   Socket.IO (state + actions + signalling)   ┌──────────────┐
│  Client A  │◄────────────────────────────────────────────►│              │
│ React/Vite │                                              │   Server     │
└─────┬──────┘                                              │ Express +    │
      │ WebRTC media (P2P mesh, STUN)                       │ Socket.IO    │
┌─────▼──────┐                                              │ RoomManager  │
│  Client B  │◄────────────────────────────────────────────►│ (in memory)  │
└────────────┘                                              └──────────────┘
```

Three npm workspaces:

| Package | Role |
|---|---|
| `@visualrami/shared` | Card model, meld rules, pure reducer `applyAction(state, playerId, action)`, public-view projection `toPublicState`. No I/O. |
| `@visualrami/server` | `RoomManager` (rooms keyed by 5-letter code, per-player rejoin tokens), Socket.IO handlers, WebRTC signal relay, serves `client/dist`. Optional HTTPS via `HTTPS_KEY`/`HTTPS_CERT`; socket CORS closed unless `CORS_ORIGIN` is set. |
| `@visualrami/client` | React UI. `useGame` (socket + session in `sessionStorage`), `useWebRTC` (full mesh, perfect negotiation), screens Home / Lobby / Game. |

## Game state

- The server holds the full `GameState`; clients only receive `PublicGameState` (own hand, other players' card counts, stock count, top of the discard pile and its depth, melds, log).
- Every action is validated by the shared reducer on the server; the client reuses the same rules for instant feedback (staging area, meld targets).
- Turn phases: `draw` → `play` → next player. A round ends on the last discard; `newRound` redeals and rotates the first player.
- Every socket payload goes through `server/src/validate.ts` before reaching the reducer; a reducer exception is caught and answered with an error.
- If the current player has no socket for 45 s, the server plays a minimal turn for them (`autoPlayTurn`: draw from stock, discard). The host role moves to a connected player when the host drops.

## Socket events

| Direction | Event | Payload |
|---|---|---|
| C→S | `room:create` | `{ name, options }` → ack `{ roomId, playerId, token }` |
| C→S | `room:join` | `{ roomId, name }` → same ack |
| C→S | `room:rejoin` | `{ roomId, playerId, token }` |
| C→S | `room:leave` | – |
| C→S | `game:action` | `GameAction` → ack `{ ok }` or `{ error }` |
| C→S | `rtc:signal` | `{ to, data }` — `data` is exactly `{ description }` or `{ candidate }`, ≤ 16 KB, ≤ 120 per 5 s |
| C→S | `chat:message` | `string` (≤ 300 chars, ≤ 8 per 5 s) |
| S→C | `room:state` | `PublicGameState` (per player) |
| S→C | `rtc:signal` | `{ from, data }` |
| S→C | `rtc:peer-left` / `rtc:peer-reset` | `{ playerId }` |
| S→C | `chat:message` | `{ from, name, text, at }` |

## Media

- One `RTCPeerConnection` per other player (mesh, fine for ≤ 4).
- Perfect negotiation: `polite = selfId > peerId`; both sides may add tracks at any time.
- The mesh is torn down synchronously on every socket `connect` and on `rtc:peer-reset`; a per-peer watchdog rebuilds a connection that is not stable and connected within 8 s. Leaving the table stops local tracks.
- Media is requested when the player is seated; failure falls back to audio-only, then to receive-only.
- ICE: Google STUN, plus an optional TURN relay injected at build time through `VITE_TURN_URL` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL`.

## Deployment

- Azure App Service (Linux, `NODE:24-lts`), single instance, WebSockets enabled, startup `node server/dist/index.js`, `SCM_DO_BUILD_DURING_DEPLOYMENT=false`.
- `Scripts/build-azure.sh` assembles a flat tree (`package.json` with runtime deps, `node_modules` incl. a copy of `@visualrami/shared`, `server/dist`, `client/dist`) and smoke-tests it before zipping.
- `Scripts/probe-remote.mjs` validates a deployment end to end over WebSocket.

## Decisions

- **Server-authoritative reducer in a shared package**: one implementation of the rules, testable without I/O, reused client-side for UX.
- **sessionStorage for the session** rather than localStorage: survives reloads, but each tab is its own player, which makes local testing with several tabs possible.
- **No database**: rooms live in memory and are swept after 6 h of inactivity.

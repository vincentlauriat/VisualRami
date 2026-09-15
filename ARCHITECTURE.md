# Architecture (miroir FR de ARCHITECTURE_EN.md)

## Vue d'ensemble

```
┌────────────┐   Socket.IO (état + actions + signalisation) ┌──────────────┐
│  Client A  │◄────────────────────────────────────────────►│              │
│ React/Vite │                                              │   Serveur    │
└─────┬──────┘                                              │ Express +    │
      │ Média WebRTC (maillage P2P, STUN)                    │ Socket.IO    │
┌─────▼──────┐                                              │ RoomManager  │
│  Client B  │◄────────────────────────────────────────────►│ (en mémoire) │
└────────────┘                                              └──────────────┘
```

Trois workspaces npm :

| Paquet | Rôle |
|---|---|
| `@visualrami/shared` | Modèle de cartes, règles des combinaisons, réducteur pur `applyAction(state, playerId, action)`, projection `toPublicState`. Aucune E/S. |
| `@visualrami/server` | `RoomManager` (salles par code à 5 lettres, jetons de reprise par joueur), handlers Socket.IO, relais de signalisation WebRTC, sert `client/dist`. HTTPS optionnel via `HTTPS_KEY`/`HTTPS_CERT` ; CORS socket fermé sauf si `CORS_ORIGIN` est défini. |
| `@visualrami/client` | UI React. `useGame` (socket + session en `sessionStorage`), `useWebRTC` (maillage complet, négociation parfaite), écrans Accueil / Salon / Table. |

## État de jeu

- Le serveur détient le `GameState` complet ; les clients ne reçoivent que `PublicGameState` (leur main, le nombre de cartes des autres, la taille du talon, le dessus de la défausse et sa profondeur, les combinaisons, le journal).
- Chaque action est validée par le réducteur partagé côté serveur ; le client réutilise les mêmes règles pour le retour immédiat (zone de préparation, cibles de combinaison).
- Phases d'un tour : `draw` → `play` → joueur suivant. La manche se termine à la dernière défausse ; `newRound` redistribue et fait tourner le premier joueur.
- Chaque charge utile socket passe par `server/src/validate.ts` avant d'atteindre le réducteur ; une exception du réducteur est interceptée et renvoyée comme erreur.
- Si le joueur courant n'a plus de socket pendant 45 s, le serveur joue un tour minimal pour lui (`autoPlayTurn` : pioche au talon, défausse). Le rôle d'hôte passe à un joueur connecté si l'hôte décroche.

## Événements socket

| Sens | Événement | Charge utile |
|---|---|---|
| C→S | `room:create` | `{ name, options }` → ack `{ roomId, playerId, token }` |
| C→S | `room:join` | `{ roomId, name }` → même ack |
| C→S | `room:rejoin` | `{ roomId, playerId, token }` |
| C→S | `room:leave` | – |
| C→S | `game:action` | `GameAction` → ack `{ ok }` ou `{ error }` |
| C→S | `rtc:signal` | `{ to, data }` — `data` vaut exactement `{ description }` ou `{ candidate }`, ≤ 16 Ko, ≤ 120 par 5 s |
| C→S | `chat:message` | `string` (≤ 300 caractères, ≤ 8 par 5 s) |
| S→C | `room:state` | `PublicGameState` (par joueur) |
| S→C | `rtc:signal` | `{ from, data }` |
| S→C | `rtc:peer-left` / `rtc:peer-reset` | `{ playerId }` |
| S→C | `chat:message` | `{ from, name, text, at }` |

## Média

- Une `RTCPeerConnection` par autre joueur (maillage : jusqu'à 5 connexions par client à 6 joueurs ; au-delà, un SFU s'imposerait).
- Négociation parfaite : `polite = selfId > peerId` ; chaque côté peut ajouter des pistes à tout moment.
- Le maillage est démonté de façon synchrone à chaque `connect` socket et sur `rtc:peer-reset` ; un chien de garde par pair reconstruit une connexion qui n'est pas stable et connectée sous 8 s. Quitter la table arrête les pistes locales.
- Le média est demandé dès que le joueur est assis ; en cas d'échec, repli audio seul, puis réception seule.
- ICE : STUN Google, plus un relais TURN optionnel injecté au build via `VITE_TURN_URL` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL`.

## Déploiement

- Azure App Service (Linux, `NODE:24-lts`), instance unique, WebSockets activés, démarrage `node server/dist/index.js`, `SCM_DO_BUILD_DURING_DEPLOYMENT=false`.
- `Scripts/build-azure.sh` assemble une arborescence plate (`package.json` avec les dépendances d'exécution, `node_modules` incluant une copie de `@visualrami/shared`, `server/dist`, `client/dist`) et la teste avant de zipper.
- `Scripts/probe-remote.mjs` valide un déploiement de bout en bout en WebSocket.

## Décisions

- **Réducteur autoritaire dans un paquet partagé** : une seule implémentation des règles, testable sans E/S, réutilisée côté client pour l'UX.
- **sessionStorage pour la session** plutôt que localStorage : survit au rechargement, mais chaque onglet est un joueur distinct, ce qui permet de tester en local avec plusieurs onglets.
- **Pas de base de données** : les salles vivent en mémoire et sont purgées après 6 h d'inactivité.

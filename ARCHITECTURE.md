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
| `@visualrami/shared` | Modèle de cartes, règles des combinaisons, réducteur pur `applyAction(state, playerId, action)`, projection `toPublicState`. Joueur ordinateur dans `src/bot/` (recherche de combinaisons, niveau facile `planTurn(view)`, décide à partir du seul `PublicGameState`). Aucune E/S. |
| `@visualrami/server` | `RoomManager` (salles par code à 5 lettres, jetons de reprise par joueur), handlers Socket.IO, relais de signalisation WebRTC, sert `client/dist`. HTTPS optionnel via `HTTPS_KEY`/`HTTPS_CERT` ; CORS socket fermé sauf si `CORS_ORIGIN` est défini. |
| `@visualrami/client` | UI React. `useGame` (socket + session en `sessionStorage`), `useWebRTC` (maillage complet, négociation parfaite), écrans Accueil / Salon / Table. |

## État de jeu

- Le serveur détient le `GameState` complet ; les clients ne reçoivent que `PublicGameState` (leur main, le nombre de cartes des autres, la taille du talon, le dessus de la défausse et sa profondeur, les combinaisons, le journal). Les mains des autres ne sont envoyées qu'une fois la manche terminée (`revealedHands`, `null` pendant le jeu), pour afficher le décompte à découvert.
- Chaque action est validée par le réducteur partagé côté serveur ; le client réutilise les mêmes règles pour le retour immédiat (zone de préparation, cibles de combinaison).
- Phases d'un tour : `draw` → `play` → joueur suivant. La manche se termine à la dernière défausse, ou devient nulle quand un joueur pioche dans le talon vide après 3 remélanges (`GameState.reshuffles`, remis à zéro à chaque donne ; un instantané sans entier ≥ 0 à cet endroit se charge avec `0` ; la vue publique porte `reshufflesLeft`, pour que le client prévienne sur le talon avant cette pioche) : `finished` avec `winnerId: null`, toutes les mains révélées et comptées. Le serveur plafonne à 100 points le seuil de première pose d'une nouvelle table (`sanitizeOptions` dans `server/src/validate.ts`) ; les tables sauvegardées gardent le leur ; `newRound` redistribue et fait tourner le premier joueur. Entre deux manches, `{ type: "ready", ready }` (joueurs autres que l'hôte, phase `finished` uniquement) enregistre qui est prêt dans `GameState.ready` (persisté ; un instantané sans ce champ se charge avec `[]`) ; l'hôte distribue toujours, et chaque donne le vide.
- Chaque charge utile socket passe par `server/src/validate.ts` avant d'atteindre le réducteur ; une exception du réducteur est interceptée et renvoyée comme erreur.
- Si le joueur courant n'a plus de socket pendant 45 s et qu'un autre humain est à la table, le serveur joue un tour minimal pour lui (`autoPlayTurn` : pioche au talon, défausse). Une table sans aucun humain connecté se met en pause à la place. Le rôle d'hôte passe à un humain connecté si l'hôte décroche.
- Les joueurs ordinateur (`Player.isBot`, `level` ; `PublicPlayer.isBot`) n'ont pas de socket, restent `connected`, ne sont jamais hôtes et ne sont jamais joués par le minuteur d'absence. `BotScheduler` (`server/src/botScheduler.ts`) tient une minuterie par table, réarmée à chaque diffusion. Une diffusion ne fait que réarmer la minuterie. Au déclenchement, le coup suivant est planifié sur `toPublicState(state, botId)` uniquement et appliqué par le réducteur ; la défausse, un temps plus tard, n'est appliquée que si l'objet d'état n'a pas changé. Puis il diffuse. Il se met en pause tant qu'aucun humain n'est à la table et ne lève jamais d'exception vers une diffusion : un échec retombe sur des coups plus simples, puis sur de nouveaux essais après 2 à 30 s. Les prénoms commençant par « Ordi » sont réservés aux nouveaux sièges d'ordinateur. `room:create`, `room:addBot` et `room:removeBot` partagent une limite de 10 par 10 s et par socket. Le client exclut les ordinateurs du maillage WebRTC. Compatibilité : un ancien bundle client resté ouvert inclut les ordinateurs dans son maillage (reconstruit toutes les 8 s) jusqu'au rechargement ; un serveur revenu à une version antérieure traiterait les ordinateurs comme des humains (absents, joués automatiquement, siège pris par le nom).

## Événements socket

| Sens | Événement | Charge utile |
|---|---|---|
| C→S | `room:create` | `{ name, options }` → ack `{ roomId, playerId, token }` |
| C→S | `room:join` | `{ roomId, name }` → même ack plus `resumed` (vrai quand un siège déconnecté d'une partie commencée a été repris). Les erreurs sont des phrases en français affichées telles quelles, par exemple `{ error: "Table introuvable" }` (le client ajoute « vérifiez le code » quand elle vient d'un code saisi ou d'un lien) |
| C→S | `room:rejoin` | `{ roomId, playerId, token }` — idempotent pour la socket qui tient déjà ce siège (le client le renvoie à l'événement `online` du navigateur). Le client n'oublie son siège que sur une réponse `{ error }`, jamais sur un délai dépassé ou une socket coupée |
| C→S | `room:leave` | – (le joueur a appuyé sur Quitter : une partie commencée garde le siège et journalise « X a quitté la table » ; une connexion perdue ne journalise rien) |
| C→S | `game:action` | `GameAction` → ack `{ ok }` ou `{ error }` |
| C→S | `room:addBot` | `{ level? }` (`"easy"`, par défaut) — hôte seulement, en salon, 6 places au plus → ack `{ ok, playerId }` ou `{ error }` |
| C→S | `room:removeBot` | `{ playerId }` — hôte seulement, en salon, un joueur ordinateur seulement → ack `{ ok }` ou `{ error }` |
| C→S | `rtc:signal` | `{ to, data }` — `data` vaut exactement `{ description }`, `{ candidate }` ou `{ media: { cam?, mic? } }` (booléens, au moins un : caméra/micro allumés ou coupés, puisqu'une piste désactivée envoie encore des images noires ou du silence), ≤ 16 Ko, ≤ 120 par 5 s |
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
- **Pas de base de données, mais un instantané JSON** : les salles vivent en mémoire et sont écrites dans `DATA_DIR/rooms.json` (différé 500 ms, renommage atomique, vidage sur SIGTERM). Un redémarrage restaure chaque table avec ses jetons de reprise, tout le monde marqué déconnecté. Purge : salons vides après 6 h, parties commencées après 7 jours.
- **Retour par code + prénom** : sur une partie commencée, `room:join` avec le prénom d'un joueur déconnecté reprend ce siège (nouveau jeton). Les sièges sont aussi mémorisés par navigateur dans `localStorage`, d'où le bouton « Reprendre » de l'accueil.

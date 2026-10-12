---
target: "client/src/App.tsx (whole app, after PRs #17-#18)"
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-10-12T18-19-25Z
slug: client-src-app-tsx
---
Method: dual-agent (A: design review via Playwright walkthrough · B: impeccable detector + browser injection)

# VisualRami critique — second pass after PRs #17 and #18 (main 880ac12)

Score 28/40 (Good, low end), baseline 25/40 the same morning. 0 P0, 1 P1 (new).

Coverage: A saw home, invite, lobby, 3-player table at 1440/1100/390, 6 players, a real server kill/restart, a peer leaving, phone landscape. A did NOT see round end (bots stuck in the end-of-hand trap); B reached it (desktop-result, mobile-result) and the panel works. Unseen: 45 s auto-play, deck exhaustion, screen reader, real devices.

| # | Heuristic | Prev | Score | Key issue |
|---|---|---|---|---|
| 1 | Visibility | 3 | 3 | Connection, absent, muted mic, drawn card all shown; "1re pose" label never clears |
| 2 | Real world | 3 | 3 | Log does not say whose meld a card joined |
| 3 | Control | 2 | 3 | Two-step Quitter; end-of-hand trap leaves only the small × at the top of the felt |
| 4 | Consistency | 3 | 3 | Poser gold when it cannot succeed; chat tab 2 vs button 1 |
| 5 | Error prevention | 3 | 3 | canLay (Game.tsx:241) misses the keep-one-card check |
| 6 | Recognition | 2 | 3 | Rules at the table, live points and threshold gap |
| 7 | Flexibility | 2 | 2 | Two fixed sorts, no reorder, no shortcuts |
| 8 | Aesthetic | 3 | 3 | Empty felt before first laydown; pinned-seat fade clips neighbour captions |
| 9 | Recovery | 3 | 3 | "Vous devez garder une carte à défausser" states the rule, not the gesture |
| 10 | Help | 1 | 2 | Rules reachable; nothing contextual at the trap or for Préparer → Poser |
| | Total | 25 | 28/40 | Good |

Design specificity: the table and now the invite card are authored; cold Home on desktop and the lobby stay generic.
Detector: CLI 0 findings on client/src (validated: 49ea3f0 stylesheet gives 1 layout-transition). Browser: 7 of 10 views clean; game-mobile 4, result 6 desktop / 5 mobile, all classified false positives by B (joker violet and sheet shadow allowed by DESIGN.md:297/300; playing cards read as UI cards). The three real defects are logic, invisible to the detector.

Strengths: presence as part of the game (real kill/restart resumes cleanly, absent seats, Reprendre); the invite card; the phone mid-game layout.

Priority issues:
- [P1] End-of-hand trap: all remaining cards staged, Poser gold, laydown fails with a toast, Défausser and Désélectionner dead; only exit is the × at the top of the felt. Fix: canLay requires an unstaged card; banner "Gardez une carte pour défausser : retirez-en une de la préparation"; tapping a greyed card unstages it. /impeccable harden + clarify.
- [P2] "1re pose · N pts" never clears: Game.tsx:270-280 cleanup cancels the 4 s timer on every state update. Fix: separate effect keyed on fresh. /impeccable polish.
- [P2] Empty felt before the first laydown (3rd critique): show the last 3 discards and who threw them, or the last opponent action. /impeccable layout + delight.
- [P2] Pinned seat fade clips the neighbour's caption on phone ("ximilien", "rtes · 0 pts" at 6 players). Fix: scroll padding = pinned seat + fade. /impeccable adapt.
- [P3] Chat counters disagree: tab counts all messages (Chat.tsx:48), button counts others' and never resets after reading. One unread counter. /impeccable clarify.

Personas: first-timer (Préparer → Poser unexplained, trap toast with no gesture, sticky "1re pose"); phone one-hand (trap exit out of thumb reach, selection pill overlaps the felt edge); accessibility (Poser announced enabled while failing, divergent counters, VoiceOver untested); invited family member (path now excellent; neighbour caption clipped at 6 players).

Minor: "Tout le monde est prêt · absent : Bruno" contradicts itself; on phone the absent pill overlaps "posé" and the initial on an absent tile; two labels for Poser; error toast covers the melds above the hand on phone; 1100 drawer still covers Micro/Caméra/Quitter; one unreproduced 24 px horizontal shift at 390; lobby tiles lack a "connexion…" state.

Questions: make laying the last cards the exit gesture ("Finir la manche : poser et défausser le 2♥")? Leave a trace of discards on the empty felt? Is the sticky "1re pose" a hint that players want a durable marker of who opened, and with how much?

Versus baseline: 16 items fixed and seen live; round end seen on B's captures only; partly fixed: 1100 drawer, chat counters; persisting: empty felt, two sorts, meld owner in log, generic lobby; new: end-of-hand trap (P1), sticky first-laydown label (P2), fade clipping captions (P2).

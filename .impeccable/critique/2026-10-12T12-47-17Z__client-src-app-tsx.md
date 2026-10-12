---
target: whole client app (home, lobby, table, chat/video, mobile)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-10-12T12-47-17Z
slug: client-src-app-tsx
---
# Critique — VisualRami client (whole app), 2026-10-12, after PR #16

Method: dual-agent (A: design review via Playwright journeys at 1440/1100/390 · B: detect.mjs CLI + Playwright overlay injection)

## Heuristics — 25/40 (Acceptable)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Turn state excellent; own connection loss, peer departure, peer mute invisible |
| 2 | Match real world | 3 | "Salle introuvable" vs "table"; winner reads "+0 / 0" |
| 3 | User control | 2 | Quitter unconfirmed; round-end modal makes page inert for non-hosts; laptop drawer covers its toggle |
| 4 | Consistency | 3 | Home shows 3 gold buttons; "Défausser quand même" in lamp gold |
| 5 | Error prevention | 3 | Unconfirmed leave; invited player offered "Créer" first |
| 6 | Recognition vs recall | 2 | Card values / 51 threshold hidden until staging; rules only on Home |
| 7 | Flexibility | 2 | Two fixed sorts, no reorder, no shortcuts, no meld suggestion |
| 8 | Aesthetic/minimal | 3 | Phone name pills truncate; empty felt during pre-51 valley |
| 9 | Error recovery | 3 | Bad-code error under name field; toasts 4–6 s; chat lost on reload |
| 10 | Help | 1 | Nothing reachable during play |

## Specificity
Table authored (felt/brass/ivory, seats around felt, "1re pose · N pts" event). Home (stack of form panels) and lobby (generic call waiting room) are category-interchangeable. Detector: CLI 1 finding (layout-transition styles.css:395 gauge, also not covered by prefers-reduced-motion block 727-736); browser: home desktop 4× line-length 103–109ch (real), lobby clean, game 3–5 (joker violet, sheet shadow, "10" occlusion = false positives per DESIGN.md; topbar tag cramped padding and phone seat strip flush right = real minor).

## Priority issues
- [P1] Phone name pills lose names; own tile reads "(vous) posé" after laying down (VideoTile.tsx:36-40, styles.css:186/548). adapt, typeset
- [P1] End of round (3rd time): spreadsheet modal, "+0", no hands revealed, ×2 unexplained, faces dimmed, non-hosts locked out (Game.tsx:558-594, 329, 361). delight
- [P1] Presence/connection silent: own disconnect not shown in Game (App.tsx:30 banner only on Home; Game gets no connected prop), peer departure unlabeled, mic state not sent, Quitter unconfirmed. harden, clarify
- [P2] Invite link lands on full creator form with "Créer" first; code error under name field. onboard, clarify
- [P2] No help at the table (3rd time); no live points on selection. onboard
- [P3] Desktop 2–3 players: piles far left, banner far right; orphan card at 1100px. layout

## Personas
Jordan: rules only before entry, Préparer→Poser unexplained, "+0" reads like a loss. Casey: Quitter one slip away, "Défausser quand même" wraps 3 lines, own seat scrolls off with 5 opponents. Sam: log not live, placeholders aria-hidden, mic state not exposed. Mamie Odette (invited by link): lands on Créer, name cut to "Od…", 11px seat text, toasts vanish, chat lost on reload, waits at round end.

## Minor
Gradient seam on long home scroll; "Copier le lien" should be primary in lobby; no "connexion…" state on lobby tiles; landscape felt 270px clipped; drawn card not marked; log doesn't say whose meld; 🃏 emoji in joker centre (CardView.tsx:37); "combinaison(s)" (game.ts:285); chat badge counts own messages (Game.tsx:346); gauge transition lacks reduced-motion.

## Questions
1. Why are faces dimmed at the most social moment (end of round)?
2. Should a link invite be its own surface rather than Home?
3. Could the pre-51 valley be filled on the felt (discards sliding, "Bruno a pris votre 7♥")?

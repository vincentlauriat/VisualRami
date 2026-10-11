---
target: table
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-10-11T12-57-22Z
slug: client-src-components-game-tsx
---
# Critique 2 — table de jeu (client/src/components/Game.tsx), 2026-10-11, after PR #14

Method: dual-agent (A: design review, blind to run 1 · B: detector + browser). CLI detector DEGRADED (1 real finding: layout-transition on .gauge width, styles.css:295). Overlay ran in 6 states; findings are false positives (joker purple, body stripes, closed sheet, "10" glyph overlap).

## Heuristics — 24/40 (Acceptable). Same total as run 1, different mix.
1 Visibility 3 — active seat can be off-screen on phone with 5 opponents; others' moves only in log.
2 Real world 3 — Préparer→Poser unexplained.
3 Control 2 — discarding wipes staged melds silently; Quitter unconfirmed.
4 Consistency 3 — coaching in danger toast; staged cards look disabled.
5 Error prevention 2 — Défausser gold+enabled while a 40-pt tray is staged (Game.tsx:168, verified).
6 Recognition 2 — 51/pure-run only visible once staging; others' moves in log only.
7 Efficiency 2 — fixed sorts, no reorder/shortcuts.
8 Aesthetic 3 — calm; desktop felt empty, phone tray clipped.
9 Error recovery 3 — reasons name the fix; misreads intent (9 9 5 → "seule couleur").
10 Help 1 — no rules access at the table.

## Measured (B)
All text ≥ AA (turn hint ≥6.6, staging text ≥8.6); no page scroll on phone; hand fully above .actions in all states; phone icon buttons 37–40px wide (verified: no min-width on icon-only buttons); chat placeholder 3.96:1.

## Priority issues
- [P0] Laptop 1280×720 / 1024×768 with 6 players: opponent row wraps, felt collapses to 44px (A, live). Fix: never wrap seats; size tiles by player count or flank the felt; felt min-height. → /impeccable adapt
- [P1] REGRESSION from PR #14: phone tray hidden below felt fold at 15 cards (tray y 328 vs felt bottom 343; both A and B). Fix: overlap hand at 15+, shrink piles in play phase, tray at top of felt. → /impeccable adapt, layout
- [P1] Défausser gold while staging; discard silently wipes staging (Game.tsx:168, 75-80). Fix: non-gold while tray non-empty, explicit confirm, pre-laydown hint. → /impeccable harden
- [P1] Phone: active seat can be off-screen (no scrollIntoView); long names wrap over video; truncated names look complete; no "vous" tag. → /impeccable adapt, clarify
- [P2] No rules entry; coaching styled as red error toast with 4–6s timer; flat end of round (no hands revealed, no ×2 reason). → /impeccable onboard, delight

## Personas
Casey: tray clipped; icon-only Quitter unconfirmed top-right; icon buttons 37–40px.
Jordan: 51/tierce franche unexplained before staging; Préparer vs Poser; pre-laydown selection lights only Défausser; 9 9 5 misread.
Sam: focus lost after extend (button→div); others' moves never announced.
Mamie Odette: errors vanish in 4–6s; active seat off-screen; 11px info; long name pill covers face; "+40" unexplained.

## Minor
🃏 emoji joker centre; "combinaison(s)"; desktop banner 900px from piles; landscape toast over own seat; chat badge counts all; chat placeholder UA colour 3.96:1.

## Questions
1. Seat players around the felt with their melds in front of their faces?
2. First laydown as a shared table event with points?
3. Could the selection be the tray, removing "Préparer"?

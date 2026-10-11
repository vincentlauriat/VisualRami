---
target: table
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-10-11T12-21-34Z
slug: client-src-components-game-tsx
---
# Critique — table de jeu (client/src/components/Game.tsx), 2026-10-11

Method: dual-agent (A: design review · B: detector + browser). Detector ran DEGRADED (HTML parser modules missing; validated on known-bad file: catches gradient text, misses emoji icons, contrast, tiny text). Browser overlay injection succeeded (3 findings phone, 1 desktop: repeating-stripes body = intentional felt texture; thin-border-wide-shadow on mobile sheet = style; text-occlusion on a "10" card corner = unconfirmed).

## Heuristics — 24/40 (Acceptable)
1 Visibility 2 — phone hand hidden under sticky bar at turn start; desktop banner small, far from piles; others' moves only in log.
2 Real world 3 — French vocabulary, but J/Q/K faces and "Trier 1→K".
3 Control 3 — unstage/deselect exist; non-host locked in result modal (page inert, no chat).
4 Consistency 2 — gold on opponents' "posé", every meld, disabled primary; chat badge counts all messages.
5 Error prevention 1 — runs valid only in tap order (rules.ts:45-66 + Game.tsx:110, verified); every meld lit as target regardless of fit (Game.tsx:267, verified).
6 Recognition 2 — 51/pure-run/discard-card rules to remember; discard rule only in title tooltip (Game.tsx:366).
7 Efficiency 2 — two sorts; no reorder, no shortcuts; 5 taps per laydown.
8 Aesthetic 3 — disciplined palette; empty desktop felt; sticky bar 20% of phone viewport.
9 Error recovery 2 — "vérifiez l'ordre" even when order isn't the problem (Game.tsx:131); toast survives into next turn.
10 Help 1 — no rules/help at the table.

## Measured (B)
Felt text ≥6.5:1 (pixel-sampled); disabled buttons 2.6–3.3:1; no horizontal overflow; one phone target <44 (chat toggle 40×44); 11px tags/opponent info on phone; 0 console errors.

## Priority issues
- [P0] Phone: own hand + "Poser" off-screen on your turn (sticky bar covers hand at scroll 0; staging below fold). Fix: fixed-viewport phone grid, one-row topbar, self seat in strip, Poser in sticky bar. → /impeccable adapt, layout
- [P1] First laydown: no guidance + run tap-order trap + misleading error. Fix: sort selection before analyzeMeld, specific reasons, 0–51 gauge with "encore N pts" + pure-run pip, light Poser on crossing. → /impeccable clarify, harden
- [P1] Lamp Rule diluted: disabled gold Défausser in draw phase, piles not highlighted; all melds gold targets; opponents' posé badge gold. Fix: gold ring on piles in draw phase, target only accepting melds, neutral opponent badge. → /impeccable colorize
- [P2] End of round = spreadsheet + lock-out: "+0 / 0", no ranking/"lowest wins"/doubling explanation; non-hosts inert. Fix: ranking, remaining cards, winner video hero, keep chat live, "prêt". → /impeccable delight
- [P2] Phone opponent strip: 3½ of 5 seats visible, no scroll cue, active seat can be off-screen; names cut at 24 chars. Fix: auto-scroll to active seat or compact chips; first name + ellipsis. → /impeccable adapt

## Personas
Casey: scroll every turn; Poser off-screen; sort buttons same weight as Défausser; discard rule tooltip-only.
Jordan: no rules; 51/tierce franche unexplained; order trap; all melds glow; "+0" reads as losing.
Sam: only turn banner is live; others' discards silent; seats not exposed as a list.
Mamie Odette: 11px/10px text; disabled gold looks available; slow tapping hits order trap; no chat at round end.

## Minor
"(0)" count; chat badge not unread; toast shifts layout and lasts 6s; 🃏 emoji in joker centre; "combinaison(s)"; desktop banner far right; staged cards dimmed in hand.

## Questions
1. Faces around the felt instead of above it; active face as the turn indicator?
2. Should a phone player ever choose between seeing the discard and their hand?
3. What if the 51 laydown were the signature interaction?

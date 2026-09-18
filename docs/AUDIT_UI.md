# UI Technical Audit — VisualRami client

Date: 2026-09-18 · Scope: `client/` (the only UI surface; `server/` and `shared/` carry no interface)
Method: static analysis of all 13 client source files, programmatic WCAG contrast computation,
bundled anti-pattern detector, production build. No browser session was run — findings marked
*(static)* are inferred from code and are flagged as such.

`PRODUCT.md` and `DESIGN.md` are both absent, so the Implementation Integrity verdict rests on the
code's internal coherence rather than on drift from a declared design system.

---

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2/4 | Extending a meld — a core game action — is impossible with a keyboard |
| 2 | Performance | 3/4 | Lean and well-guarded; only the round log grows without a cap |
| 3 | Responsive Design | 2/4 | `env(safe-area-inset-*)` is inert: `viewport-fit=cover` is missing |
| 4 | Theming | 2/4 | 14 tokens declared, 61 raw hex values bypass them; no `color-scheme` |
| 5 | Implementation Integrity | 3/4 | Coherent, product-specific; detector reports zero anti-patterns |
| **Total** | | **12/20** | **Acceptable — significant work needed** |

---

## Implementation Integrity verdict — PASS

The implementation expresses a coherent, product-specific system. Evidence:

- The bundled detector reports **zero anti-patterns** across `styles.css`, all six components,
  `App.tsx` and `index.html`. This verdict was validated: the same detector, run against a
  deliberately bad control file, correctly flagged `font-family: Inter` and bounce easing — so the
  clean result is a real signal, not a silent failure.
- The visual world is specific to the product: a felt table (`radial-gradient` + inset shadow +
  a `#3a2a16` wood rim), playing cards with corner pips and a woven back pattern, a gold accent
  reserved for "it is your turn" and "this is selected". Nothing here is interchangeable with a
  generic dashboard.
- Copy is real French domain language ("tierce franche", "brelans/carrés", "défausse"), not
  placeholder text, and carries genuine rule instruction.
- No decorative or misleading content, no fake data, no `transition: all`, no `will-change` abuse.

Residual drift is minor and isolated: `.pile-label` is rendered by `CardBack` (`CardView.tsx:51`)
but is defined nowhere in the stylesheet, and the `label` prop that would trigger it is never
passed by any caller. Dead code, not a pattern.

---

## Executive summary

- **Audit Health Score: 12/20** (Acceptable — significant work needed)
- **21 issues**: 0 × P0, 6 × P1, 10 × P2, 5 × P3
- The score is held down by a narrow set of *systemic* gaps rather than sloppy work. The code is
  clean, typed, commented where it matters, and builds without error (293.87 kB JS / 91.75 kB
  gzipped). What is missing is a consistent accessibility layer and a small number of platform
  configuration lines.

**Top 5:**

1. **[P1]** Melds cannot be extended with a keyboard — a core game action fails WCAG 2.1.1.
2. **[P1]** `env(safe-area-inset-bottom)` is used in four places but returns `0` on iOS because
   `viewport-fit=cover` is absent from the viewport meta. The sticky action bar sits under the
   iPhone home indicator.
3. **[P1]** The round-result overlay is a modal with no `role="dialog"`, no focus management, no
   Escape key, and leaves the page behind it tabbable.
4. **[P1]** On phones, the closed chat/log bottom sheet stays in the tab order and in the
   accessibility tree while parked off-screen at `translateY(105%)`.
5. **[P1]** `.turn-banner .mine` — gold on the felt centre — measures **4.22:1**, below AA. This is
   the primary "it is your turn" indicator.

**Next steps:** `/impeccable harden` first (keyboard operability, modal semantics, the inert sheet),
then `/impeccable adapt` (safe areas, z-index, touch targets), then `/impeccable colorize` and
`/impeccable extract`.

---

## Detailed findings

### P1 — Major (fix before release)

#### [P1] Melds are keyboard-inoperable
- **Location**: `client/src/components/Game.tsx:235-247`
- **Category**: Accessibility
- **Impact**: A `<div>` carries `onClick` and a conditional `role="button"`, but has no `tabIndex`
  and no `onKeyDown`. A keyboard-only player can select cards in hand (those are real `<button>`s)
  but can never place them onto an existing meld — they cannot extend a combination or swap a
  joker. That is a primary game action, not a convenience.
- **Standard**: WCAG 2.1.1 Keyboard (Level A)
- **Recommendation**: Make it a real `<button>`, or add `tabIndex={clickable ? 0 : -1}` plus an
  `onKeyDown` handler for Enter and Space. A `<button>` is cleaner: it also removes the need for
  the conditional `role`.
- **Suggested command**: `/impeccable harden`

#### [P1] Safe-area insets are inert on iOS
- **Location**: `client/index.html:5`; consumed at `styles.css:249, 288, 306` (`.game`, the sticky `.actions` bar, and `.chat-form`)
- **Category**: Responsive
- **Impact**: `env(safe-area-inset-*)` only resolves to a non-zero value when the viewport meta
  declares `viewport-fit=cover`. It does not. So every one of the four safe-area paddings —
  including the one on the sticky action bar that holds *Défausser* and *Poser sur la table* —
  evaluates to `0px`. On any notched iPhone in portrait, the primary action row sits beneath the
  home indicator. *(static — confirmed from the CSS and the meta tag; worth a device check, which
  `TODOS.md` already schedules)*
- **Recommendation**: `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`
- **Suggested command**: `/impeccable adapt`

#### [P1] Round-result overlay is not a dialog
- **Location**: `client/src/components/Game.tsx:339-370`
- **Category**: Accessibility
- **Impact**: A full-screen `position: fixed` overlay with no `role="dialog"`, no `aria-modal`, no
  `aria-labelledby`, no focus move on open, no focus trap and no Escape handler. A screen-reader
  user is not told the round ended; a keyboard user tabs straight through the overlay into the
  table underneath, which is visually obscured. Non-hosts have no interactive element at all inside
  the overlay, so their focus has nowhere legitimate to land.
- **Standard**: WCAG 2.4.3 Focus Order (A), 4.1.2 Name, Role, Value (A)
- **Recommendation**: `role="dialog" aria-modal="true" aria-labelledby=<h2 id>`, move focus to the
  heading or the "Nouvelle manche" button on mount, trap Tab inside, and mark the rest of the app
  `inert` while it is open.
- **Suggested command**: `/impeccable harden`

#### [P1] The closed bottom sheet stays focusable and announced
- **Location**: `client/src/styles.css:299-304` (`transform: translateY(105%)` at line 301); `client/src/components/Chat.tsx:30`
- **Category**: Accessibility
- **Impact**: Below 900px the log/chat panel is parked off-screen with `transform: translateY(105%)`.
  A transform hides a thing visually but removes it from nothing: its two tabs, its ✕ button, its
  message input and its Send button all remain in the tab order and in the accessibility tree. A
  keyboard user tabbing past the hand lands in a panel they cannot see; a screen-reader user hears
  the whole log read out as part of the page.
- **Standard**: WCAG 2.4.3 Focus Order (A)
- **Recommendation**: Add `inert` (and/or `aria-hidden` + `visibility: hidden` after the transition)
  to `.side` when `sideOpen` is false. `visibility` is animatable alongside `transform` with
  `transition-behavior: allow-discrete`, so the slide-out is preserved.
- **Suggested command**: `/impeccable harden`

#### [P1] Turn indicator fails AA contrast
- **Location**: `client/src/styles.css:153` (`.turn-banner .mine`, `--gold` `#e6b84f`) on
  `.felt` (`styles.css:143`)
- **Category**: Accessibility
- **Impact**: **4.22:1** against the gradient's centre colour `#1f5d3a` (it recovers to 6.40:1 at
  the darker `#143f27` edge, so the failure is position-dependent — the banner sits near the
  centre). At 16px bold the text is *not* "large" by WCAG's definition (which needs 18.66px bold or
  24px regular), so the 4.5:1 threshold applies. This is the single most important status message
  in the game: "À vous : piochez une carte".
- **Standard**: WCAG 1.4.3 Contrast (Minimum), Level AA
- **Recommendation**: Lighten the gold for this use (`#f2cd72` measures 5.12:1 on `#1f5d3a`, and `#f7dfa4` 5.98:1), or give
  the banner its own darker plate so the background is deterministic rather than gradient-dependent.
- **Suggested command**: `/impeccable colorize`

#### [P1] Error text fails AA contrast
- **Location**: `client/src/styles.css:59` (`.hint.error`, `--danger` `#e0574f` on `--panel`)
- **Category**: Accessibility
- **Impact**: **4.22:1** at 14px. This is how join and create failures are reported on the Home
  screen (`Home.tsx:106`) — precisely the moment a user most needs to read the text.
- **Standard**: WCAG 1.4.3 (AA)
- **Recommendation**: `#f0796f` measures 5.74:1 on `#182620` and stays clearly in the red family.
- **Suggested command**: `/impeccable colorize`

### P2 — Minor (fix in the next pass)

#### [P2] The bottom sheet paints over the round-result modal
- **Location**: `client/src/styles.css:300` (`.side`, `z-index: 20`) vs `styles.css:236`
  (`.overlay`, `z-index: 10`)
- **Category**: Responsive
- **Impact**: `.game` creates no stacking context (no transform, opacity, filter or z-index of its
  own), so both children resolve in the root context and 20 wins. Phone-only. If a player has the
  chat sheet open when the round ends, a 70vh panel covers the scores. It is recoverable — the
  sheet's own ✕ sits above the overlay and still works — but the topbar toggle does not, since the
  overlay covers it. *(static)*
- **Recommendation**: Raise `.overlay` above the sheet (`z-index: 30`), or close the sheet when
  `state.phase === "finished"`.
- **Suggested command**: `/impeccable adapt`

#### [P2] Empty-table hint fails AA contrast
- **Location**: `client/src/components/Game.tsx:230`, `.hint` (`--muted`) rendered inside `.felt`
- **Category**: Accessibility
- **Impact**: **3.78:1** at the gradient centre. `--muted` is calibrated for the panel background
  (7.60:1 there) and simply was not designed to sit on green felt.
- **Standard**: WCAG 1.4.3 (AA)
- **Recommendation**: Use the felt-local text colour already in the stylesheet — `#cfe3d5` gives
  5.81:1 — rather than the panel's `--muted`.
- **Suggested command**: `/impeccable colorize`

#### [P2] Card labels are announced in English inside a French interface
- **Location**: `client/src/components/CardView.tsx:34`
- **Category**: Accessibility
- **Impact**: `aria-label={`${label} ${card.suit}`}` emits the raw enum: "7 hearts", "R spades".
  The document is `lang="fr"`, so a French screen reader applies French phonetics to English words
  and produces something close to gibberish. For a blind or low-vision player the hand is the
  entire game state.
- **Standard**: WCAG 1.3.1 Info and Relationships / 4.1.2 (A)
- **Recommendation**: Map the suit through a French label table ("7 de cœur", "Roi de pique"), and
  expand `RANK_LABEL` too — "R" reads as the letter R, not "Roi". `SUIT_SYMBOL` already exists in
  `shared`; a `SUIT_LABEL_FR` belongs beside it.
- **Suggested command**: `/impeccable clarify`

#### [P2] The stock pile's accessible name is a bare number
- **Location**: `client/src/components/CardView.tsx:46-53`, used at `Game.tsx:207`
- **Category**: Accessibility
- **Impact**: `CardBack` renders no `aria-label`, so its accessible name is computed from its only
  text content — the card count. The draw button announces itself as "84". Nothing conveys that
  this is the stock pile or that activating it draws a card.
- **Standard**: WCAG 4.1.2 (A)
- **Recommendation**: `aria-label={`Talon, ${count} cartes`}` (and the caption at `Game.tsx:208`
  can then be `aria-hidden`).
- **Suggested command**: `/impeccable clarify`

#### [P2] Chat input has no accessible name
- **Location**: `client/src/components/Chat.tsx:59`
- **Category**: Accessibility
- **Impact**: Only a `placeholder="Message…"`. Placeholders are not labels: they vanish on focus and
  are inconsistently exposed to assistive technology. Every other input in the app is correctly
  wrapped in a `<label>` — this is the one that was missed.
- **Standard**: WCAG 3.3.2 Labels or Instructions (A), 4.1.2 (A)
- **Recommendation**: `aria-label="Message"` (a visible label would crowd the sheet).
- **Suggested command**: `/impeccable harden`

#### [P2] No `prefers-reduced-motion` handling
- **Location**: `client/src/styles.css` (no such media query anywhere)
- **Category**: Accessibility
- **Impact**: Card lift on hover and on selection, button press transforms and the 200 ms sheet
  slide all run unconditionally. The motion here is modest, so this is a gap rather than a hazard —
  but users who have asked the OS for reduced motion are not being heard.
- **Standard**: WCAG 2.3.3 Animation from Interactions (AAA)
- **Recommendation**: A targeted block, not a global kill: drop the `.side` slide to an instant
  show/hide and replace the card's `translateY` lift with an outline or brightness change, so the
  "this card is selected" signal survives. Do **not** blanket-set `animation-duration: 0.01ms`.
- **Suggested command**: `/impeccable animate`

#### [P2] No `color-scheme`, so native controls render light on a dark UI
- **Location**: `client/src/styles.css:1-15`; affects `Home.tsx:123` (checkbox) and `Home.tsx:115`
  (number input)
- **Category**: Theming
- **Impact**: Without `color-scheme: dark` the UA renders form-control chrome in light mode: the
  "tierce franche obligatoire" checkbox and the number input's spinner arrows appear as bright
  white widgets inside a dark green panel. Scrollbars in `.side-body` and `.felt` get the same
  treatment. *(static — deterministic UA behaviour)*
- **Recommendation**: `:root { color-scheme: dark; }`. One line, and it also fixes the scrollbars.
- **Suggested command**: `/impeccable polish`

#### [P2] No focus-visible styling on buttons
- **Location**: `client/src/styles.css:25-43`
- **Category**: Accessibility
- **Impact**: `input:focus` gets a deliberate gold outline; buttons get nothing, so they fall back
  to the UA ring. Nothing suppresses it (there is no `outline: none` anywhere — good), so this is
  not a violation. But the app's 40-odd buttons include the playing cards, whose 7px radius and
  near-white face make the default ring hard to read, and focus visibility is left to chance rather
  than designed.
- **Standard**: WCAG 2.4.7 Focus Visible (AA) — met, but marginally
- **Recommendation**: One rule: `:where(button, [role="button"]):focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }`.
- **Suggested command**: `/impeccable polish`

#### [P2] Turn changes and errors are not announced
- **Location**: `client/src/components/Game.tsx:218-226` (turn banner), `Game.tsx:260` (toast)
- **Category**: Accessibility
- **Impact**: The turn banner is plain text with no `aria-live`, so a screen-reader user is never
  told their turn began — they must poll the page. The toast does carry `role="alert"`, which is
  correct, but it is also a `<div onClick>` with no keyboard path to dismiss (mitigated by the 4s
  auto-clear at `Game.tsx:75-79`).
- **Standard**: WCAG 4.1.3 Status Messages (AA)
- **Recommendation**: `aria-live="polite"` on `.turn-banner`; make the toast a `<button>` or drop
  the click handler and rely on the timer.
- **Suggested command**: `/impeccable harden`

#### [P2] Unread chat count is suppressed by the button's own label
- **Location**: `client/src/components/Game.tsx:165-173`
- **Category**: Accessibility
- **Impact**: `aria-label="Journal et chat"` overrides the contents, so the `{chat.length}` badge
  rendered next to 💬 is never announced. Sighted users see the badge; screen-reader users do not.
- **Recommendation**: Fold the count into the label, e.g.
  `aria-label={chat.length ? `Journal et chat, ${chat.length} messages` : "Journal et chat"}`.
- **Suggested command**: `/impeccable clarify`

### P3 — Polish

#### [P3] `button.tiny` targets are ~20 × 22px
- **Location**: `client/src/styles.css:42`; used at `Home.tsx:84` (forget a seat) and
  `Game.tsx:283` (unstage a meld)
- **Category**: Responsive
- **Impact**: 12px text with 2px/6px padding computes to roughly 20px tall by 22px wide *(static —
  computed from the declared font-size, padding and border)*. This is **not** an AA violation:
  WCAG 2.2 SC 2.5.8 has a spacing exception, and in both call sites the 24px exclusion circles do
  not intersect a neighbouring target (the seat row uses `gap: 12px` next to a full-width button;
  the staging row's 8px neighbour is a `disabled` card, which is not a target). It is still an
  awkward tap on a phone and misses SC 2.5.5 (AAA, 44 × 44).
- **Recommendation**: Give `.tiny` a `min-width: 32px; min-height: 32px` and centre the glyph; the
  visual weight stays small because the glyph does not grow.
- **Suggested command**: `/impeccable adapt`

#### [P3] The round log grows without a bound
- **Location**: `client/src/lib/useGame.ts:58`, rendered at `Chat.tsx:46-50`
- **Category**: Performance
- **Impact**: Chat is correctly capped at 100 entries (`useGame.ts:59`, `c.slice(-99)`), but
  `state.log` is taken from the server wholesale and every line is rendered as a `<p>`. Rooms live
  for seven days; a long session accumulates one DOM node per game event with no windowing.
  Nowhere near a problem at a normal session's scale — worth capping before it is.
- **Recommendation**: Render the last ~200 lines, or cap the log server-side.
- **Suggested command**: `/impeccable optimize`

#### [P3] Remote video presence is read during render
- **Location**: `client/src/components/VideoTile.tsx:23`
- **Category**: Performance
- **Impact**: `stream?.getVideoTracks().some(t => t.enabled && ...)` is evaluated in the render body
  and is not reactive. When a *remote* peer turns their camera off, nothing re-renders the tile, so
  the initials placeholder only appears at the next unrelated state push. Local tiles are fine —
  `camOn` drives a re-render.
- **Recommendation**: Subscribe to the track's `mute`/`unmute`/`ended` events in an effect and hold
  presence in state.
- **Suggested command**: `/impeccable optimize`

#### [P3] Dead code in `CardBack`
- **Location**: `client/src/components/CardView.tsx:46, 51`
- **Category**: Implementation Integrity
- **Impact**: The `label` prop is never passed by any caller and `.pile-label` is defined nowhere in
  the stylesheet — the branch cannot render anything. Small, but it is the one place where the code
  and the stylesheet have drifted apart.
- **Recommendation**: Delete the prop and the span.
- **Suggested command**: `/impeccable distill`

#### [P3] No `aria-controls` on the sheet toggle
- **Location**: `client/src/components/Game.tsx:165-173` / `Chat.tsx:30`
- **Category**: Accessibility
- **Impact**: `aria-expanded` is present and correct, but nothing links the button to the panel it
  expands.
- **Recommendation**: `id` on `<aside className="side">`, `aria-controls` pointing at it.
- **Suggested command**: `/impeccable polish`

---

## Patterns & systemic issues

**1 · Accessibility is per-component rather than systemic.** The individual instincts are good —
`aria-label` on every icon-only button, `aria-pressed` on cards, `aria-expanded` on the toggle,
`role="alert"` on the toast, implicit `<label>` wrapping on five of six inputs. What is missing is
the layer above: nothing owns focus when a modal opens, nothing removes the off-screen sheet from
the tab order, nothing announces state changes, and the one non-`<button>` click target was never
given a keyboard path. These four gaps are the difference between 2/4 and 4/4 and they are a single
focused pass, not a rewrite.

**2 · Colour tokens stop at the panel.** Fourteen custom properties are declared and used 48 times,
but 61 raw hex literals sit alongside them — and the pattern is legible: every *border* colour is
raw (`#27392f` × 8, `#2f4a3b` × 4), and every colour that belongs to the felt or to a playing card
is raw (`#cfe3d5`, `#dfeee4`, `#fdfdf8`, `#c9c9c0`, `#2c4a8a`, `#3b5fa8`…). The token set covers
chrome and never reached the two surfaces the product is actually about. Both AA contrast failures
and the empty-table hint are the same root cause: `--muted` and `--gold` were calibrated against
`--panel` and then reused on the felt, where their contrast is 3.7–4.2:1 instead of 7.6–8.5:1.
A `--felt-text` / `--felt-text-strong` / `--border` / `--border-strong` set would fix the failures
and prevent the next ones.

**3 · Platform configuration, not layout, is where mobile breaks.** The `@media (max-width: 900px)`
block is genuinely careful work — `100dvh`, a sticky action bar, a bottom sheet, `font-size: 16px`
on inputs to defeat iOS zoom-on-focus, horizontally scrolling opponents with the scrollbar hidden.
Every mobile finding in this report is a *declaration* problem sitting next to that good layout
work: one missing `viewport-fit`, one z-index ordering, one `color-scheme`. Three lines of config
are carrying a disproportionate share of the mobile score.

---

## Positive findings

- **Contrast is strong almost everywhere.** 24 of 26 measured text pairs pass AA, most of them
  comfortably: body text 16.20:1, muted text on panel 7.60:1, gold on panel 8.48:1, primary button
  9.85:1, card faces 5.21:1 (red) and 17.72:1 (black). The two failures are both *reuse* of a
  panel-calibrated token on the felt — a narrow, systematic mistake in an otherwise deliberate
  palette, not carelessness.
- **Zero anti-patterns from the detector**, verified against a control. No overused AI-default
  typeface (the stack is Avenir Next → Segoe UI → system-ui, an actual choice), no bounce easing,
  no `transition: all`, no `will-change` left on at rest, no unbounded blur or shadow stacking.
- **Playing cards are real `<button>` elements** with `aria-pressed`, `disabled` when
  non-interactive, and `touch-action: manipulation` to kill the 300ms tap delay. The most important
  interactive surface in the app was built correctly.
- **`useWebRTC` avoids the identity trap.** `peerIds` is a fresh array on every server push, but
  `peerKey` (`useWebRTC.ts:269`) collapses it to a sorted string before it reaches the dependency
  array — so peer connections are not torn down and rebuilt on every state update. That bug is easy
  to write and expensive to diagnose, and it is not here.
- **Storage degrades gracefully.** Every `localStorage` / `sessionStorage` access is wrapped in
  try/catch with a documented fallback, so private mode and quota exhaustion do not break the app.
- **The bundle is lean**: 293.87 kB raw / 91.75 kB gzipped JS and 3.59 kB gzipped CSS, with no
  images, no icon font and no CSS framework. The build is clean under `tsc --noEmit`.
- **`prefers-reduced-motion` aside, motion is already restrained** — 100–200 ms, transform-based,
  compositor-friendly. There is nothing to undo, only a media query to add.

---

## Recommended actions

1. **[P1] `/impeccable harden`** — the accessibility layer: keyboard path on melds, dialog
   semantics + focus management on the round-result overlay, `inert` on the closed bottom sheet,
   `aria-label` on the chat input, `aria-live` on the turn banner.
2. **[P1] `/impeccable adapt`** — `viewport-fit=cover`, overlay above the sheet, `.tiny` target size.
3. **[P1] `/impeccable colorize`** — lift `--gold` on felt and `--danger` on panel above 4.5:1, and
   introduce felt-local and border tokens so the next colour lands correctly by default.
4. **[P2] `/impeccable clarify`** — French card labels, a real name for the stock pile, unread count
   in the toggle's label.
5. **[P2] `/impeccable animate`** — a targeted `prefers-reduced-motion` alternative that preserves
   the selection signal.
6. **[P3] `/impeccable extract`** — promote the 61 raw hex values into the token set.
7. **[P3] `/impeccable optimize`** — cap the log, make remote video presence reactive.
8. **[P3] `/impeccable polish`** — `color-scheme: dark`, `:focus-visible`, `aria-controls`, and
   remove the dead `CardBack` label branch.

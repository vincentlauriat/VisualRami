---
name: VisualRami
description: Rami 51 around a felt table, with the players' faces seated at its edge.
colors:
  felt: "#1f5d3a"
  felt-dark: "#143f27"
  table-rim: "#3a2a16"
  gold: "#e6b84f"
  gold-dark: "#b98b23"
  gold-ink: "#1a1500"
  gold-rim: "#f7da8e"
  card-face: "#fdfdf8"
  card-edge: "#c9c9c0"
  card-red: "#c8322b"
  card-black: "#14161c"
  card-back: "#2c4a8a"
  card-back-light: "#3b5fa8"
  bg: "#0f1a14"
  panel: "#182620"
  panel-2: "#213328"
  panel-hover: "#2b4334"
  control-face: "#2b4334"
  control-face-hover: "#34513f"
  control-rim: "#45664f"
  control-side: "#1c2e24"
  control-edge: "#0a110c"
  field: "#0e1712"
  video-well: "#0b110d"
  border: "#27392f"
  border-strong: "#2f4a3b"
  text: "#f1f5f2"
  muted: "#a9b8ae"
  felt-text: "#cfe3d5"
  felt-text-strong: "#dfeee4"
  felt-accent: "#f2cd72"
  danger: "#f0796f"
  danger-surface: "#3a1f1d"
  presence: "#4cd07d"
typography:
  display:
    fontFamily: "Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
  headline:
    fontFamily: "Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
  title:
    fontFamily: "Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
  body:
    fontFamily: "Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
  label:
    fontFamily: "Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    fontFeature: "tnum"
  room-code:
    fontFamily: "monospace"
    fontSize: "34px"
    letterSpacing: "6px"
  card-rank:
    fontFamily: "Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
rounded:
  card: "7px"
  control: "8px"
  tile: "10px"
  panel: "12px"
  sheet: "16px"
  felt: "40px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button:
    backgroundColor: "{colors.control-face}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-hover:
    backgroundColor: "{colors.control-face-hover}"
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.gold-ink}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-ghost:
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "18px"
  tag:
    backgroundColor: "{colors.panel-hover}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "2px 7px"
  tag-you:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.gold-ink}"
    rounded: "{rounded.pill}"
  playing-card:
    backgroundColor: "{colors.card-face}"
    textColor: "{colors.card-black}"
    rounded: "{rounded.card}"
    width: "58px"
    height: "82px"
  playing-card-back:
    backgroundColor: "{colors.card-back}"
    rounded: "{rounded.card}"
    width: "58px"
    height: "82px"
  video-tile:
    backgroundColor: "{colors.video-well}"
    rounded: "{rounded.tile}"
  toast-error:
    backgroundColor: "{colors.danger-surface}"
    textColor: "#ffd9d6"
    rounded: "{rounded.control}"
---

# Design System: VisualRami

## Overview

**Creative North Star: "La Table du Soir"**

A card table under a lamp, in someone's home, late enough that the room around it has gone dark.
The felt is the only lit surface; the cards are the brightest things on it; the faces of the players
sit at its edge. Everything else (buttons, panels, the log) is the dim room: present, reachable,
and deliberately quieter than the table.

The system is dark by necessity as much as by mood. It is played on a phone at arm's length, often
in the evening, and the cards must stay the highest-contrast object on screen. Gold is the lamp:
it marks what is *yours right now* (your turn, your selection, your seat, the one action that
moves the game forward) and almost nothing else. Density follows the device: the phone layout is
tight and stacked, the laptop layout spreads the table and seats five opponents around it.

Controls are **tactile and assertive**, like chips standing on the felt: each raised control
shows a lit rim on top and a darker edge below, and sinks flush when pressed. Volume comes from
tone and border, never from a shadow, so the Objects Cast Shadows Rule holds.

**Key Characteristics:**
- One lit surface: the felt, a radial green gradient inside a dark wood rim.
- Ivory cards as the brightest, most legible objects on screen.
- Gold reserved for "yours, now": turn, selection, seat, primary action.
- Dark green panels for everything that is not the table.
- Controls stand on an edge and sink when pressed; unavailable ones lie flush.
- Faces are part of the table: video tiles carry turn state and laid-down status.
- Four layout tiers: desktop, phone portrait, tablet portrait, phone landscape.

## Colors

A warm-dark palette built from the materials of a card table: green felt, brass, ivory, dark wood.

### Primary
- **Vert de feutre** (felt / felt-dark): the playing surface only. A radial gradient from the lit
  centre to the darker edge; never used for panels, buttons or page background.
- **Bois de bordure** (table-rim): the wooden rim around the felt. One use.

### Secondary
- **Laiton chaud** (gold / gold-dark / gold-ink): the lamp. Primary buttons, the selected card's
  ring and order badge, the active player's tile border, your own "vous" tag, the room code, the
  active tab, the winner's row. Text on gold is always gold-ink, never white.
- **Laiton sur feutre** (felt-accent): a lighter brass for text that sits *on the felt*, where
  plain gold drops to 4.2:1. Used for "À vous" in the turn banner.

### Tertiary
- **Ivoire de carte** (card-face, card-edge): card faces. Suits in card-red and card-black.
- **Dos de carte** (card-back, card-back-light): the stock, and the miniature hand counts of
  opponents. The only blue in the system, so a face-down card is unmistakable at a glance.

### Neutral
- **Nuit** (bg): page background, under a faint radial lift at the top left.
- **Salle sombre** (panel, panel-2, panel-hover, field, video-well): panels, buttons, hover,
  input wells and empty video tiles, in steps of tone rather than lines.
- **Filets** (border, border-strong): 1px dividers and control outlines.
- **Texte** (text, muted): primary and secondary text on panels.
- **Texte sur feutre** (felt-text, felt-text-strong): captions and the turn banner on the felt,
  calibrated to hold ≥5:1 against its lit centre.
- **Alerte** (danger, danger-surface): errors, the "off" state of mic and camera buttons, and the connection-lost strip.
- **Présence** (presence): the "connected" dot in the lobby. One use.

### Named Rules
**The Lamp Rule.** Gold means "yours, now". If an element is not the current player's turn,
selection, seat or next action, it is not gold. In practice: the two piles take a gold ring while
it is your turn to draw; Défausser and Poser are gold only once they can actually be pressed; only
the melds that will accept your selection light up; another player's "posé" badge is neutral.

**The Two Surfaces Rule.** Text on the felt uses the felt-text family; text on panels uses
text / muted. The panel colours lose contrast on the felt's lit centre, so they never cross over.

**The Blue Back Rule.** Blue appears only on card backs. Nothing interactive is blue.

## Typography

**Body Font:** Avenir Next (with Segoe UI, system-ui, sans-serif)
**Label/Mono Font:** the platform monospace, for room codes only

**Character:** A single humanist sans throughout, chosen to read cleanly on a small screen, with
no display face competing with the cards. Monospace appears only where characters must be
copied exactly: the five-letter table code.

### Hierarchy
- **Display** (700, 34px): the product name on the home screen only.
- **Headline** (700, 22px; 16px on phones): the top bar title with the drawn mark.
- **Title** (700, 17px): panel headings and the round-result title.
- **Body** (400, 16px): forms, rules, chat. Inputs stay at 16px on phones to prevent iOS zoom.
- **Label** (400, 11–14px, tabular figures): hints, captions, scores, card counts, log lines.
  Anything on or under a seat (name pill, "posé", card count and score) is 12px at least: the strip
  is read at arm's length.
- **Room code** (monospace, 34px, 6px tracking): the code to share, in gold.
- **Card rank** (700, 15px; 12–13px on small cards): the corner of every card face.

### Named Rules
**The Tabular Rule.** Every number that changes during play (scores, card counts) uses
tabular figures, so columns do not shift as values update.

## Layout

The table is the layout. On desktop (> 900px) the players **sit around the felt**. Opponents take
their seats clockwise from your left, in turn order, so the next player is on your left: with one
or two opponents they sit across the top; from three on, the first and last take the left and
right edges and the others share the top (six players: one left, three across, one right). You sit
at the bottom, your hand below the felt. Each player's melds lie on the felt **in front of their
own face**, in their zone; yours sit right above your hand. A top column never squeezes a zone
narrower than its longest meld, and spare width is shared out, so a zone stays under its seat and
in seat order even when one player has laid much more. The piles and the turn line sit together at the centre of the felt at
every player count (with two or three players they used to stand 750–900px apart at its two
ends); with side seats the piles shrink (46×64, no captions). Between 901 and 1365px a hand of 15
cards or more closes up by 4px a card so it stays on one row. The felt keeps at least 200px.

From 1366px up a 260px log/chat column sits beside the table; below that (901–1365px) the log and
chat come in as a drawer from the right behind the chat button, so the seats and the felt get the
whole width.

**Phone portrait** (< 600px wide): the whole table fits one screen and nothing outside the felt
scrolls. The top bar keeps one row (icons only, the table code without its "table" prefix, no mark, the unread count riding on the chat icon) and holds at 360px with a wide code, the badge
or an armed Quitter. Your own seat joins the opponents' strip, pinned at its head while the
others scroll past it (an 18px fade to night on its right edge, so a tile passing under it
dissolves instead of showing sliced; at rest the strip starts 18px further so no name or count
sits under the fade), so the strip's turn-following scroll never pushes you off screen; and sort, clear, prepare and discard share a single action
row; while melds are staged, "Poser" takes the sort buttons' place. The staging tray leads the
felt, the piles shrink once you have drawn, a 15-card hand fans into two rows of eight, and the
strip scrolls itself to the seat whose turn it is.

At ≤ 900px the game becomes a single column in natural document flow: opponents in a horizontal
scroll strip, the felt, then your hand, with sort and play actions in a sticky bar at the bottom.
The log and chat become a bottom sheet behind a 💬 button.

- **Tablet portrait** (600–900px wide, ≥ 700px tall): the same single column, with near-desktop
  card and tile sizes and the actions back on one row.
- **Phone landscape** (≤ 900px wide, ≤ 520px tall): a two-column grid, opponents stacked in a
  narrow left rail and the felt plus hand on the right. Your own face joins the rail (first,
  "(vous)" read out only) instead of taking a row above the hand, and the turn line sits beside
  the piles: at 844×390 the felt grows from 139 to 187px. The log slides in from the side.
- **Coarse pointer, any width:** every button reaches 44px; tabs 48px.

At ≤ 900px the faces stay in the strip and the melds are **grouped by player on the felt**: one row
per player, led by their name in a fixed 64px column, in seat order with yours last, nearest your
hand. Players who have laid nothing get no row. Touching a face in the strip scrolls the felt to
that player's row and briefly lights it.

Spacing runs on a loose 4px rhythm, most often 8, 12 and 16px. The game gutter is 14px on
desktop and follows the safe-area insets on phones.

## Elevation & Depth

Depth belongs to physical objects on the table and nowhere else. Panels, buttons and the page are
flat and separated by tone and 1px borders. Shadows appear only on things you could pick up
or that sit in the table: cards, the felt's inset, a lifted selected card, and the mobile sheet
sliding over the table.

### Shadow Vocabulary
- **Card resting** (`box-shadow: 0 2px 4px rgba(0,0,0,0.35)`): every card on the felt or in hand.
- **Card lifted** (`box-shadow: 0 0 0 3px #e6b84f, 0 6px 10px rgba(0,0,0,0.4)` with a 14px
  upward translate): the selected card. The gold ring is the selection; the shadow is the lift.
- **Felt well** (`box-shadow: inset 0 0 40px rgba(0,0,0,0.4)`): the felt sits below the rim.
- **Active seat** (`box-shadow: 0 0 0 3px rgba(230,184,79,0.25)` with a gold border): the
  video tile of the player whose turn it is.
- **Sheet** (`box-shadow: 0 -8px 30px rgba(0,0,0,0.5)`): the log/chat bottom sheet on phones.

### Named Rules
**The Objects Cast Shadows Rule.** If it is not a card, the felt or a sheet sliding over the
table, it has no shadow. Panels separate by tone.

## Shapes

Corners scale with the object's size and physicality: cards 7px, like real cards; controls 8px;
video tiles and melds 10px; panels 12px; the felt 40px on desktop (18–24px on smaller screens),
so the table reads as a rounded table, not a box. Tags, the reconnecting toast and the video name
badge are full pills. Card faces are flat ivory with a thin edge; the card back carries the only
pattern in the system, a 45° stripe inside an inset frame.

## Components

### Buttons
Tactile and assertive: a raised control is a chip on its edge.
- **Shape:** gently rounded (8px). Raised controls have a 1px lit rim on top (control-rim), 1px
  sides (control-side) and a 3px edge below (control-edge). Weight 500.
- **Default:** control-face fill, text colour, 8px 14px padding.
- **Primary:** gold fill, gold-ink text, gold-rim on top, gold-dark sides and edge, weight 600.
  One per context, the action that moves the game forward (draw, lay down, discard, create).
- **Ghost:** flat on purpose — transparent fill, 1px border-strong outline, no edge. Leave,
  dismiss, close and the chat toggle are ghosts; tabs are flat too.
- **Link:** a secondary way out, not a control: muted underlined text, no fill or edge, 44px tall.
  "Créer une autre table" and "Saisir un autre code" under the invitation card.
- **Tiny:** 32px square minimum (44px on touch), for dismiss and remove. Always ghost.
- **Off:** danger border on every side, for a muted mic or camera.
- **Icons:** drawn SVG on a 24-unit grid, 1.75 stroke, `currentColor`, 1.15em, 6px from the label.
  No emoji anywhere. The brand mark is drawn too: an ivory card with a red heart fanned over a
  card-back-blue card (the blue is a card back, so the Blue Back Rule holds); the favicon is the
  same drawing.
- **Hover / Focus / Press:** hover lightens the face (control-face-hover) on pointer devices only;
  focus is a 2px gold outline offset 2px. Press collapses the edge to 1px and drops the face 2px
  with no layout shift. Disabled lies flush the same way, at 45% opacity: available controls
  stand up, unavailable ones do not.

### Cards / Containers
- **Panel:** panel fill, 1px border, 12px radius, 18px padding. Home, lobby and the round result.
- **Lobby:** "Copier le lien" is the gold action (the link is what travels to the others), next
  to the code on the same line even on a phone; "Copier le code" follows and may wrap. For the
  host, once a second player is in, "Lancer la partie" takes the lamp and the link goes neutral.
- **Page background:** the radial lift is painted once at the top, then plain night: it never
  repeats into a seam on a long page.
- **Home:** exactly one gold button, the visitor's likely next step: Rejoindre once a full code is
  typed, else Reprendre (the most recent remembered seat) when there is one, else Créer la table.
  The hero line and the rules run at most about 70 characters per line on a desktop.
- **Invitation card:** arriving by a `?table=CODE` link shows only that table, in one panel at most
  460px wide: "Rejoindre la table CODE" (the code in plain text: the button is the lamp), the name
  field and the gold "Rejoindre la table"; or, with a seat remembered for that code, "Reprendre la
  table CODE" and a gold "Reprendre". Errors land on the card ("Table introuvable : vérifiez le
  code"), with a "Saisir un autre code" link back to the full home. "Créer une autre table" unfolds
  the create panel below, never gold.
- **Rules:** one list of short sentences with a bold lead word ("Première pose :"), used on the
  home page and in the table's Règles tab, where the first-laydown line follows the room's real
  threshold and pure-run option.
- **Selection points:** while cards are selected, a neutral pill (panel-2, border-strong, 13px)
  floats just above the hand: "3 cartes · 27 pts", and before your first laydown, for a real
  meld, "· encore 24 pour 51". Information, so never gold; a message above the hand takes its
  place.
- **Staging area:** panel fill, border-strong, 10px radius, holding melds before a laydown.
- **Round result:** a panel laid on the felt in place of the piles, never a modal and never a scrim:
  faces, log and chat stay lit and usable while the table talks the round over. A labelled region
  whose heading takes focus when it appears ("Bruno remporte la manche", no emoji), with the action
  on the same line: Nouvelle manche (gold) for the host, a Prêt toggle for the others (gold until
  pressed, then a raised check "Prêt"), and a status line saying who is ready. One row per player,
  winner first with a gold outline and "0 (gagnant)"; every other hand face up as whole small cards
  (38×53, 32×45 on phones) in a row that scrolls sideways, its points, "×2 : pas posé" in danger
  when doubled, and the running total. On phones it leads the felt and the rows put the cards on
  their own line. The winner's video tile is the hero: gold frame and a gold pill along its top, a
  drawn crown and "remporte la manche" (on a 92px phone seat "gagne" on one line, the full words
  still read out). Between rounds the hand is only to look at and the action bar is gone, so Prêt /
  Nouvelle manche is the only control asking for a press.

### Inputs / Fields
- **Style:** field well, 1px border-strong, 8px radius, 9px 12px padding, gold caret.
- **Focus:** 2px gold outline, offset 1px.
- **Code input:** uppercase monospace, 20px, 4px tracking.

### Navigation
A single top bar: the drawn mark and title on the left, table code tag (4px 8px: the text never
touches its pill), mic/camera controls and leave
button on the right. On phones the brand word hides, buttons reach 44px, and a chat toggle (its
unread count a small bubble on the icon's corner) opens the log/chat sheet. The side panel has three tabs (Journal, Chat, Règles), the message field only under
Chat; one unread count, the others' messages that arrived since the Chat tab was last in view
(open on a wide screen, or in the drawer or sheet), shown on the Chat tab, the button, its phone
bubble and its spoken label, and back to zero as soon as you read; the active tab takes
panel-2 and gold text. Leaving takes two presses: the first replaces the ghost Quitter with
"Quitter la table ?", a ghost Quitter with a danger outline and a ghost Rester (never gold:
leaving is not the lamp's action). The question takes focus, Escape or Rester puts it away, and
it disarms by itself 5 s after focus leaves it. On phones it takes the whole right of the bar and
the buttons carry the question.

### Playing Card (signature)
The object the whole system serves. 58 × 82px on desktop, 48 × 68px on phones, 44 × 62px when
small. Ivory face, rank and suit stacked in the top-left corner, a large suit glyph in the centre.
Jokers carry a pale tri-colour gradient and violet ink, with a drawn jester's cap (three bells,
the icon family's stroke) in the centre. The card you just drew carries a small felt-green pip in
its top-right corner until your turn ends, and settles into the hand from 10px above in 0.35s
(none under reduced motion). Selected cards lift and take a gold ring
plus a numbered gold badge giving selection order. Keyboard focus uses a 3px *white* outline,
because gold already means "selected". In melds, cards overlap by 14–16px.

### Video Tile (signature)
A 4:3 dark well with the live video, mirrored for yourself, the player's name in a translucent
one-line pill at the bottom left that holds the name only (a long name ends in an ellipsis; six
to eight letters stay whole on a 92px phone seat). Your own "(vous)" follows it, except in the
phone strip, where the first mirrored seat already says it and the word is only read out. "Posé"
is a corner chip at the top left (gold on your own tile, neutral on others'), opposite the
muted-mic pip; a status pill along the top (absent, winner) pushes both chips just below it. When the camera is off, or the peer
reports it off, the player's initials replace the video. The tile of the player whose turn it
is takes a gold border and glow. An absent player's face and name drop to 50% opacity under a
full-strength pill along the top, "absent · sa place est gardée" (only "absent" shows on a 92px
phone seat; the rest is still read out). While your own connection is down nobody's presence is
known, so no tile says absent. A muted microphone shows as the drawn mic-off glyph, in the off
state's pale red, in a 24px dark pip at the top right, so it never takes width from the name; it
carries its own label ("Micro coupé : Bruno") and is hidden on an absent tile. On a 92px phone
seat an absent tile shows the pill, a smaller initial between it and the name, and no "posé".

### Meld
Cards fanned like a hand held closed, on an 18% black wash: every card but the last shows only its
index strip (21px on phones, 18px at the seats, where cards are 38×53). A strip is a narrower
card, not a negative-margin overlap, so a long run takes its honest width in the layout. The owner
is the seat the meld lies in front of, so the meld carries no name. When your selection can extend
it, or swap out its joker, it becomes a button with a gold border and a gold wash on hover and
press; melds the selection cannot join stay plain.

### Seat Zone
Each player's melds sit together in a zone. The zone of the player whose turn it is gets a quiet
lit edge (5% ivory wash, 18% felt-text inset line), not gold: the gold frame on the face already
says whose turn it is. **A first laydown is a table event:** the opener's zone flashes ivory and
fades over 3.6s, with a "1re pose · 67 pts" pill, seen by every player and announced in a polite
live region; reduced motion keeps a steady highlight for the same 4 seconds instead of the fade.

### Discard while staging
Discarding ends the turn and abandons staged melds, so while the tray holds anything Défausser
is not gold and takes two presses: the first turns it into "Défausser quand même" ("Défausser ?" on
phones, where the full words stay its accessible name), a ghost with a danger outline like the
armed Quitter, never gold (Poser stays the lamp), and says why on the turn banner; changing
the selection disarms it. Phone action buttons share the row by their words and never wrap.

### Staging Tray
Melds prepared for a laydown wait on the felt, above the table's melds, inside a dashed
felt-accent tray on a 22% black wash: on the table, not laid yet. For the first laydown it carries
a gauge toward the threshold (felt-text, turning felt-accent once reached; it fills by
`scaleX` from the left, not by width, and holds still under reduced motion), "N / 51 pts · encore M",
and a pure-run marker. Its button reads "Poser sur la table" where it fits and "Poser" on phones
(the same words, the tail hidden). A laydown must leave one card to discard: when everything in
hand is prepared, Poser lies flush and not gold, and the turn line says "Gardez une carte pour
défausser : retirez-en une de la préparation". Touching a prepared (dimmed) card in the hand takes
that card back: its combination keeps the rest if they still form one, and is undone otherwise.

### Turn Banner
The current turn in felt-text-strong ("À vous" in felt-accent), with one line of guidance below
in felt-text that names the next possible move. Offline it loses the accent ("À vous de piocher"
in felt-text-strong) and the guidance says the table resumes when the connection is back.

### Connection Lost
When your own link drops, an Alerte strip (danger-surface, 1px danger border, 8px radius, the
drawn offline glyph) reads "Connexion perdue — reconnexion…" between the top bar and the table,
sticky on phones. It lives in a polite status region that is always mounted and takes no room
while empty. Until the seat is back the piles turn back into pictures and every action that
would reach the server (draw, prepare, lay, discard, chat, new round, start) lies flush and
disabled; sorting the hand still works. In the lobby the same message is the bottom pill.

## Do's and Don'ts

### Do:
- **Do** keep the felt the only green surface, and the cards the brightest objects on screen.
- **Do** reserve gold for the current player's turn, selection, seat and next action (The Lamp Rule).
- **Do** use felt-text and felt-accent for any text placed on the felt.
- **Do** give every number that changes during play tabular figures.
- **Do** size every touch control to 44px on coarse pointers, at any viewport width.
- **Do** keep keyboard focus on cards white, distinct from the gold selection ring.
- **Do** give raised controls their edge (3px below, lit rim above) and keep ghosts, tabs and tiny buttons flat.
- **Do** honour `prefers-reduced-motion`: no lifts or slides, selection survives through the ring.

### Don't:
- **Don't** put a shadow on a panel, a button or the page; shadows belong to cards, the felt and sheets.
- **Don't** use blue for anything but card backs.
- **Don't** put panel text colours (muted, gold) directly on the felt.
- **Don't** put white text on gold; use gold-ink.
- **Don't** use emoji as control icons; draw them on the 24-unit grid at 1.75 stroke.
- **Don't** introduce a second typeface beyond the sans and the room-code monospace.

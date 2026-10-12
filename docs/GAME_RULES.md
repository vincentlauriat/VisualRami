# Game rules — Rami 51 as implemented

## Material and deal

- Two 52-card decks plus 4 jokers (108 cards).
- 2 to 6 players, 14 cards each (6 × 14 + 1 = 85 cards dealt, 23 left in the stock). One card opens the discard pile; the rest is the stock.
- The first player of round *n* is player *n* (rotating). The first player draws immediately.

## Turn

1. **Draw** one card: the top of the stock, or the top of the discard pile.
2. **Play** (optional, any number of times): lay down melds, extend melds on the table, swap a joker.
3. **Discard** one card. You may not discard the card you just took from the discard pile, unless it
   is the last card in your hand.

When the stock is empty, the discard pile except its top card is shuffled into a new stock. This happens
at most **3 times** in a round, and the log counts them ("La pioche est vide : la défausse est mélangée
(2/3)"). When a player draws from the empty stock after the third reshuffle, the round is **drawn** (see
below). Taking the discard pile's top is still allowed at any time. Once the stock is empty with no
reshuffle left, the table says so before anyone draws: the stock reads "Piocher ici termine la manche
(manche nulle)", and the player who must draw sees it in the turn hint too.

## Melds

| Meld | Definition |
|---|---|
| Run | 3+ consecutive cards of one suit, in order. Ace is low (A-2-3) or high (Q-K-A), never both, no wrap-around. |
| Set | 3 or 4 cards of one rank, all suits different. |

Jokers may take any position but never outnumber the real cards of a meld.

## First laydown

All melds laid down in the same action must total **at least 51 points** (room option, 0 to 100) and include a
**pure run** — a run without joker (room option). Points: ace 11 when high, 1 when low; J, Q, K 10;
others face value; a joker counts as the card it replaces. A player may not lay down their whole
hand: one card must remain to discard.

## After the first laydown

- Add cards to any meld on the table, yours or not, at either end of a run or as the 4th card of a set.
- Take a joker back from any meld by placing the real card it stands for; the joker returns to your hand.

## End of round and scoring

The round ends when a player discards their last card. Each other player adds the cards left in hand:
joker 20, ace 11, faces 10, others face value, **doubled** if they never laid down. The winner scores 0.
Scores accumulate across rounds; the lowest total wins.

**Drawn round.** When the stock runs out a fourth time (a draw from it after 3 reshuffles), the round stops
with no winner ("Talon épuisé 3 fois : manche nulle" in the log). Every player counts their hand with the
same scale, doubled for those who never laid down. The panel reads "Manche nulle : talon épuisé" and shows
every hand. The next round is dealt as usual. This ends rounds where nobody can go out, typically at a high
first-laydown threshold; tables created before the 100-point cap keep their threshold and rely on it.

Accepted limit: the rule waits for a draw from the stock. A table of humans only, where everyone keeps
taking the discard pile's top after the third reshuffle, never draws the round. A computer player or an
absent player played automatically ends it: the bot takes the discard only for a card it lays this turn,
and the automatic turn draws from the stock.

At the end of the round every losing hand is turned face up for the whole table, with its points ("×2 : pas
posé" when the player never laid down) and each player's running total; the winner shows "0 (gagnant)".
The other players press **Prêt** when they are ready for the next round, and the host, who sees who is
ready, deals it with **Nouvelle manche**. Readiness starts empty at every round.

## Leaving and coming back

A started game stays open for 7 days of inactivity and survives a server restart. A player who closed the
browser comes back from the home page ("Reprendre une partie"), or from any device by entering the table
code and the **same first name**. Only a disconnected seat can be taken back this way.

## Absent players

If the player whose turn it is stays disconnected for 45 seconds, the server draws from the stock and
discards for them. If the host disconnects, the host role moves to a connected player.

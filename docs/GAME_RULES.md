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

When the stock is empty, the discard pile except its top card is shuffled into a new stock.

## Melds

| Meld | Definition |
|---|---|
| Run | 3+ consecutive cards of one suit, in order. Ace is low (A-2-3) or high (Q-K-A), never both, no wrap-around. |
| Set | 3 or 4 cards of one rank, all suits different. |

Jokers may take any position but never outnumber the real cards of a meld.

## First laydown

All melds laid down in the same action must total **at least 51 points** (room option) and include a
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

## Leaving and coming back

A started game stays open for 7 days of inactivity and survives a server restart. A player who closed the
browser comes back from the home page ("Reprendre une partie"), or from any device by entering the table
code and the **same first name**. Only a disconnected seat can be taken back this way.

## Absent players

If the player whose turn it is stays disconnected for 45 seconds, the server draws from the stock and
discards for them. If the host disconnects, the host role moves to a connected player.

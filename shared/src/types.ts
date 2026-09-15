export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

/** 1 = Ace, 11 = Jack, 12 = Queen, 13 = King */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  id: string;
  suit: Suit | null;
  rank: Rank | null;
  joker: boolean;
}

export type MeldKind = "run" | "set";

export interface Meld {
  id: string;
  kind: MeldKind;
  cards: Card[];
  ownerId: string;
}

export interface GameOptions {
  /** Minimum points for the first laydown (French "Rami 51"). */
  firstMeldMinPoints: number;
  /** Require at least one pure run (no joker) in the first laydown. */
  requirePureRun: boolean;
  /** Number of cards dealt to each player. */
  handSize: number;
}

export const DEFAULT_OPTIONS: GameOptions = {
  firstMeldMinPoints: 51,
  requirePureRun: true,
  handSize: 14,
};

export type Phase = "lobby" | "draw" | "play" | "finished";

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  hasLaidDown: boolean;
  /** Cumulative score across rounds (lower is better). */
  score: number;
  connected: boolean;
}

export interface GameState {
  roomId: string;
  hostId: string;
  options: GameOptions;
  players: Player[];
  stock: Card[];
  discard: Card[];
  melds: Meld[];
  currentIndex: number;
  phase: Phase;
  /** Card id taken from the discard pile this turn (cannot be discarded again). */
  drewFromDiscardCardId: string | null;
  winnerId: string | null;
  round: number;
  /** Last round result, for display. */
  lastRoundPoints: Record<string, number> | null;
  log: string[];
}

/** What a given player is allowed to see. */
export interface PublicPlayer {
  id: string;
  name: string;
  handCount: number;
  hasLaidDown: boolean;
  score: number;
  connected: boolean;
}

export interface PublicGameState {
  roomId: string;
  hostId: string;
  options: GameOptions;
  players: PublicPlayer[];
  you: { id: string; hand: Card[] };
  stockCount: number;
  discardTop: Card | null;
  discardCount: number;
  melds: Meld[];
  currentPlayerId: string | null;
  phase: Phase;
  drewFromDiscardCardId: string | null;
  winnerId: string | null;
  round: number;
  lastRoundPoints: Record<string, number> | null;
  log: string[];
}

export type GameAction =
  | { type: "start" }
  | { type: "draw"; source: "stock" | "discard" }
  | { type: "layDown"; melds: string[][] }
  | { type: "extend"; meldId: string; cardIds: string[]; position: "start" | "end" }
  | { type: "swapJoker"; meldId: string; cardId: string }
  | { type: "discard"; cardId: string }
  | { type: "newRound" };

export type GameError = { ok: false; error: string };
export type GameOk = { ok: true; state: GameState };
export type GameResult = GameOk | GameError;

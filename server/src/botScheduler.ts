import { currentPlayer, planTurn, toPublicState, type GameAction, type GameState, type PublicGameState } from "@visualrami/shared";
import type { Room, RoomManager } from "./rooms.js";

/** How fast a computer player moves, so its draw, laydown and discard can be followed one by one. */
export interface BotPacing {
  /** Delay before each action: a random value between the two. */
  minMs: number;
  maxMs: number;
  /** Delay before the discard, give or take 15%: the turn's last move gets a beat more. */
  discardMs: number;
  /** Delay before a computer player says it is ready for the next round. */
  readyMs: number;
}

export const DEFAULT_BOT_PACING: BotPacing = { minMs: 800, maxMs: 1200, discardMs: 1500, readyMs: 1200 };

export interface BotSchedulerOptions {
  pacing?: BotPacing;
  random?: () => number;
  /** The decision function (tests). It only ever receives the bot's public view. */
  planner?: (view: PublicGameState) => GameAction[];
}

/** Retry delays after a move that could not be played at all: 2 s, 4 s, … up to 30 s. */
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30_000;

/**
 * Plays the computer players, one timer per table. A broadcast only re-arms the timer; the move
 * is planned when the timer fires, on the public view of the bot's seat (never the full state),
 * and goes through the reducer like a human's. The table pauses while no human is connected.
 * Nothing here may throw back into the broadcast that called it: a failure falls back to a
 * plainer move, then to a retry later.
 */
export class BotScheduler {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly failures = new Map<string, number>();
  private readonly pacing: BotPacing;
  private readonly random: () => number;
  private readonly planner: (view: PublicGameState) => GameAction[];
  private stopped = false;

  constructor(
    private readonly rooms: RoomManager,
    /** Called after each move, with the room: the server broadcasts it, which re-arms the timer. */
    private readonly onChange: (room: Room) => void,
    options: BotSchedulerOptions = {},
  ) {
    this.pacing = options.pacing ?? DEFAULT_BOT_PACING;
    this.random = options.random ?? Math.random;
    this.planner = options.planner ?? ((view) => planTurn(view));
  }

  /** Re-arm the table's timer if a computer has something to do. Cheap: no search happens here. */
  schedule(room: Room): void {
    this.cancel(room.id);
    if (this.stopped || !this.rooms.hasHumanPresent(room) || !botToMove(room.state)) return;
    const failures = this.failures.get(room.id) ?? 0;
    const delay = failures > 0 ? Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (failures - 1)) : this.stepDelay(room.state);
    this.arm(room.id, delay, () => this.fire(room.id));
  }

  /** Whether a move is waiting at this table (tests). */
  isArmed(roomId: string): boolean {
    return this.timers.has(roomId);
  }

  stop(): void {
    this.stopped = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private arm(roomId: string, delay: number, run: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(roomId);
      if (!this.stopped) run();
    }, delay);
    timer.unref();
    this.timers.set(roomId, timer);
  }

  private cancel(roomId: string): void {
    const timer = this.timers.get(roomId);
    if (timer) clearTimeout(timer);
    this.timers.delete(roomId);
  }

  private stepDelay(state: GameState): number {
    const { minMs, maxMs, readyMs } = this.pacing;
    return state.phase === "finished" ? readyMs : minMs + (maxMs - minMs) * this.random();
  }

  /** The move is due: plan it on the table as it is now. */
  private fire(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room || !this.rooms.hasHumanPresent(room)) return;
    const botId = botToMove(room.state);
    if (!botId) return;
    const view = toPublicState(room.state, botId);
    let action: GameAction | null;
    if (room.state.phase === "finished") action = { type: "ready", ready: true };
    else {
      try {
        action = this.planner(view)[0] ?? safeMove(view);
      } catch (err) {
        console.error("bot planning failed", err);
        action = safeMove(view);
      }
    }
    if (!action) return this.failed(room);
    if (action.type !== "discard") return this.play(room, botId, action);
    // The discard waits a beat more. The table may change meanwhile (a human leaves, the turn is
    // replayed after a restore): the planned discard then no longer applies and is dropped. A
    // broadcast during the beat re-arms the timer, which plans again on the new state.
    const planned = room.state;
    const extra = Math.max(0, this.pacing.discardMs * (0.85 + 0.3 * this.random()) - this.pacing.maxMs);
    this.arm(roomId, extra, () => {
      const live = this.rooms.get(roomId);
      if (!live || live.state !== planned || !this.rooms.hasHumanPresent(live)) return;
      this.play(live, botId, action);
    });
  }

  /** Apply the move, falling back to the plainest legal move, then to a whole minimal turn. */
  private play(room: Room, botId: string, action: GameAction): void {
    try {
      if (this.rooms.act(room, botId, action).ok) return this.succeeded(room);
      console.error("bot move refused", action.type);
      const fallback = safeMove(toPublicState(room.state, botId));
      if (fallback && this.rooms.act(room, botId, fallback).ok) return this.succeeded(room);
      console.error("bot fallback refused", fallback?.type);
      if (this.rooms.playBotLastResort(room, botId)) return this.succeeded(room);
    } catch (err) {
      console.error("bot move failed", err);
    }
    this.failed(room);
  }

  private succeeded(room: Room): void {
    this.failures.delete(room.id);
    this.onChange(room);
  }

  /** Nothing could be played: try again later, a little later each time. */
  private failed(room: Room): void {
    const failures = (this.failures.get(room.id) ?? 0) + 1;
    this.failures.set(room.id, failures);
    console.error(`bot stuck at table ${room.id}, retry ${failures}`);
    this.schedule(room);
  }
}

/** The computer player that has a move to make now: the current player, or one not yet ready. */
function botToMove(state: GameState): string | null {
  if (state.phase === "finished") return state.players.find((p) => p.isBot && !state.ready.includes(p.id))?.id ?? null;
  if (state.phase !== "draw" && state.phase !== "play") return null;
  const current = currentPlayer(state);
  return current?.isBot ? current.id : null;
}

/** The plainest legal move, from the bot's own view: draw from the stock, or discard a card that may go back. */
function safeMove(view: PublicGameState): GameAction | null {
  if (view.phase === "draw") return { type: "draw", source: "stock" };
  if (view.phase !== "play") return null;
  const hand = view.you.hand;
  const card = hand.find((c) => c.id !== view.drewFromDiscardCardId) ?? hand[0];
  return card ? { type: "discard", cardId: card.id } : null;
}

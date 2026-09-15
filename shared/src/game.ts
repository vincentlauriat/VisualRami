import { buildDeck, cardLabel, handCardPoints, shuffle, type Rng } from "./cards.js";
import { analyzeMeld, checkFirstLaydown, isValidMeld } from "./rules.js";
import {
  DEFAULT_OPTIONS,
  type Card,
  type GameAction,
  type GameOptions,
  type GameResult,
  type GameState,
  type Meld,
  type Player,
  type PublicGameState,
} from "./types.js";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

let meldCounter = 0;

export function createGame(
  roomId: string,
  host: { id: string; name: string },
  options: Partial<GameOptions> = {},
): GameState {
  return {
    roomId,
    hostId: host.id,
    options: { ...DEFAULT_OPTIONS, ...options },
    players: [makePlayer(host.id, host.name)],
    stock: [],
    discard: [],
    melds: [],
    currentIndex: 0,
    phase: "lobby",
    drewFromDiscardCardId: null,
    winnerId: null,
    round: 0,
    lastRoundPoints: null,
    log: [],
  };
}

function makePlayer(id: string, name: string): Player {
  return { id, name, hand: [], hasLaidDown: false, score: 0, connected: true };
}

export function addPlayer(state: GameState, player: { id: string; name: string }): GameResult {
  if (state.phase !== "lobby") return fail("La partie a déjà commencé");
  if (state.players.length >= MAX_PLAYERS) return fail(`La table est pleine (${MAX_PLAYERS} joueurs max)`);
  if (state.players.some((p) => p.id === player.id)) return fail("Joueur déjà présent");
  return ok({ ...state, players: [...state.players, makePlayer(player.id, player.name)] });
}

export function removePlayer(state: GameState, playerId: string): GameState {
  if (state.phase !== "lobby") {
    return setConnected(state, playerId, false);
  }
  const players = state.players.filter((p) => p.id !== playerId);
  const hostId = state.hostId === playerId && players[0] ? players[0].id : state.hostId;
  return { ...state, players, hostId };
}

export function setConnected(state: GameState, playerId: string, connected: boolean): GameState {
  const players = state.players.map((p) => (p.id === playerId ? { ...p, connected } : p));
  let hostId = state.hostId;
  const host = players.find((p) => p.id === hostId);
  // Never leave the table without a connected host: start/newRound would be stuck.
  if (!host || !host.connected) {
    const candidate = players.find((p) => p.connected);
    if (candidate) hostId = candidate.id;
  }
  return { ...state, players, hostId };
}

/**
 * Play a minimal turn on behalf of a player who is absent: draw from the stock if needed,
 * then discard. Used by the server when the current player stays disconnected.
 */
export function autoPlayTurn(state: GameState, playerId: string, rng: Rng = Math.random): GameResult {
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return fail("Ce n'est pas le tour de ce joueur");
  let next = state;
  if (next.phase === "draw") {
    const drawn = draw(next, playerId, "stock", rng);
    if (!drawn.ok) return drawn;
    next = drawn.state;
  }
  if (next.phase !== "play") return fail("Aucun tour à jouer");
  const hand = currentPlayer(next)!.hand;
  const card = hand.slice().reverse().find((c) => c.id !== next.drewFromDiscardCardId) ?? hand[0];
  if (!card) return fail("Main vide");
  const result = discard(next, playerId, card.id);
  if (!result.ok) return result;
  return ok(log(result.state, `${player.name} est absent : tour joué automatiquement`));
}

function fail(error: string): GameResult {
  return { ok: false, error };
}

function ok(state: GameState): GameResult {
  return { ok: true, state };
}

function log(state: GameState, message: string): GameState {
  const entries = [...state.log, message];
  return { ...state, log: entries.slice(-50) };
}

export function currentPlayer(state: GameState): Player | undefined {
  return state.players[state.currentIndex];
}

function findCards(hand: Card[], ids: string[]): Card[] | null {
  const cards: Card[] = [];
  const used = new Set<string>();
  for (const id of ids) {
    if (used.has(id)) return null;
    const card = hand.find((c) => c.id === id);
    if (!card) return null;
    used.add(id);
    cards.push(card);
  }
  return cards;
}

function removeCards(hand: Card[], ids: string[]): Card[] {
  const set = new Set(ids);
  return hand.filter((c) => !set.has(c.id));
}

function updatePlayer(state: GameState, playerId: string, patch: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
  };
}

export function applyAction(
  state: GameState,
  playerId: string,
  action: GameAction,
  rng: Rng = Math.random,
): GameResult {
  switch (action.type) {
    case "start":
      return start(state, playerId, rng);
    case "newRound":
      return newRound(state, playerId, rng);
    case "draw":
      return draw(state, playerId, action.source, rng);
    case "layDown":
      return layDown(state, playerId, action.melds);
    case "extend":
      return extend(state, playerId, action.meldId, action.cardIds, action.position);
    case "swapJoker":
      return swapJoker(state, playerId, action.meldId, action.cardId);
    case "discard":
      return discard(state, playerId, action.cardId);
    default:
      return fail("Action inconnue");
  }
}

function start(state: GameState, playerId: string, rng: Rng): GameResult {
  if (state.phase !== "lobby") return fail("La partie a déjà commencé");
  if (playerId !== state.hostId) return fail("Seul l'hôte peut lancer la partie");
  if (state.players.length < MIN_PLAYERS) return fail("Il faut au moins 2 joueurs");
  return ok(deal({ ...state, round: 0 }, rng, 0));
}

function newRound(state: GameState, playerId: string, rng: Rng): GameResult {
  if (state.phase !== "finished") return fail("La manche n'est pas terminée");
  if (playerId !== state.hostId) return fail("Seul l'hôte peut relancer une manche");
  const nextDealer = (state.round + 1) % state.players.length;
  return ok(deal(state, rng, nextDealer));
}

function deal(state: GameState, rng: Rng, firstIndex: number): GameState {
  const deck = shuffle(buildDeck(), rng);
  const players = state.players.map((p) => ({ ...p, hand: [] as Card[], hasLaidDown: false }));
  let cursor = 0;
  for (let i = 0; i < state.options.handSize; i++) {
    for (const p of players) {
      p.hand.push(deck[cursor++]!);
    }
  }
  const discard = [deck[cursor++]!];
  const stock = deck.slice(cursor);
  const next: GameState = {
    ...state,
    players,
    stock,
    discard,
    melds: [],
    currentIndex: firstIndex % players.length,
    phase: "draw",
    drewFromDiscardCardId: null,
    winnerId: null,
    round: state.round + 1,
    lastRoundPoints: null,
  };
  return log(next, `Manche ${next.round} : ${players[next.currentIndex]!.name} commence`);
}

function requireTurn(state: GameState, playerId: string, phase: "draw" | "play"): string | null {
  if (state.phase === "lobby") return "La partie n'a pas commencé";
  if (state.phase === "finished") return "La manche est terminée";
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return "Ce n'est pas votre tour";
  if (state.phase !== phase) {
    return phase === "draw" ? "Vous avez déjà pioché" : "Vous devez d'abord piocher";
  }
  return null;
}

function draw(state: GameState, playerId: string, source: "stock" | "discard", rng: Rng): GameResult {
  const err = requireTurn(state, playerId, "draw");
  if (err) return fail(err);
  const player = currentPlayer(state)!;
  let next = state;
  let card: Card;
  if (source === "discard") {
    card = state.discard[state.discard.length - 1]!;
    if (!card) return fail("La défausse est vide");
    next = { ...next, discard: state.discard.slice(0, -1), drewFromDiscardCardId: card.id };
    next = log(next, `${player.name} prend ${cardLabel(card)} dans la défausse`);
  } else {
    if (state.stock.length === 0) {
      next = reshuffleStock(next, rng);
      if (next.stock.length === 0) return fail("Plus aucune carte à piocher");
    }
    card = next.stock[0]!;
    next = { ...next, stock: next.stock.slice(1), drewFromDiscardCardId: null };
    next = log(next, `${player.name} pioche une carte`);
  }
  next = updatePlayer(next, playerId, { hand: [...player.hand, card] });
  return ok({ ...next, phase: "play" });
}

function reshuffleStock(state: GameState, rng: Rng): GameState {
  if (state.discard.length <= 1) return state;
  const top = state.discard[state.discard.length - 1]!;
  const rest = state.discard.slice(0, -1);
  return log(
    { ...state, stock: shuffle(rest, rng), discard: [top] },
    "La pioche est vide : la défausse est mélangée",
  );
}

function layDown(state: GameState, playerId: string, meldIds: string[][]): GameResult {
  const err = requireTurn(state, playerId, "play");
  if (err) return fail(err);
  if (meldIds.length === 0) return fail("Aucune combinaison à poser");
  const player = currentPlayer(state)!;
  const allIds = meldIds.flat();
  const allCards = findCards(player.hand, allIds);
  if (!allCards) return fail("Cartes introuvables dans votre main");
  const melds: Card[][] = meldIds.map((ids) => findCards(player.hand, ids)!);
  for (const cards of melds) {
    if (!isValidMeld(cards)) {
      return fail(`Combinaison invalide : ${cards.map(cardLabel).join(" ")}`);
    }
  }
  if (!player.hasLaidDown) {
    const check = checkFirstLaydown(
      melds,
      state.options.firstMeldMinPoints,
      state.options.requirePureRun,
    );
    if (!check.ok) return fail(check.error!);
  }
  const remaining = removeCards(player.hand, allIds);
  if (remaining.length === 0) {
    return fail("Vous devez garder une carte à défausser");
  }
  const newMelds: Meld[] = melds.map((cards) => ({
    id: `m${++meldCounter}-${Date.now().toString(36)}`,
    kind: analyzeMeld(cards)!.kind,
    cards,
    ownerId: playerId,
  }));
  let next = updatePlayer(state, playerId, { hand: remaining, hasLaidDown: true });
  next = { ...next, melds: [...state.melds, ...newMelds] };
  next = log(next, `${player.name} pose ${newMelds.length} combinaison(s)`);
  return ok(next);
}

function extend(
  state: GameState,
  playerId: string,
  meldId: string,
  cardIds: string[],
  position: "start" | "end",
): GameResult {
  const err = requireTurn(state, playerId, "play");
  if (err) return fail(err);
  const player = currentPlayer(state)!;
  if (!player.hasLaidDown) return fail("Vous devez d'abord faire votre première pose");
  const meld = state.melds.find((m) => m.id === meldId);
  if (!meld) return fail("Combinaison introuvable");
  if (cardIds.length === 0) return fail("Aucune carte sélectionnée");
  const cards = findCards(player.hand, cardIds);
  if (!cards) return fail("Cartes introuvables dans votre main");
  const candidate = position === "start" ? [...cards, ...meld.cards] : [...meld.cards, ...cards];
  const analysis = analyzeMeld(candidate);
  if (!analysis || analysis.kind !== meld.kind) {
    return fail("Ces cartes ne complètent pas cette combinaison");
  }
  const remaining = removeCards(player.hand, cardIds);
  if (remaining.length === 0) return fail("Vous devez garder une carte à défausser");
  let next = updatePlayer(state, playerId, { hand: remaining });
  next = {
    ...next,
    melds: state.melds.map((m) => (m.id === meldId ? { ...m, cards: candidate } : m)),
  };
  next = log(next, `${player.name} ajoute ${cards.map(cardLabel).join(" ")} à une combinaison`);
  return ok(next);
}

function swapJoker(state: GameState, playerId: string, meldId: string, cardId: string): GameResult {
  const err = requireTurn(state, playerId, "play");
  if (err) return fail(err);
  const player = currentPlayer(state)!;
  if (!player.hasLaidDown) return fail("Vous devez d'abord faire votre première pose");
  const meld = state.melds.find((m) => m.id === meldId);
  if (!meld) return fail("Combinaison introuvable");
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) return fail("Carte introuvable dans votre main");
  if (card.joker) return fail("Un joker ne peut pas remplacer un joker");
  for (let i = 0; i < meld.cards.length; i++) {
    const existing = meld.cards[i]!;
    if (!existing.joker) continue;
    const candidate = meld.cards.slice();
    candidate[i] = card;
    const analysis = analyzeMeld(candidate);
    if (analysis && analysis.kind === meld.kind) {
      const hand = [...removeCards(player.hand, [cardId]), existing];
      let next = updatePlayer(state, playerId, { hand });
      next = {
        ...next,
        melds: state.melds.map((m) => (m.id === meldId ? { ...m, cards: candidate } : m)),
      };
      next = log(next, `${player.name} récupère un joker avec ${cardLabel(card)}`);
      return ok(next);
    }
  }
  return fail("Cette carte ne peut remplacer aucun joker de cette combinaison");
}

function discard(state: GameState, playerId: string, cardId: string): GameResult {
  const err = requireTurn(state, playerId, "play");
  if (err) return fail(err);
  const player = currentPlayer(state)!;
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) return fail("Carte introuvable dans votre main");
  // The card taken from the discard pile may not go straight back, unless it is the last one.
  if (state.drewFromDiscardCardId === cardId && player.hand.length > 1) {
    return fail("Vous ne pouvez pas défausser la carte prise dans la défausse");
  }
  const hand = removeCards(player.hand, [cardId]);
  let next = updatePlayer(state, playerId, { hand });
  next = { ...next, discard: [...state.discard, card], drewFromDiscardCardId: null };
  next = log(next, `${player.name} défausse ${cardLabel(card)}`);
  if (hand.length === 0) {
    return ok(finishRound(next, playerId));
  }
  return ok({
    ...next,
    currentIndex: (state.currentIndex + 1) % state.players.length,
    phase: "draw",
  });
}

function finishRound(state: GameState, winnerId: string): GameState {
  const points: Record<string, number> = {};
  const players = state.players.map((p) => {
    if (p.id === winnerId) {
      points[p.id] = 0;
      return p;
    }
    let total = p.hand.reduce((sum, c) => sum + handCardPoints(c), 0);
    if (!p.hasLaidDown) total *= 2;
    points[p.id] = total;
    return { ...p, score: p.score + total };
  });
  const winner = state.players.find((p) => p.id === winnerId)!;
  return log(
    { ...state, players, phase: "finished", winnerId, lastRoundPoints: points },
    `${winner.name} remporte la manche !`,
  );
}

export function toPublicState(state: GameState, viewerId: string): PublicGameState {
  const you = state.players.find((p) => p.id === viewerId);
  return {
    roomId: state.roomId,
    hostId: state.hostId,
    options: state.options,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      hasLaidDown: p.hasLaidDown,
      score: p.score,
      connected: p.connected,
    })),
    you: { id: viewerId, hand: you ? you.hand : [] },
    stockCount: state.stock.length,
    discardTop: state.discard[state.discard.length - 1] ?? null,
    discardCount: state.discard.length,
    melds: state.melds,
    currentPlayerId: state.phase === "draw" || state.phase === "play" ? currentPlayer(state)?.id ?? null : null,
    phase: state.phase,
    drewFromDiscardCardId: state.drewFromDiscardCardId,
    winnerId: state.winnerId,
    round: state.round,
    lastRoundPoints: state.lastRoundPoints,
    log: state.log,
  };
}

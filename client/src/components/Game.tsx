import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  analyzeMeld,
  arrangeMeld,
  checkFirstLaydown,
  leavesACard,
  handCardPoints,
  sortByRank,
  sortBySuit,
  stockDrawEndsRound,
  type Card,
  type GameAction,
  type Meld,
  type PublicGameState,
} from "@visualrami/shared";
import type { WebRTCState } from "../lib/useWebRTC";
import type { ChatMessage } from "../lib/useGame";
import { CardBack, CardView } from "./CardView";
import { VideoTile } from "./VideoTile";
import { MediaControls } from "./MediaControls";
import { Chat, type SideTab } from "./Chat";
import { labels } from "../lib/labels";
import { Icon, Mark } from "./Icon";
import { RoundResult } from "./RoundResult";
import { invalidMeldReason, meldFit, type MeldFit } from "../lib/meldHelp";

interface Props {
  state: PublicGameState;
  rtc: WebRTCState;
  chat: ChatMessage[];
  error: string | null;
  /** Live link to the server. False during a drop: the state shown is stale and nothing is sent. */
  connected: boolean;
  onAct: (action: GameAction) => Promise<boolean>;
  onLeave: () => void;
  onSendChat: (text: string) => boolean;
  onClearError: () => void;
}

interface Staged {
  cards: Card[];
  points: number;
  pure: boolean;
  kind: "run" | "set";
}

export function Game({ state, rtc, chat, error, connected, onAct, onLeave, onSendChat, onClearError }: Props) {
  const me = state.players.find((p) => p.id === state.you.id) ?? {
    id: state.you.id,
    name: "?",
    handCount: 0,
    hasLaidDown: false,
    score: 0,
    connected: true,
  };
  const isMyTurn = state.currentPlayerId === state.you.id;
  const [hand, setHand] = useState<Card[]>(state.you.hand);
  const [selected, setSelected] = useState<string[]>([]);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  // Log/chat panel: always visible on wide screens, a bottom sheet toggled from the top bar on phones.
  const [sideOpen, setSideOpen] = useState(false);
  const sideToggle = useRef<HTMLButtonElement>(null);
  const strip = useRef<HTMLElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  // Discarding while melds are staged throws the staging away, so it takes a second press.
  const [discardArmed, setDiscardArmed] = useState(false);
  // Leaving takes two presses too: a slip of the thumb would otherwise drop you from the table.
  const [leaveArmed, setLeaveArmed] = useState(false);
  const leaveButton = useRef<HTMLButtonElement>(null);
  const leaveGroup = useRef<HTMLDivElement>(null);
  const leaveYes = useRef<HTMLButtonElement>(null);
  // The timer waits while focus is in the question, so a screen reader is not cut off mid-way.
  const [leaveFocused, setLeaveFocused] = useState(false);
  const finished = state.phase === "finished";
  // One unread count everywhere (chat tab, button, phone bubble, its label): the others' messages
  // that arrived since the Chat tab was last in view. Your own are never news to you.
  const [sideTab, setSideTab] = useState<SideTab>("log");
  const wide = useMediaQuery("(min-width: 1366px)");
  const othersMessages = chat.filter((m) => m.from !== state.you.id).length;
  const [seenMessages, setSeenMessages] = useState(0);
  const chatInView = sideTab === "chat" && (sideOpen || wide);
  useEffect(() => {
    if (chatInView || othersMessages < seenMessages) setSeenMessages(othersMessages);
  }, [chatInView, othersMessages, seenMessages]);
  const unread = Math.max(0, othersMessages - seenMessages);
  // The card you just drew, marked quietly in the hand until your turn ends.
  const [drawnId, setDrawnId] = useState<string | null>(null);
  const handBefore = useRef(state.you.hand.map((c) => c.id));

  // Keep local hand order stable while syncing with the server's hand content.
  useEffect(() => {
    setHand((prev) => {
      const incoming = state.you.hand;
      const ids = new Set(incoming.map((c) => c.id));
      const kept = prev.filter((c) => ids.has(c.id));
      const known = new Set(kept.map((c) => c.id));
      const added = incoming.filter((c) => !known.has(c.id));
      return [...kept, ...added];
    });
    setSelected((s) => s.filter((id) => state.you.hand.some((c) => c.id === id)));
    setStaged((st) => st.filter((m) => m.cards.every((c) => state.you.hand.some((h) => h.id === c.id))));
  }, [state.you.hand]);

  useEffect(() => {
    if (!isMyTurn) {
      setSelected([]);
      setStaged([]);
    }
    setDrawnId(null);
  }, [isMyTurn, state.round]);

  // A draw is the one moment the hand grows by exactly one card during your turn.
  useEffect(() => {
    const before = new Set(handBefore.current);
    handBefore.current = state.you.hand.map((c) => c.id);
    if (!isMyTurn || state.phase !== "play") return;
    const added = state.you.hand.filter((c) => !before.has(c.id));
    if (added.length === 1 && state.you.hand.length === before.size + 1) setDrawnId(added[0]!.id);
  }, [state.you.hand, isMyTurn, state.phase]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(onClearError, 4000);
    return () => clearTimeout(t);
  }, [error, onClearError]);

  // Local notices clear the same way as server errors, so neither needs a pointer to go away.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);


  function disarmLeave() {
    const hadFocus = !!leaveGroup.current?.contains(document.activeElement);
    setLeaveArmed(false);
    setLeaveFocused(false);
    if (hadFocus) requestAnimationFrame(() => leaveButton.current?.focus());
  }

  // Armed, the confirmation takes focus; once focus leaves it, it gives up by itself after a few seconds.
  useEffect(() => {
    if (leaveArmed) leaveYes.current?.focus();
  }, [leaveArmed]);
  useEffect(() => {
    if (!leaveArmed || leaveFocused) return;
    const t = setTimeout(disarmLeave, 5000);
    return () => clearTimeout(t);
  }, [leaveArmed, leaveFocused]);

  function closeSide() {
    setSideOpen(false);
    sideToggle.current?.focus();
  }

  function dismissToast() {
    onClearError();
    setNotice(null);
  }

  const stagedIds = useMemo(() => new Set(staged.flatMap((m) => m.cards.map((c) => c.id))), [staged]);
  const selectedCards = useMemo(
    () => selected.map((id) => hand.find((c) => c.id === id)!).filter(Boolean),
    [selected, hand],
  );
  const stagedTotal = staged.reduce((sum, m) => sum + m.points, 0);
  const firstLaydown = !me.hasLaidDown;
  const firstCheck = firstLaydown
    ? checkFirstLaydown(
        staged.map((m) => m.cards),
        state.options.firstMeldMinPoints,
        state.options.requirePureRun,
      )
    : null;

  function toggle(card: Card) {
    if (finished) return;
    if (stagedIds.has(card.id)) return release(card.id);
    setSelected((s) => (s.includes(card.id) ? s.filter((id) => id !== card.id) : [...s, card.id]));
  }

  function stage() {
    // Tap order does not matter: the selection is put in a valid order before it is checked.
    const cards = arrangeMeld(selectedCards);
    const analysis = cards && analyzeMeld(cards);
    if (!cards || !analysis) {
      setNotice(invalidMeldReason(selectedCards));
      return;
    }
    setStaged((st) => [...st, { cards, points: analysis.points, pure: analysis.pure, kind: analysis.kind }]);
    setSelected([]);
    setNotice(null);
  }

  /**
   * Touching a prepared card in the hand takes that card, and only that card, back: its
   * combination keeps the rest when they still form one, and is undone when they no longer do.
   */
  function release(cardId: string) {
    setStaged((st) =>
      st.flatMap((m) => {
        if (!m.cards.some((c) => c.id === cardId)) return [m];
        const rest = m.cards.filter((c) => c.id !== cardId);
        const cards = rest.length >= 3 ? arrangeMeld(rest) : null;
        const analysis = cards ? analyzeMeld(cards) : null;
        return cards && analysis ? [{ cards, points: analysis.points, pure: analysis.pure, kind: analysis.kind }] : [];
      }),
    );
    setNotice(null);
  }

  function unstage(index: number) {
    setStaged((st) => st.filter((_, i) => i !== index));
  }

  async function layDown() {
    const ok = await onAct({ type: "layDown", melds: staged.map((m) => m.cards.map((c) => c.id)) });
    if (ok) setStaged([]);
  }

  // Seats run clockwise from your left, in turn order: the next player sits on your left.
  const myIndex = state.players.findIndex((p) => p.id === state.you.id);
  const opponents = [...state.players.slice(myIndex + 1), ...state.players.slice(0, Math.max(0, myIndex))];
  const sided = opponents.length >= 3;
  const leftSeat = sided ? opponents[0] : undefined;
  const rightSeat = sided ? opponents[opponents.length - 1] : undefined;
  const topSeats = sided ? opponents.slice(1, -1) : opponents;
  const seatOf = (id: string) => (id === leftSeat?.id ? "left" : id === rightSeat?.id ? "right" : "top");
  const meldsBy = useMemo(() => {
    const map = new Map<string, Meld[]>();
    for (const meld of state.melds) map.set(meld.ownerId, [...(map.get(meld.ownerId) ?? []), meld]);
    return map;
  }, [state.melds]);
  const topDiscard = state.discardTop;
  // Offline, the piles and actions go still: whatever is on screen may already be out of date.
  const canDraw = connected && isMyTurn && state.phase === "draw";
  const canPlay = connected && isMyTurn && state.phase === "play";
  // Only melds that will really accept the selection are offered as targets.
  const fits = useMemo(() => {
    const map = new Map<string, MeldFit>();
    if (!canPlay || !me.hasLaidDown) return map;
    for (const meld of state.melds) {
      const fit = meldFit(meld, selectedCards);
      if (fit) map.set(meld.id, fit);
    }
    return map;
  }, [canPlay, me.hasLaidDown, state.melds, selectedCards]);
  // Before the first laydown nothing can join the table yet; say so when it would.
  const fitsLater = useMemo(
    () => canPlay && !me.hasLaidDown && selectedCards.length > 0 && state.melds.some((m) => meldFit(m, selectedCards)),
    [canPlay, me.hasLaidDown, state.melds, selectedCards],
  );
  const keepDiscard =
    selectedCards.length === 1 && hand.length > 1 && selectedCards[0]!.id === state.drewFromDiscardCardId;
  const canDiscard = canPlay && selectedCards.length === 1 && !keepDiscard;
  // What the selection is worth, before it is prepared: a whole meld counts as the table will
  // count it, a partial pick by its cards' values (a joker only counts once it has a place).
  const selectionInfo = useMemo(() => {
    if (finished || selectedCards.length === 0) return null;
    const arranged = selectedCards.length >= 3 ? arrangeMeld(selectedCards) : null;
    const meld = arranged ? analyzeMeld(arranged) : null;
    const points = meld ? meld.points : selectedCards.reduce((sum, c) => sum + (c.joker ? 0 : handCardPoints(c)), 0);
    const min = state.options.firstMeldMinPoints;
    // Before the first laydown, a real meld says how far the table's threshold still is.
    const toGo = meld && !me.hasLaidDown && min > 0 ? min - stagedTotal - points : null;
    return labels.selection(selectedCards.length, points, toGo, min);
  }, [finished, selectedCards, state.options.firstMeldMinPoints, me.hasLaidDown, stagedTotal]);
  // The turn ends on a discard, so a laydown must leave one card in hand (the server refuses it too).
  const keepsACard = leavesACard(hand, stagedIds);
  const canLay = connected && staged.length > 0 && keepsACard && (firstLaydown ? !!firstCheck?.ok : true);
  const minPoints = state.options.firstMeldMinPoints;
  const stockEnds = stockDrawEndsRound(state);
  const hint = finished
    ? null
    : !connected
      ? labels.hintOffline
      : !isMyTurn
        ? null
        : canDraw
      ? stockEnds
        ? labels.hintDrawEndsRound
        : labels.hintDraw
      : staged.length > 0 && !keepsACard
        ? labels.hintKeepOne
      : keepDiscard
        ? labels.hintKeepDiscard
        : discardArmed
          ? labels.hintDiscardStaged
          : fits.size > 0
            ? labels.hintTargets
            : fitsLater
              ? labels.hintAfterLaydown
              : labels.hintPlay;

  const turnLine = isMyTurn
    ? connected
      ? state.phase === "draw" ? "À vous : piochez une carte" : "À vous : posez ou défaussez"
      : state.phase === "draw" ? "À vous de piocher" : "À vous de jouer"
    : labels.turnOf(state.players.find((p) => p.id === state.currentPlayerId)?.name ?? "…");

  // A first laydown is a table event: the player's zone lights up with the points they opened with.
  const [fresh, setFresh] = useState<{ id: string; points: number } | null>(null);
  const [spoken, setSpoken] = useState("");
  const laidBefore = useRef(new Map(state.players.map((p) => [p.id, p.hasLaidDown])));
  useEffect(() => {
    const before = laidBefore.current;
    const opener = state.players.find((p) => p.hasLaidDown && before.get(p.id) === false);
    laidBefore.current = new Map(state.players.map((p) => [p.id, p.hasLaidDown]));
    if (!opener) return;
    const points = (meldsBy.get(opener.id) ?? []).reduce((sum, m) => sum + (analyzeMeld(m.cards)?.points ?? 0), 0);
    setFresh({ id: opener.id, points });
    setSpoken(labels.firstLaydownSpoken(opener.name, points, opener.id === state.you.id));
  }, [state.players, meldsBy, state.you.id]);
  // Its own timer, keyed on the event alone: the next state update (someone discards) used to
  // cancel it in the effect above, and the tag never left.
  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(null), 4000);
    return () => clearTimeout(t);
  }, [fresh]);

  // On a phone the faces stay in the strip: touching one brings that player's melds into view.
  const [pinged, setPinged] = useState<string | null>(null);
  function jumpTo(id: string) {
    const zone = document.getElementById(`zone-${id}`);
    if (!zone) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    zone.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
    setPinged(id);
  }
  useEffect(() => {
    if (!pinged) return;
    const t = setTimeout(() => setPinged(null), 1200);
    return () => clearTimeout(t);
  }, [pinged]);

  // Any change to what would be discarded or abandoned disarms the confirmation.
  useEffect(() => setDiscardArmed(false), [selected, staged, state.phase]);

  // On a phone the strip scrolls sideways: bring the seat whose turn it is into view, within the
  // strip only (scrollIntoView would also scroll the page).
  useEffect(() => {
    const el = strip.current;
    const seat = el?.querySelector<HTMLElement>(".opponent.active:not(.self-seat)");
    if (!el || !seat || el.scrollWidth <= el.clientWidth) return;
    const left = seat.offsetLeft - el.offsetLeft - (el.clientWidth - seat.clientWidth) / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  }, [state.currentPlayerId]);

  async function onMeldClick(meld: Meld) {
    if (!canPlay || selectedCards.length === 0) return;
    if (!me.hasLaidDown) {
      setNotice(labels.laydownFirst);
      return;
    }
    const fit = fits.get(meld.id);
    if (!fit) {
      setNotice(labels.meldNoFit);
      return;
    }
    const action: GameAction =
      fit.type === "extend"
        ? { type: "extend", meldId: meld.id, cardIds: fit.cardIds, position: fit.position }
        : { type: "swapJoker", meldId: meld.id, cardId: fit.cardId };
    if (await onAct(action)) {
      setSelected([]);
      // The meld stops being a button once it no longer fits, which would drop keyboard focus.
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) handRef.current?.querySelector<HTMLElement>("button")?.focus();
      });
    }
  }

  async function discard() {
    if (!canDiscard) return;
    if (staged.length > 0 && !discardArmed) {
      setDiscardArmed(true);
      return;
    }
    if (await onAct({ type: "discard", cardId: selectedCards[0]!.id })) setSelected([]);
  }

  function renderMeld(meld: Meld, ownerName: string) {
    const clickable = fits.has(meld.id);
    const cards = meld.cards.map((c) => <CardView key={c.id} card={c} size="small" />);
    // Cards on the table are pictures, so a target meld can be a real button.
    return clickable ? (
      <button
        key={meld.id}
        type="button"
        className="meld target"
        onClick={() => onMeldClick(meld)}
        title="Ajouter les cartes sélectionnées ici"
        aria-label={labels.meldTarget(ownerName, meld.cards)}
      >
        {cards}
      </button>
    ) : (
      <div key={meld.id} className="meld" role="group" aria-label={labels.meld(ownerName)}>
        {cards}
      </div>
    );
  }

  function renderZone(player: { id: string; name: string }, place: "left" | "top" | "right" | "me") {
    const melds = meldsBy.get(player.id) ?? [];
    const mine = player.id === state.you.id;
    const event = fresh?.id === player.id ? fresh : null;
    const cls = [
      "zone",
      `zone-${place}`,
      melds.length === 0 && "empty",
      state.currentPlayerId === player.id && !finished && "active",
      event && "fresh",
      pinged === player.id && "pinged",
    ].filter(Boolean).join(" ");
    return (
      <div key={player.id} id={`zone-${player.id}`} className={cls} role="group" aria-label={mine ? labels.myZone : labels.zone(player.name)}>
        <span className="zone-owner" aria-hidden>{mine ? "Vous" : player.name}</span>
        {event && <span className="zone-event" aria-hidden>{labels.firstLaydownBadge(event.points)}</span>}
        {melds.map((m) => renderMeld(m, player.name))}
      </div>
    );
  }

  return (
    <div className={`game${sideOpen ? " side-open" : ""}`}>
      <header className="topbar">
        <h1>
          <span className="logo"><Mark /></span> <span className="brand">VisualRami</span>
          <span className="tag"><span className="tag-prefix">table </span>{state.roomId}</span>
          <span className="tag">manche {state.round}</span>
        </h1>
        <div className="topbar-right">
          <MediaControls rtc={rtc} compact />
          <button
            ref={sideToggle}
            type="button"
            className={`ghost side-toggle${sideOpen ? " on" : ""}`}
            onClick={() => setSideOpen((v) => !v)}
            aria-expanded={sideOpen}
            aria-controls="side-panel"
            aria-label={labels.sideToggle(unread)}
          >
            <Icon name="chat" />{unread > 0 && <span className="tag unread" aria-hidden>{unread}</span>}
          </button>
          {leaveArmed ? (
            <div
              ref={leaveGroup}
              className="leave-confirm"
              role="group"
              aria-label={labels.leaveAsk}
              onKeyDown={(e) => e.key === "Escape" && disarmLeave()}
              onFocus={() => setLeaveFocused(true)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setLeaveFocused(false);
              }}
            >
              <span className="leave-ask" aria-hidden>{labels.leaveAsk}</span>
              <button ref={leaveYes} type="button" className="ghost leave-yes" onClick={onLeave} title={labels.leaveHint}>
                <Icon name="leave" />
                {labels.leaveConfirm}
              </button>
              <button type="button" className="ghost" onClick={disarmLeave}>
                {labels.leaveCancel}
              </button>
            </div>
          ) : (
            <button
              ref={leaveButton}
              type="button"
              className="ghost"
              onClick={() => setLeaveArmed(true)}
              aria-label={labels.leave}
              title={labels.leaveHint}
            >
              <Icon name="leave" />
              <span className="btn-label">Quitter</span>
            </button>
          )}
        </div>
      </header>

      {/* Always mounted, so the drop is announced; empty, it takes no room. */}
      <div className="net-status" role="status">
        {!connected && (
          <p className="net-lost">
            <Icon name="offline" />
            {labels.connectionLost}
          </p>
        )}
      </div>

      <div className="game-body">
        <main
          className={`table-area${sided ? " sided" : ""}`}
          style={{ "--top": Math.max(1, topSeats.length) } as CSSProperties}
        >
          <section className="opponents" ref={strip} style={{ "--seats": state.players.length } as CSSProperties}>
            {/* On a phone your own seat joins the strip, so the hand gets the row it used to take. */}
            <div className={`opponent self-seat${isMyTurn ? " active" : ""}`}>
              <VideoTile stream={rtc.localStream} name={me.name} suffix="(vous)" muted mirror micOff={!rtc.micOn} active={isMyTurn} winner={finished && state.winnerId === me.id} badge={me.hasLaidDown ? "posé" : undefined} />
              <div className="opponent-info">
                <span>{me.score} pts</span>
              </div>
            </div>
            {opponents.map((p) => (
              <div
                key={p.id}
                className={`opponent seat-${seatOf(p.id)}${state.currentPlayerId === p.id ? " active" : ""}`}
                style={seatOf(p.id) === "top" ? { gridColumn: String(topSeats.indexOf(p) + 2) } : undefined}
              >
                <VideoTile
                  stream={rtc.remoteStreams[p.id] ?? null}
                  videoOff={rtc.remoteCamOff[p.id]}
                  name={p.name}
                  active={state.currentPlayerId === p.id}
                  winner={finished && state.winnerId === p.id}
                  // While we are offline nobody's presence is known: a server restart would
                  // otherwise show every seat as left.
                  offline={connected && !p.connected}
                  micOff={rtc.remoteMicOff[p.id]}
                  badge={p.hasLaidDown ? "posé" : undefined}
                  badgeMuted
                />
                <div className="opponent-info">
                  <span className="mini-hand" aria-hidden>
                    {Array.from({ length: Math.min(p.handCount, 14) }).map((_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                  <span>{labels.seatInfo(p.handCount, p.score)}</span>
                </div>
                {meldsBy.has(p.id) && (
                  <button type="button" className="seat-jump" onClick={() => jumpTo(p.id)} aria-label={labels.seatJump(p.name)} />
                )}
              </div>
            ))}
          </section>

          <section className={`felt${canPlay ? " playing" : ""}`}>
            <div className="felt-center">
              {finished ? (
                <RoundResult state={state} connected={connected} onAct={onAct} />
              ) : (
              <>
              <div className="piles">
                <div className="pile">
                  <CardBack
                    count={state.stockCount}
                    endsRound={stockEnds}
                    onClick={canDraw ? () => onAct({ type: "draw", source: "stock" }) : undefined}
                  />
                  <span className="pile-caption" aria-hidden>Talon</span>
                  {/* Spoken as part of the stock's name; shown here for everyone at the table. */}
                  {stockEnds && <span className="pile-warning" aria-hidden>{labels.stockEndsRound}</span>}
                </div>
                <div className="pile">
                  {topDiscard ? (
                    <CardView
                      card={topDiscard}
                      onClick={canDraw ? () => onAct({ type: "draw", source: "discard" }) : undefined}
                      spokenName={labels.discard(topDiscard, canDraw)}
                    />
                  ) : (
                    <span className="card empty" role="img" aria-label={labels.emptyDiscard} />
                  )}
                  <span className="pile-caption" aria-hidden>Défausse</span>
                </div>
                {/* Announced by the live region below, which outlives the round result. */}
                <div className="turn-banner" aria-hidden>
                  {isMyTurn ? <strong className={connected ? "mine" : undefined}>{turnLine}</strong> : <span>{turnLine}</span>}
                  {hint && <span className="turn-hint">{hint}</span>}
                </div>
              </div>

              {/* Staged melds wait on the felt, where they are about to be laid. */}
              {staged.length > 0 && (
                <div className="staging">
                  <div className="staging-head">
                    {firstLaydown ? (
                      <div className="laydown-progress">
                        <span className={`gauge${firstCheck?.ok ? " full" : ""}`} aria-hidden>
                          <span style={{ transform: `scaleX(${Math.min(1, stagedTotal / minPoints)})` }} />
                        </span>
                        <span className="laydown-points">{labels.laydownProgress(stagedTotal, minPoints)}</span>
                        {state.options.requirePureRun && (
                          <span className={`pip${firstCheck?.hasPureRun ? " on" : ""}`}>
                            {firstCheck?.hasPureRun ? labels.pureRunDone : labels.pureRunMissing}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="laydown-points">{labels.laydownPoints(stagedTotal)}</span>
                    )}
                    <button type="button" className={canLay ? "primary" : undefined} disabled={!canLay} onClick={layDown}>
                      Poser<span className="btn-label"> sur la table</span>
                    </button>
                  </div>
                  <div className="staging-melds">
                    {staged.map((m, i) => (
                      <div key={m.cards.map((c) => c.id).join("|")} className="meld staged">
                        {m.cards.map((c) => (
                          <CardView key={c.id} card={c} size="small" />
                        ))}
                        <button type="button" className="ghost tiny" onClick={() => unstage(i)} aria-label={labels.unstage(m.cards)}>
                          <Icon name="close" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {state.melds.length === 0 && <p className="hint">Aucune combinaison posée pour l'instant.</p>}
              </>
              )}
            </div>

            {/* Each player's melds lie in front of their seat, clockwise from your left; yours sit above your hand. */}
            {leftSeat && renderZone(leftSeat, "left")}
            <div className="zones-top">{topSeats.map((p) => renderZone(p, "top"))}</div>
            {rightSeat && renderZone(rightSeat, "right")}
            {renderZone(me, "me")}
            <p className="sr-only" aria-live="polite">{spoken}</p>
            <p className="sr-only" aria-live="polite">{finished ? "" : hint ? `${turnLine}. ${hint}` : turnLine}</p>
          </section>

          <section className="me">
            <div className="me-side">
              <VideoTile stream={rtc.localStream} name={me.name} muted mirror small micOff={!rtc.micOn} active={isMyTurn} winner={finished && state.winnerId === me.id} badge={me.hasLaidDown ? "posé" : undefined} />
              <div className="me-score">{me.score} pts</div>
            </div>

            <div className="hand-area">
              {(error || notice) && (
                <div className="toast" role="alert" onClick={dismissToast}>
                  <span>{error ?? notice}</span>
                  <button type="button" className="ghost tiny" onClick={dismissToast} aria-label={labels.dismissMessage}>
                    <Icon name="close" />
                  </button>
                </div>
              )}

              {/* Information, not an action: it stays out of the lamp's gold. Hidden under a message. */}
              <p className="selection-info" aria-live="polite">
                {!error && !notice ? selectionInfo : null}
              </p>

              <div className={`hand${hand.length > 14 ? " dense" : ""}`} ref={handRef}>
                {hand.map((card) => {
                  const idx = selected.indexOf(card.id);
                  return (
                    <CardView
                      key={card.id}
                      card={card}
                      selected={idx >= 0}
                      dimmed={stagedIds.has(card.id)}
                      spokenName={stagedIds.has(card.id) ? labels.stagedCard(card) : undefined}
                      order={idx >= 0 && selected.length > 1 ? idx + 1 : undefined}
                      drawn={card.id === drawnId}
                      // Between rounds the hand is only to look at.
                      onClick={finished ? undefined : () => toggle(card)}
                    />
                  );
                })}
              </div>

              {/* Between rounds nothing here applies: Prêt / Nouvelle manche on the felt is the only action. */}
              {!finished && (
              <div className={`actions${staged.length > 0 ? " staging-on" : ""}`}>
                <div className="sort">
                  <button type="button" onClick={() => setHand((h) => sortBySuit(h))} aria-label="Trier par couleur">
                    <span className="btn-label">Trier </span>♠♥
                  </button>
                  <button type="button" onClick={() => setHand((h) => sortByRank(h))} aria-label="Trier par valeur">
                    <span className="btn-label">Trier </span>A→R
                  </button>
                  <button type="button" onClick={() => setSelected([])} disabled={selected.length === 0} aria-label="Désélectionner">
                    <Icon name="close" />
                    <span className="btn-label">Désélectionner</span>
                  </button>
                </div>
                <div className="play">
                  <button type="button" disabled={!canPlay || selectedCards.length < 3} onClick={stage}>
                    Préparer<span className="btn-label"> la combinaison</span>
                    {selectedCards.length > 0 && <span className="btn-label"> ({selectedCards.length})</span>}
                  </button>
                  {/* Phones only: the tray's own button can scroll out of the felt, so it rides here too. */}
                  {staged.length > 0 && (
                    <button type="button" className={`lay-now${canLay ? " primary" : ""}`} disabled={!canLay} onClick={layDown}>
                      Poser
                    </button>
                  )}
                  {/* Gold only once discarding is actually possible: the Lamp Rule. */}
                  <button
                    type="button"
                    // Armed, it is a confirmation, not the lamp: Poser stays the gold action.
                    className={discardArmed ? "ghost confirm-danger" : canDiscard && staged.length === 0 ? "primary" : undefined}
                    disabled={!canDiscard}
                    onClick={discard}
                    aria-label={discardArmed ? labels.discardAnyway : undefined}
                  >
                    {/* On a phone the armed label stays one word and a "?": the banner says why. */}
                    {discardArmed ? (
                      <>
                        <span className="label-long">{labels.discardAnyway}</span>
                        <span className="label-short">{labels.discardAnywayShort}</span>
                      </>
                    ) : (
                      "Défausser"
                    )}
                  </button>
                </div>
              </div>
              )}
            </div>
          </section>
        </main>

        <Chat messages={chat} log={state.log} tab={sideTab} onTab={setSideTab} unread={unread} options={state.options} offline={!connected} onSend={onSendChat} onClose={closeSide} />
      </div>

    </div>
  );
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

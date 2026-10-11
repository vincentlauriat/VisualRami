import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  analyzeMeld,
  arrangeMeld,
  checkFirstLaydown,
  sortByRank,
  sortBySuit,
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
import { Chat } from "./Chat";
import { labels } from "../lib/labels";
import { Icon } from "./Icon";
import { invalidMeldReason, meldFit, type MeldFit } from "../lib/meldHelp";

interface Props {
  state: PublicGameState;
  rtc: WebRTCState;
  chat: ChatMessage[];
  error: string | null;
  onAct: (action: GameAction) => Promise<boolean>;
  onLeave: () => void;
  onSendChat: (text: string) => void;
  onClearError: () => void;
}

interface Staged {
  cards: Card[];
  points: number;
  pure: boolean;
  kind: "run" | "set";
}

export function Game({ state, rtc, chat, error, onAct, onLeave, onSendChat, onClearError }: Props) {
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
  const resultFocus = useRef<HTMLElement>(null);
  const strip = useRef<HTMLElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  // Discarding while melds are staged throws the staging away, so it takes a second press.
  const [discardArmed, setDiscardArmed] = useState(false);
  const finished = state.phase === "finished";

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
  }, [isMyTurn, state.round]);

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

  // The round result is modal: move focus into it, and the rest of the page goes inert meanwhile.
  useEffect(() => {
    if (finished) resultFocus.current?.focus();
  }, [finished]);

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
    if (stagedIds.has(card.id)) return;
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

  function unstage(index: number) {
    setStaged((st) => st.filter((_, i) => i !== index));
  }

  async function layDown() {
    const ok = await onAct({ type: "layDown", melds: staged.map((m) => m.cards.map((c) => c.id)) });
    if (ok) setStaged([]);
  }

  const opponents = state.players.filter((p) => p.id !== state.you.id);
  const topDiscard = state.discardTop;
  const canDraw = isMyTurn && state.phase === "draw";
  const canPlay = isMyTurn && state.phase === "play";
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
  const canLay = staged.length > 0 && (firstLaydown ? !!firstCheck?.ok : true);
  const minPoints = state.options.firstMeldMinPoints;
  const hint = !isMyTurn || finished
    ? null
    : canDraw
      ? labels.hintDraw
      : keepDiscard
        ? labels.hintKeepDiscard
        : discardArmed
          ? labels.hintDiscardStaged
          : fits.size > 0
            ? labels.hintTargets
            : fitsLater
              ? labels.hintAfterLaydown
              : labels.hintPlay;

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

  return (
    <div className={`game${sideOpen ? " side-open" : ""}`}>
      <header className="topbar" inert={finished}>
        <h1>
          <span className="logo">🃏</span> <span className="brand">VisualRami</span>
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
            aria-label={labels.sideToggle(chat.length)}
          >
            <Icon name="chat" />{chat.length > 0 && <span className="tag" aria-hidden>{chat.length}</span>}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={onLeave}
            aria-label="Quitter la table"
            title="Votre place reste réservée : revenez avec le code de la table"
          >
            <Icon name="leave" />
            <span className="btn-label">Quitter</span>
          </button>
        </div>
      </header>

      <div className="game-body" inert={finished}>
        <main className="table-area">
          <section className="opponents" ref={strip} style={{ "--seats": state.players.length } as CSSProperties}>
            {/* On a phone your own seat joins the strip, so the hand gets the row it used to take. */}
            <div className={`opponent self-seat${isMyTurn ? " active" : ""}`}>
              <VideoTile stream={rtc.localStream} name={me.name} suffix="(vous)" muted mirror active={isMyTurn} badge={me.hasLaidDown ? "posé" : undefined} />
              <div className="opponent-info">
                <span>{me.score} pts</span>
              </div>
            </div>
            {opponents.map((p) => (
              <div key={p.id} className={`opponent${state.currentPlayerId === p.id ? " active" : ""}`}>
                <VideoTile
                  stream={rtc.remoteStreams[p.id] ?? null}
                  videoOff={rtc.remoteCamOff[p.id]}
                  name={p.name}
                  active={state.currentPlayerId === p.id}
                  offline={!p.connected}
                  badge={p.hasLaidDown ? "posé" : undefined}
                  badgeMuted
                />
                <div className="opponent-info">
                  <span className="mini-hand" aria-hidden>
                    {Array.from({ length: Math.min(p.handCount, 14) }).map((_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                  <span>{p.handCount} cartes · {p.score} pts</span>
                </div>
              </div>
            ))}
          </section>

          <section className={`felt${canPlay ? " playing" : ""}`}>
            <div className="piles">
              <div className="pile">
                <CardBack count={state.stockCount} onClick={canDraw ? () => onAct({ type: "draw", source: "stock" }) : undefined} />
                <span className="pile-caption" aria-hidden>Talon</span>
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
              <div className="turn-banner" aria-live="polite">
                {state.phase === "finished" ? (
                  <strong>Manche terminée</strong>
                ) : isMyTurn ? (
                  <strong className="mine">{state.phase === "draw" ? "À vous : piochez une carte" : "À vous : posez ou défaussez"}</strong>
                ) : (
                  <span>{labels.turnOf(state.players.find((p) => p.id === state.currentPlayerId)?.name ?? "…")}</span>
                )}
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
                        <span style={{ width: `${Math.min(100, (stagedTotal / minPoints) * 100)}%` }} />
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
                    Poser sur la table
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

            <div className="melds">
              {state.melds.length === 0 && <p className="hint">Aucune combinaison posée pour l'instant.</p>}
              {state.melds.map((meld) => {
                const owner = state.players.find((p) => p.id === meld.ownerId);
                const clickable = fits.has(meld.id);
                const cards = meld.cards.map((c) => <CardView key={c.id} card={c} size="small" />);
                const ownerTag = <span className="meld-owner" aria-hidden>{owner?.name}</span>;
                // Cards on the table are pictures, so a target meld can be a real button.
                return clickable ? (
                  <button
                    key={meld.id}
                    type="button"
                    className="meld target"
                    onClick={() => onMeldClick(meld)}
                    title="Ajouter les cartes sélectionnées ici"
                    aria-label={labels.meldTarget(owner?.name ?? "?", meld.cards)}
                  >
                    {cards}
                    {ownerTag}
                  </button>
                ) : (
                  <div key={meld.id} className="meld" role="group" aria-label={labels.meld(owner?.name ?? "?")}>
                    {cards}
                    {ownerTag}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="me">
            <div className="me-side">
              <VideoTile stream={rtc.localStream} name={me.name} muted mirror small active={isMyTurn} badge={me.hasLaidDown ? "posé" : undefined} />
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

              <div className={`hand${hand.length > 14 ? " dense" : ""}`} ref={handRef}>
                {hand.map((card) => {
                  const idx = selected.indexOf(card.id);
                  return (
                    <CardView
                      key={card.id}
                      card={card}
                      selected={idx >= 0}
                      dimmed={stagedIds.has(card.id)}
                      order={idx >= 0 && selected.length > 1 ? idx + 1 : undefined}
                      onClick={() => toggle(card)}
                    />
                  );
                })}
              </div>

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
                    className={canDiscard && (staged.length === 0 || discardArmed) ? "primary" : undefined}
                    disabled={!canDiscard}
                    onClick={discard}
                  >
                    {discardArmed ? "Défausser quand même" : "Défausser"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>

        <Chat messages={chat} log={state.log} onSend={onSendChat} onClose={closeSide} />
      </div>

      {finished && (
        <div className="overlay">
          <div className="panel result" role="dialog" aria-modal="true" aria-labelledby="result-title">
            <h2 id="result-title" tabIndex={-1} ref={state.hostId === state.you.id ? undefined : (el) => { resultFocus.current = el; }}>{state.winnerId === state.you.id ? "🏆 Vous remportez la manche !" : `${state.players.find((p) => p.id === state.winnerId)?.name} remporte la manche`}</h2>
            <table>
              <thead>
                <tr>
                  <th>Joueur</th>
                  <th>Cette manche</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {state.players.map((p) => (
                  <tr key={p.id} className={p.id === state.winnerId ? "winner" : ""}>
                    <td>{p.name}</td>
                    <td>+{state.lastRoundPoints?.[p.id] ?? 0}</td>
                    <td>{p.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {state.hostId === state.you.id ? (
              <button
                type="button"
                className="primary"
                ref={(el) => { resultFocus.current = el; }}
                onClick={() => onAct({ type: "newRound" })}
              >
                Nouvelle manche
              </button>
            ) : (
              <p className="hint">En attente de l'hôte pour la manche suivante…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

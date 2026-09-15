import { useEffect, useMemo, useState } from "react";
import {
  analyzeMeld,
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
    const analysis = analyzeMeld(selectedCards);
    if (!analysis) {
      setNotice("Cette sélection n'est pas une combinaison valide (vérifiez l'ordre des cartes).");
      return;
    }
    setStaged((st) => [...st, { cards: selectedCards, points: analysis.points, pure: analysis.pure, kind: analysis.kind }]);
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

  async function onMeldClick(meld: Meld) {
    if (!isMyTurn || state.phase !== "play" || selectedCards.length === 0) return;
    if (!me.hasLaidDown) {
      setNotice("Faites d'abord votre première pose avant de compléter les combinaisons.");
      return;
    }
    const ids = selectedCards.map((c) => c.id);
    const atEnd = analyzeMeld([...meld.cards, ...selectedCards]);
    if (atEnd && atEnd.kind === meld.kind) {
      if (await onAct({ type: "extend", meldId: meld.id, cardIds: ids, position: "end" })) setSelected([]);
      return;
    }
    const atStart = analyzeMeld([...selectedCards, ...meld.cards]);
    if (atStart && atStart.kind === meld.kind) {
      if (await onAct({ type: "extend", meldId: meld.id, cardIds: ids, position: "start" })) setSelected([]);
      return;
    }
    if (selectedCards.length === 1 && meld.cards.some((c) => c.joker)) {
      if (await onAct({ type: "swapJoker", meldId: meld.id, cardId: ids[0]! })) setSelected([]);
      return;
    }
    setNotice("Ces cartes ne complètent pas cette combinaison.");
  }

  async function discard() {
    if (selectedCards.length !== 1) return;
    if (await onAct({ type: "discard", cardId: selectedCards[0]!.id })) setSelected([]);
  }

  const opponents = state.players.filter((p) => p.id !== state.you.id);
  const topDiscard = state.discardTop;
  const canDraw = isMyTurn && state.phase === "draw";
  const canPlay = isMyTurn && state.phase === "play";

  return (
    <div className="game">
      <header className="topbar">
        <h1>
          <span className="logo">🃏</span> VisualRami <span className="tag">table {state.roomId}</span>
          <span className="tag">manche {state.round}</span>
        </h1>
        <div className="topbar-right">
          <MediaControls rtc={rtc} compact />
          <button type="button" className="ghost" onClick={onLeave} title="Votre place reste réservée : revenez avec le code de la table">
            Quitter (place gardée)
          </button>
        </div>
      </header>

      <div className="game-body">
        <main className="table-area">
          <section className="opponents">
            {opponents.map((p) => (
              <div key={p.id} className={`opponent${state.currentPlayerId === p.id ? " active" : ""}`}>
                <VideoTile
                  stream={rtc.remoteStreams[p.id] ?? null}
                  name={p.name}
                  active={state.currentPlayerId === p.id}
                  offline={!p.connected}
                  badge={p.hasLaidDown ? "posé" : undefined}
                />
                <div className="opponent-info">
                  <span className="mini-hand" aria-label={`${p.handCount} cartes`}>
                    {Array.from({ length: Math.min(p.handCount, 14) }).map((_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                  <span>{p.handCount} cartes · {p.score} pts</span>
                </div>
              </div>
            ))}
          </section>

          <section className="felt">
            <div className="piles">
              <div className="pile">
                <CardBack count={state.stockCount} onClick={canDraw ? () => onAct({ type: "draw", source: "stock" }) : undefined} />
                <span className="pile-caption">Talon</span>
              </div>
              <div className="pile">
                {topDiscard ? (
                  <CardView card={topDiscard} onClick={canDraw ? () => onAct({ type: "draw", source: "discard" }) : undefined} />
                ) : (
                  <div className="card empty" />
                )}
                <span className="pile-caption">Défausse</span>
              </div>
              <div className="turn-banner">
                {state.phase === "finished" ? (
                  <strong>Manche terminée</strong>
                ) : isMyTurn ? (
                  <strong className="mine">{state.phase === "draw" ? "À vous : piochez une carte" : "À vous : posez ou défaussez"}</strong>
                ) : (
                  <span>Tour de {state.players.find((p) => p.id === state.currentPlayerId)?.name ?? "…"}</span>
                )}
              </div>
            </div>

            <div className="melds">
              {state.melds.length === 0 && <p className="hint">Aucune combinaison posée pour l'instant.</p>}
              {state.melds.map((meld) => {
                const owner = state.players.find((p) => p.id === meld.ownerId);
                const clickable = canPlay && selectedCards.length > 0 && me.hasLaidDown;
                return (
                  <div
                    key={meld.id}
                    className={`meld${clickable ? " target" : ""}`}
                    onClick={() => onMeldClick(meld)}
                    role={clickable ? "button" : undefined}
                    title={clickable ? "Ajouter les cartes sélectionnées ici" : undefined}
                  >
                    {meld.cards.map((c) => (
                      <CardView key={c.id} card={c} size="small" />
                    ))}
                    <span className="meld-owner">{owner?.name}</span>
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
                <div className="toast" role="alert" onClick={() => { onClearError(); setNotice(null); }}>
                  {error ?? notice}
                </div>
              )}

              {staged.length > 0 && (
                <div className="staging">
                  <div className="staging-head">
                    <span>
                      À poser : {stagedTotal} pts
                      {firstLaydown && ` / ${state.options.firstMeldMinPoints} requis`}
                      {firstLaydown && state.options.requirePureRun && (firstCheck?.hasPureRun ? " · tierce franche ✓" : " · tierce franche manquante")}
                    </span>
                    <button type="button" className="primary" disabled={firstLaydown ? !firstCheck?.ok : false} onClick={layDown}>
                      Poser sur la table
                    </button>
                  </div>
                  <div className="staging-melds">
                    {staged.map((m, i) => (
                      <div key={m.cards.map((c) => c.id).join("|")} className="meld staged">
                        {m.cards.map((c) => (
                          <CardView key={c.id} card={c} size="small" />
                        ))}
                        <button type="button" className="ghost tiny" onClick={() => unstage(i)} aria-label="Retirer">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="hand">
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

              <div className="actions">
                <div className="sort">
                  <button type="button" onClick={() => setHand((h) => sortBySuit(h))}>Trier ♠♥</button>
                  <button type="button" onClick={() => setHand((h) => sortByRank(h))}>Trier 1→K</button>
                  <button type="button" onClick={() => setSelected([])} disabled={selected.length === 0}>Désélectionner</button>
                </div>
                <div className="play">
                  <button type="button" disabled={!canPlay || selectedCards.length < 3} onClick={stage}>
                    Préparer la combinaison ({selectedCards.length})
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={!canPlay || selectedCards.length !== 1 || (hand.length > 1 && selectedCards[0]!.id === state.drewFromDiscardCardId)}
                    title={hand.length > 1 && selectedCards[0]?.id === state.drewFromDiscardCardId ? "Carte prise dans la défausse ce tour" : undefined}
                    onClick={discard}
                  >
                    Défausser
                  </button>
                </div>
              </div>
              {canPlay && me.hasLaidDown && selectedCards.length > 0 && (
                <p className="hint">Cliquez une combinaison sur la table pour y ajouter la sélection (ou échanger un joker).</p>
              )}
            </div>
          </section>
        </main>

        <Chat messages={chat} log={state.log} onSend={onSendChat} />
      </div>

      {state.phase === "finished" && (
        <div className="overlay">
          <div className="panel result">
            <h2>{state.winnerId === state.you.id ? "🏆 Vous remportez la manche !" : `${state.players.find((p) => p.id === state.winnerId)?.name} remporte la manche`}</h2>
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
              <button type="button" className="primary" onClick={() => onAct({ type: "newRound" })}>
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

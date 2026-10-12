import { useEffect, useRef } from "react";
import type { GameAction, PublicGameState } from "@visualrami/shared";
import { labels } from "../lib/labels";
import { resultTitle } from "../lib/roundResult";
import { CardView } from "./CardView";
import { Icon } from "./Icon";

interface Props {
  state: PublicGameState;
  connected: boolean;
  onAct: (action: GameAction) => Promise<boolean>;
}

/**
 * The count at the end of a round, laid on the felt: every losing hand face up with its points.
 * A drawn round (the stock ran out) has no winner row: every hand is shown and counted.
 * Not a modal: faces, chat and log stay live while the table talks it over. The host deals the
 * next round; the others say they are ready.
 */
export function RoundResult({ state, connected, onAct }: Props) {
  const title = useRef<HTMLHeadingElement>(null);
  const isHost = state.hostId === state.you.id;
  const meReady = state.ready.includes(state.you.id);
  const rows = [...state.players].sort((a, b) => Number(b.id === state.winnerId) - Number(a.id === state.winnerId));
  const guests = state.players.filter((p) => p.id !== state.hostId);
  // An absent player cannot answer: they are named apart rather than waited for.
  const present = guests.filter((p) => p.connected);
  const readyNames = present.filter((p) => state.ready.includes(p.id)).map((p) => p.name);
  const waitingNames = present.filter((p) => !state.ready.includes(p.id)).map((p) => p.name);
  const absentNames = guests.filter((p) => !p.connected).map((p) => p.name);

  // Appearing, the result takes focus on its heading, so it is read first; nothing is trapped.
  // Someone typing in the chat keeps their field.
  useEffect(() => {
    const typing = document.activeElement?.matches("input, textarea, [contenteditable]");
    if (!typing) title.current?.focus();
  }, []);

  return (
    <section className="round-result" role="region" aria-labelledby="result-title">
      <div className="result-head">
        <h2 id="result-title" tabIndex={-1} ref={title}>
          {resultTitle(state)}
        </h2>
        <div className="result-action">
          {isHost ? (
            <button type="button" className="primary" disabled={!connected} onClick={() => onAct({ type: "newRound" })}>
              {labels.newRound}
            </button>
          ) : (
            // Saying you are ready is the one thing left to do: it carries the lamp until it is done.
            <button
              type="button"
              className={meReady ? "ready-on" : "primary"}
              aria-pressed={meReady}
              disabled={!connected}
              onClick={() => onAct({ type: "ready", ready: !meReady })}
            >
              {meReady && <Icon name="check" />}
              {labels.ready}
            </button>
          )}
          <p className="result-status" aria-live="polite">
            {isHost ? labels.readySummary(readyNames, waitingNames, absentNames) : meReady ? labels.waitingHost : labels.readyPrompt}
          </p>
        </div>
      </div>

      <ul className="result-rows">
        {rows.map((p) => {
          const won = p.id === state.winnerId;
          const cards = state.revealedHands?.[p.id] ?? [];
          const doubled = !won && !p.hasLaidDown;
          return (
            <li key={p.id} className={won ? "winner" : undefined}>
              <span className="result-name">
                {p.id === state.you.id ? labels.youName(p.name) : p.name}
                {p.id === state.hostId ? (
                  <span className="tag">{labels.host}</span>
                ) : state.ready.includes(p.id) ? (
                  <span className="tag ready"><Icon name="check" />{labels.readyTag}</span>
                ) : null}
              </span>
              {won ? (
                <span className="result-cards empty">{labels.handEmpty}</span>
              ) : (
                <span className="result-cards" role="group" aria-label={labels.revealedHand(p.name)}>
                  {cards.map((c) => <CardView key={c.id} card={c} size="small" />)}
                </span>
              )}
              <span className="result-points">
                <b>{won ? labels.winnerPoints : `+${state.lastRoundPoints?.[p.id] ?? 0}`}</b>
                {doubled && <span className="result-penalty">{labels.doubledPenalty}</span>}
              </span>
              <span className="result-total">{labels.total(p.score)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

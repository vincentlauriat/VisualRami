import { useState } from "react";
import { MAX_PLAYERS, type PublicGameState } from "@visualrami/shared";
import type { WebRTCState } from "../lib/useWebRTC";
import { VideoTile } from "./VideoTile";
import { MediaControls } from "./MediaControls";
import { Icon, Mark } from "./Icon";
import { labels } from "../lib/labels";

interface Props {
  state: PublicGameState;
  rtc: WebRTCState;
  /** Live link to the server: starting needs it. */
  connected: boolean;
  onStart: () => void;
  onAddBot: () => Promise<boolean>;
  onRemoveBot: (playerId: string) => Promise<boolean>;
  onLeave: () => void;
}

export function Lobby({ state, rtc, connected, onStart, onAddBot, onRemoveBot, onLeave }: Props) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  // A computer being added or removed: its button waits for the answer, so a second press cannot
  // seat two computers or remove one twice.
  const [pending, setPending] = useState<"add" | string | null>(null);
  async function botRequest(which: "add" | string, request: () => Promise<boolean>) {
    setPending(which);
    try {
      await request();
    } finally {
      setPending(null);
    }
  }
  const isHost = state.hostId === state.you.id;
  const canStart = isHost && state.players.length >= 2;
  const tableFull = state.players.length >= MAX_PLAYERS;
  const me = state.players.find((p) => p.id === state.you.id);
  const link = `${location.origin}/?table=${state.roomId}`;

  async function copy(text: string, what: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard blocked: the code is still visible on screen
    }
  }

  return (
    <main className="lobby">
      <header className="topbar">
        <h1>
          <span className="logo"><Mark /></span> VisualRami
        </h1>
        <button type="button" className="ghost" onClick={onLeave}>
          Quitter
        </button>
      </header>

      <section className="panel code-panel">
        <p>Code de la table</p>
        <div className="code-row">
          <strong className="room-code">{state.roomId}</strong>
          {/* The link is what travels: it is the lamp here, unless the host can start the game now. */}
          <button type="button" className={canStart ? undefined : "primary"} onClick={() => copy(link, "link")}>
            {copied === "link" ? "Lien copié" : "Copier le lien"}
          </button>
          <button type="button" onClick={() => copy(state.roomId, "code")}>
            {copied === "code" ? "Code copié" : "Copier le code"}
          </button>
        </div>
        <p className="hint">
          Première pose : {state.options.firstMeldMinPoints} points
          {state.options.requirePureRun ? ", tierce franche obligatoire" : ""}.
        </p>
      </section>

      <section className="video-grid">
        <VideoTile stream={rtc.localStream} name={me?.name ?? "Vous"} suffix="(vous)" muted mirror micOff={!rtc.micOn} />
        {state.players
          .filter((p) => p.id !== state.you.id)
          .map((p) => (
            <VideoTile
              key={p.id}
              stream={p.isBot ? null : rtc.remoteStreams[p.id] ?? null}
              videoOff={rtc.remoteCamOff[p.id]}
              micOff={rtc.remoteMicOff[p.id]}
              name={p.name}
              offline={!p.connected}
              bot={p.isBot}
            />
          ))}
      </section>

      <MediaControls rtc={rtc} />

      <section className="panel">
        <h2>Joueurs ({state.players.length}/{MAX_PLAYERS})</h2>
        <ul className="player-list">
          {state.players.map((p) => (
            <li key={p.id}>
              {p.isBot ? <Icon name="bot" /> : <span className={`dot${p.connected ? " on" : ""}`} />}
              {p.name}
              {p.isBot && (
                <span className="tag">
                  <span aria-hidden>{labels.botTag}</span>
                  <span className="sr-only">{labels.botSpoken}</span>
                </span>
              )}
              {p.id === state.hostId && <span className="tag">hôte</span>}
              {p.id === state.you.id && <span className="tag you">vous</span>}
              {isHost && p.isBot && (
                <button
                  type="button"
                  className="ghost tiny remove-bot"
                  disabled={!connected || pending !== null}
                  aria-busy={pending === p.id || undefined}
                  onClick={() => void botRequest(p.id, () => onRemoveBot(p.id))}
                  aria-label={labels.removeBot(p.name)}
                >
                  <Icon name="close" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {isHost ? (
          <div className="lobby-actions">
            {/* Never gold: the link (or Lancer la partie, once possible) keeps the lamp. */}
            {!tableFull && (
              <button
                type="button"
                disabled={!connected || pending !== null}
                aria-busy={pending === "add" || undefined}
                onClick={() => void botRequest("add", onAddBot)}
              >
                <Icon name="bot" />
                {labels.addBot}
              </button>
            )}
            <button type="button" className="primary" disabled={state.players.length < 2 || !connected} onClick={onStart}>
              {state.players.length < 2 ? labels.waitSecondPlayer : "Lancer la partie"}
            </button>
            {state.players.length < 2 && <p className="hint">{labels.waitOrAddBot}</p>}
          </div>
        ) : (
          <p className="hint">En attente que l'hôte lance la partie…</p>
        )}
      </section>
    </main>
  );
}

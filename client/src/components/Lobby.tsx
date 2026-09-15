import { useState } from "react";
import type { PublicGameState } from "@visualrami/shared";
import type { WebRTCState } from "../lib/useWebRTC";
import { VideoTile } from "./VideoTile";
import { MediaControls } from "./MediaControls";

interface Props {
  state: PublicGameState;
  rtc: WebRTCState;
  onStart: () => void;
  onLeave: () => void;
}

export function Lobby({ state, rtc, onStart, onLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const isHost = state.hostId === state.you.id;
  const me = state.players.find((p) => p.id === state.you.id);
  const link = `${location.origin}/?table=${state.roomId}`;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the code is still visible on screen
    }
  }

  return (
    <main className="lobby">
      <header className="topbar">
        <h1>
          <span className="logo">🃏</span> VisualRami
        </h1>
        <button type="button" className="ghost" onClick={onLeave}>
          Quitter
        </button>
      </header>

      <section className="panel code-panel">
        <p>Code de la table</p>
        <div className="code-row">
          <strong className="room-code">{state.roomId}</strong>
          <button type="button" onClick={() => copy(state.roomId)}>
            {copied ? "Copié !" : "Copier le code"}
          </button>
          <button type="button" onClick={() => copy(link)}>
            Copier le lien
          </button>
        </div>
        <p className="hint">
          Première pose : {state.options.firstMeldMinPoints} points
          {state.options.requirePureRun ? ", tierce franche obligatoire" : ""}.
        </p>
      </section>

      <section className="video-grid">
        <VideoTile stream={rtc.localStream} name={me?.name ?? "Vous"} suffix="(vous)" muted mirror />
        {state.players
          .filter((p) => p.id !== state.you.id)
          .map((p) => (
            <VideoTile key={p.id} stream={rtc.remoteStreams[p.id] ?? null} name={p.name} offline={!p.connected} />
          ))}
      </section>

      <MediaControls rtc={rtc} />

      <section className="panel">
        <h2>Joueurs ({state.players.length}/4)</h2>
        <ul className="player-list">
          {state.players.map((p) => (
            <li key={p.id}>
              <span className={`dot${p.connected ? " on" : ""}`} />
              {p.name}
              {p.id === state.hostId && <span className="tag">hôte</span>}
              {p.id === state.you.id && <span className="tag you">vous</span>}
            </li>
          ))}
        </ul>
        {isHost ? (
          <button type="button" className="primary" disabled={state.players.length < 2} onClick={onStart}>
            {state.players.length < 2 ? "En attente d'un second joueur…" : "Lancer la partie"}
          </button>
        ) : (
          <p className="hint">En attente que l'hôte lance la partie…</p>
        )}
      </section>
    </main>
  );
}

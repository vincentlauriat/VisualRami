import { useState } from "react";
import { MAX_PLAYERS, type PublicGameState } from "@visualrami/shared";
import type { WebRTCState } from "../lib/useWebRTC";
import { VideoTile } from "./VideoTile";
import { MediaControls } from "./MediaControls";
import { Mark } from "./Icon";

interface Props {
  state: PublicGameState;
  rtc: WebRTCState;
  /** Live link to the server: starting needs it. */
  connected: boolean;
  onStart: () => void;
  onLeave: () => void;
}

export function Lobby({ state, rtc, connected, onStart, onLeave }: Props) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const isHost = state.hostId === state.you.id;
  const canStart = isHost && state.players.length >= 2;
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
            <VideoTile key={p.id} stream={rtc.remoteStreams[p.id] ?? null} videoOff={rtc.remoteCamOff[p.id]} micOff={rtc.remoteMicOff[p.id]} name={p.name} offline={!p.connected} />
          ))}
      </section>

      <MediaControls rtc={rtc} />

      <section className="panel">
        <h2>Joueurs ({state.players.length}/{MAX_PLAYERS})</h2>
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
          <button type="button" className="primary" disabled={state.players.length < 2 || !connected} onClick={onStart}>
            {state.players.length < 2 ? "En attente d'un second joueur…" : "Lancer la partie"}
          </button>
        ) : (
          <p className="hint">En attente que l'hôte lance la partie…</p>
        )}
      </section>
    </main>
  );
}

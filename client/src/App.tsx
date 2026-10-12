import { useEffect, useMemo } from "react";
import { useGame } from "./lib/useGame";
import { useWebRTC } from "./lib/useWebRTC";
import { Home } from "./components/Home";
import { Lobby } from "./components/Lobby";
import { Game } from "./components/Game";
import { labels } from "./lib/labels";

export function App() {
  const game = useGame();
  const peerIds = useMemo(() => game.state?.players.map((p) => p.id) ?? [], [game.state?.players]);
  const rtc = useWebRTC(game.session?.playerId ?? null, peerIds, game.epoch);
  const initialCode = useMemo(() => new URLSearchParams(location.search).get("table") ?? undefined, []);

  // Ask for camera/mic as soon as we are seated at a table.
  useEffect(() => {
    if (game.session && rtc.mediaStatus === "idle") void rtc.startMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.session?.roomId]);

  if (!game.session || !game.state) {
    return (
      <>
        <Home
          connected={game.connected}
          initialCode={initialCode}
          onCreate={game.create}
          onJoin={game.join}
          onResume={game.resume}
        />
        {game.session && !game.state && <div className="reconnecting">Reconnexion à la table {game.session.roomId}…</div>}
        {game.error && <div className="toast global" role="alert" onClick={game.clearError}>{game.error}</div>}
      </>
    );
  }

  if (game.state.phase === "lobby") {
    return (
      <>
        <Lobby state={game.state} rtc={rtc} connected={game.connected} onStart={() => game.act({ type: "start" })} onLeave={game.leave} />
        <div role="status">{!game.connected && <div className="reconnecting">{labels.connectionLost}</div>}</div>
        {game.error && <div className="toast global" role="alert" onClick={game.clearError}>{game.error}</div>}
      </>
    );
  }

  return (
    <Game
      state={game.state}
      rtc={rtc}
      chat={game.chat}
      error={game.error}
      connected={game.connected}
      onAct={game.act}
      onLeave={game.leave}
      onSendChat={game.sendChat}
      onClearError={game.clearError}
    />
  );
}

import { useEffect, useRef } from "react";
import { labels } from "../lib/labels";
import { Icon } from "./Icon";

interface Props {
  stream: MediaStream | null;
  name: string;
  suffix?: string;
  muted?: boolean;
  mirror?: boolean;
  small?: boolean;
  badge?: string;
  active?: boolean;
  offline?: boolean;
  /** The peer said its camera is off; its track keeps sending black frames. */
  videoOff?: boolean;
  /** The player's microphone is muted (for a peer: as it reported it). */
  micOff?: boolean;
  /** This player just won the round: their face is the hero of the count. */
  winner?: boolean;
  /** Another player's badge: neutral, since gold is reserved for what is yours. */
  badgeMuted?: boolean;
}

export function VideoTile({ stream, name, suffix, muted, mirror, small, badge, active, offline, videoOff, micOff, winner, badgeMuted }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) el.play().catch(() => undefined);
  }, [stream]);
  const hasVideo = !videoOff && stream?.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
  return (
    <div className={`video-tile${small ? " small" : ""}${active ? " active" : ""}${offline ? " offline" : ""}${winner ? " winner" : ""}`}>
      <video ref={ref} autoPlay playsInline muted={muted} className={mirror ? "mirror" : ""} />
      {!hasVideo && (
        <div className="video-placeholder" aria-hidden>
          <span>{initials(name)}</span>
        </div>
      )}
      {winner && !offline && (
        <p className="video-status video-winner">
          <Icon name="crown" />
          <span className="winner-long">{labels.winnerTile}</span>
          <span className="winner-short" aria-hidden>{labels.winnerTileShort}</span>
        </p>
      )}
      {/* Read with the name: "Bruno, absent, sa place est gardée". */}
      {offline && (
        <p className="video-status">
          <span>{labels.peerAbsent}</span>
          <span className="video-status-more"> · {labels.peerSeatKept}</span>
        </p>
      )}
      {micOff && !offline && (
        <span className="video-mic" role="img" aria-label={labels.micOff(name)}>
          <Icon name="micOff" />
        </span>
      )}
      <div className="video-name">
        <span className="video-label">{name}</span>
        {suffix && <span className="video-suffix">{suffix}</span>}
        {badge && <span className={`video-badge${badgeMuted ? " muted" : ""}`}>{badge}</span>}
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

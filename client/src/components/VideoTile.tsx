import { useEffect, useRef } from "react";

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
}

export function VideoTile({ stream, name, suffix, muted, mirror, small, badge, active, offline }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) el.play().catch(() => undefined);
  }, [stream]);
  const hasVideo = stream?.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
  return (
    <div className={`video-tile${small ? " small" : ""}${active ? " active" : ""}${offline ? " offline" : ""}`}>
      <video ref={ref} autoPlay playsInline muted={muted} className={mirror ? "mirror" : ""} />
      {!hasVideo && (
        <div className="video-placeholder" aria-hidden>
          <span>{initials(name)}</span>
        </div>
      )}
      <div className="video-name">
        <span>{name}{suffix ? ` ${suffix}` : ""}</span>
        {badge && <span className="video-badge">{badge}</span>}
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

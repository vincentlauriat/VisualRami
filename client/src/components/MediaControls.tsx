import type { WebRTCState } from "../lib/useWebRTC";

export function MediaControls({ rtc, compact }: { rtc: WebRTCState; compact?: boolean }) {
  const canToggle = rtc.mediaStatus === "ready" || rtc.mediaStatus === "audio-only";
  return (
    <div className={`media-controls${compact ? " compact" : ""}`}>
      {rtc.mediaStatus === "idle" || rtc.mediaStatus === "denied" ? (
        <button type="button" onClick={() => rtc.startMedia()}>
          🎥 Activer caméra et micro
        </button>
      ) : (
        <>
          <button type="button" onClick={rtc.toggleMic} disabled={!canToggle} className={rtc.micOn ? "" : "off"}>
            {rtc.micOn ? "🎙️ Micro" : "🔇 Micro coupé"}
          </button>
          <button
            type="button"
            onClick={rtc.toggleCam}
            disabled={rtc.mediaStatus !== "ready"}
            className={rtc.camOn ? "" : "off"}
          >
            {rtc.camOn ? "📷 Caméra" : "🚫 Caméra coupée"}
          </button>
        </>
      )}
      {rtc.mediaError && <span className="hint warn">{rtc.mediaError}</span>}
    </div>
  );
}

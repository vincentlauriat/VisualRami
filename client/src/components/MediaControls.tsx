import type { WebRTCState } from "../lib/useWebRTC";
import { Icon } from "./Icon";

export function MediaControls({ rtc, compact }: { rtc: WebRTCState; compact?: boolean }) {
  const canToggle = rtc.mediaStatus === "ready" || rtc.mediaStatus === "audio-only";
  return (
    <div className={`media-controls${compact ? " compact" : ""}`}>
      {rtc.mediaStatus === "idle" || rtc.mediaStatus === "denied" ? (
        <button type="button" onClick={() => rtc.startMedia()} aria-label="Activer caméra et micro">
          <Icon name="camera" /><span className="btn-label">Activer caméra et micro</span>
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={rtc.toggleMic}
            disabled={!canToggle}
            className={rtc.micOn ? "" : "off"}
            aria-label={rtc.micOn ? "Micro" : "Micro coupé"}
          >
            {rtc.micOn ? <><Icon name="mic" /><span className="btn-label">Micro</span></> : <><Icon name="micOff" /><span className="btn-label">Micro coupé</span></>}
          </button>
          <button
            type="button"
            onClick={rtc.toggleCam}
            disabled={rtc.mediaStatus !== "ready"}
            className={rtc.camOn ? "" : "off"}
            aria-label={rtc.camOn ? "Caméra" : "Caméra coupée"}
          >
            {rtc.camOn ? <><Icon name="camera" /><span className="btn-label">Caméra</span></> : <><Icon name="cameraOff" /><span className="btn-label">Caméra coupée</span></>}
          </button>
        </>
      )}
      {rtc.mediaError && <span className="hint warn">{rtc.mediaError}</span>}
    </div>
  );
}

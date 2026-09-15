import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "./socket";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];
// Optional TURN relay for players behind symmetric NATs (set at build time).
const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
if (turnUrl) {
  ICE_SERVERS.push({
    urls: turnUrl.split(",").map((u) => u.trim()),
    username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
    credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
  });
}

/** A connection that has not reached "stable" + "connected" within this delay is rebuilt. */
const NEGOTIATION_TIMEOUT_MS = 8000;

interface PeerEntry {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  pending: RTCIceCandidateInit[];
  watchdog: ReturnType<typeof setTimeout> | null;
}

export type MediaStatus = "idle" | "requesting" | "ready" | "audio-only" | "denied" | "unsupported";

export interface WebRTCState {
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  mediaStatus: MediaStatus;
  mediaError: string | null;
  micOn: boolean;
  camOn: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
  startMedia: () => Promise<void>;
}

/**
 * Full-mesh WebRTC between every player of the room, signalled through Socket.IO.
 * Uses the "perfect negotiation" pattern so both sides can add tracks at any time.
 */
export function useWebRTC(selfId: string | null, peerIds: string[], epoch: number): WebRTCState {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [mediaStatus, setMediaStatus] = useState<MediaStatus>("idle");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const peers = useRef(new Map<string, PeerEntry>());
  const wanted = useRef(new Set<string>());
  const localRef = useRef<MediaStream | null>(null);
  const selfRef = useRef(selfId);
  selfRef.current = selfId;

  const startMedia = useCallback(async () => {
    if (localRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMediaStatus("unsupported");
      setMediaError(
        window.isSecureContext
          ? "Ce navigateur ne permet pas l'accès à la caméra."
          : "Caméra et micro nécessitent HTTPS (ou http://localhost).",
      );
      return;
    }
    setMediaStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localRef.current = stream;
      setLocalStream(stream);
      setMediaStatus("ready");
      setMediaError(null);
    } catch (err) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localRef.current = stream;
        setLocalStream(stream);
        setMediaStatus("audio-only");
        setMediaError("Caméra indisponible : audio uniquement.");
      } catch {
        setMediaStatus("denied");
        setMediaError(`Accès caméra/micro refusé (${(err as Error).name}).`);
      }
    }
  }, []);

  const stopMedia = useCallback(() => {
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setLocalStream(null);
    setMediaStatus("idle");
    setMediaError(null);
    setMicOn(true);
    setCamOn(true);
  }, []);

  const send = useCallback((to: string, data: unknown) => {
    socket.emit("rtc:signal", { to, data });
  }, []);

  const closePeer = useCallback((peerId: string) => {
    const entry = peers.current.get(peerId);
    if (!entry) return;
    if (entry.watchdog) clearTimeout(entry.watchdog);
    entry.pc.onnegotiationneeded = null;
    entry.pc.onicecandidate = null;
    entry.pc.ontrack = null;
    entry.pc.onconnectionstatechange = null;
    entry.pc.close();
    peers.current.delete(peerId);
    setRemoteStreams((streams) => {
      if (!(peerId in streams)) return streams;
      const next = { ...streams };
      delete next[peerId];
      return next;
    });
  }, []);

  const closeAll = useCallback(() => {
    for (const id of Array.from(peers.current.keys())) closePeer(id);
  }, [closePeer]);

  const getOrCreatePeer = useCallback(
    (peerId: string): PeerEntry => {
      const existing = peers.current.get(peerId);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const self = selfRef.current ?? "";
      const entry: PeerEntry = {
        pc,
        polite: self > peerId,
        makingOffer: false,
        ignoreOffer: false,
        pending: [],
        watchdog: null,
      };
      peers.current.set(peerId, entry);

      const rebuild = () => {
        if (peers.current.get(peerId) !== entry) return;
        closePeer(peerId);
        if (wanted.current.has(peerId) && localRef.current) getOrCreatePeer(peerId);
      };
      const armWatchdog = () => {
        if (entry.watchdog) clearTimeout(entry.watchdog);
        entry.watchdog = setTimeout(() => {
          entry.watchdog = null;
          const settled = pc.signalingState === "stable" && pc.connectionState === "connected";
          if (!settled && pc.connectionState !== "connecting") rebuild();
          else if (!settled) armWatchdog();
        }, NEGOTIATION_TIMEOUT_MS);
      };

      pc.onnegotiationneeded = async () => {
        try {
          entry.makingOffer = true;
          await pc.setLocalDescription();
          send(peerId, { description: pc.localDescription });
          armWatchdog();
        } catch (err) {
          console.warn("negotiation failed", err);
        } finally {
          entry.makingOffer = false;
        }
      };
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) send(peerId, { candidate });
      };
      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        setRemoteStreams((streams) => ({ ...streams, [peerId]: stream }));
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected" && entry.watchdog) {
          clearTimeout(entry.watchdog);
          entry.watchdog = null;
        } else if (pc.connectionState === "disconnected") {
          pc.restartIce();
          armWatchdog();
        } else if (pc.connectionState === "failed") {
          rebuild();
        }
      };
      const local = localRef.current;
      if (local) {
        for (const track of local.getTracks()) pc.addTrack(track, local);
      }
      return entry;
    },
    [closePeer, send],
  );

  // Signal handling (perfect negotiation).
  useEffect(() => {
    const onSignal = async ({ from, data }: { from: string; data: Record<string, unknown> }) => {
      if (!selfRef.current || !data || !wanted.current.has(from)) return;
      const entry = getOrCreatePeer(from);
      const { pc } = entry;
      try {
        if (data.description) {
          const description = data.description as RTCSessionDescriptionInit;
          const offerCollision =
            description.type === "offer" && (entry.makingOffer || pc.signalingState !== "stable");
          entry.ignoreOffer = !entry.polite && offerCollision;
          if (entry.ignoreOffer) return;
          await pc.setRemoteDescription(description);
          for (const candidate of entry.pending.splice(0)) {
            await pc.addIceCandidate(candidate).catch(() => undefined);
          }
          if (description.type === "offer") {
            await pc.setLocalDescription();
            send(from, { description: pc.localDescription });
          }
        } else if (data.candidate) {
          const candidate = data.candidate as RTCIceCandidateInit;
          if (!pc.remoteDescription) {
            entry.pending.push(candidate);
            return;
          }
          try {
            await pc.addIceCandidate(candidate);
          } catch (err) {
            if (!entry.ignoreOffer) throw err;
          }
        }
      } catch (err) {
        console.warn("signal error", err);
      }
    };
    const onPeerLeft = ({ playerId }: { playerId: string }) => closePeer(playerId);
    const onPeerReset = ({ playerId }: { playerId: string }) => {
      closePeer(playerId);
      if (wanted.current.has(playerId) && localRef.current) getOrCreatePeer(playerId);
    };
    // Our socket (re)connected: every previous connection is stale. Tear down synchronously,
    // before the server can relay any offer triggered by our rejoin.
    const onConnect = () => closeAll();
    socket.on("rtc:signal", onSignal);
    socket.on("rtc:peer-left", onPeerLeft);
    socket.on("rtc:peer-reset", onPeerReset);
    socket.on("connect", onConnect);
    return () => {
      socket.off("rtc:signal", onSignal);
      socket.off("rtc:peer-left", onPeerLeft);
      socket.off("rtc:peer-reset", onPeerReset);
      socket.off("connect", onConnect);
    };
  }, [closeAll, closePeer, getOrCreatePeer, send]);

  // When our own room session changes (join / rejoin), start from a clean mesh.
  useEffect(() => {
    closeAll();
  }, [epoch, closeAll]);

  // Leaving the table: release camera and microphone.
  useEffect(() => {
    if (selfId === null) stopMedia();
  }, [selfId, stopMedia]);

  // Keep one connection per peer currently in the room.
  const peerKey = peerIds.slice().sort().join(",");
  useEffect(() => {
    wanted.current = selfId ? new Set(peerIds.filter((id) => id !== selfId)) : new Set<string>();
    for (const id of Array.from(peers.current.keys())) {
      if (!wanted.current.has(id)) closePeer(id);
    }
    if (selfId && localStream) {
      for (const id of wanted.current) getOrCreatePeer(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfId, peerKey, localStream, epoch, closePeer, getOrCreatePeer]);

  // Add local tracks to connections created before media was ready.
  useEffect(() => {
    if (!localStream) return;
    for (const entry of peers.current.values()) {
      const senders = entry.pc.getSenders();
      for (const track of localStream.getTracks()) {
        if (!senders.some((s) => s.track === track)) entry.pc.addTrack(track, localStream);
      }
    }
  }, [localStream]);

  // Release everything on unmount.
  useEffect(() => {
    return () => {
      closeAll();
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
    };
  }, [closeAll]);

  const toggleMic = useCallback(() => {
    const stream = localRef.current;
    if (!stream) return;
    const next = !micOn;
    stream.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, [micOn]);

  const toggleCam = useCallback(() => {
    const stream = localRef.current;
    if (!stream) return;
    const next = !camOn;
    stream.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
  }, [camOn]);

  return { localStream, remoteStreams, mediaStatus, mediaError, micOn, camOn, toggleMic, toggleCam, startMedia };
}

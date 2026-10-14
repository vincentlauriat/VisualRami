import { useCallback, useEffect, useRef, useState } from "react";
import type { BotLevel, GameAction, GameOptions, PublicGameState } from "@visualrami/shared";
import { isTransportError } from "./requestError";
import { forgetSeat, loadSeat, loadSession, request, saveSession, socket, type Session } from "./socket";

export interface ChatMessage {
  from: string;
  name: string;
  text: string;
  at: number;
}

export interface GameConnection {
  /**
   * The socket is up and, when we hold a seat, attached to it again. False during a drop: the
   * state on screen is stale and nothing may be sent (Socket.IO would replay it on reconnect).
   */
  connected: boolean;
  session: Session | null;
  state: PublicGameState | null;
  error: string | null;
  chat: ChatMessage[];
  /** Incremented every time the socket (re)joins the room; peers must renegotiate. */
  epoch: number;
  clearError: () => void;
  create: (name: string, options: Partial<GameOptions>) => Promise<void>;
  join: (roomId: string, name: string) => Promise<void>;
  /** Take a remembered seat back (token first, then code + name as a fallback). */
  resume: (roomId: string, name: string) => Promise<void>;
  /** Leave the table. A started game keeps the seat, so the player can come back with the code. */
  leave: () => Promise<void>;
  act: (action: GameAction) => Promise<boolean>;
  /** The host seats a computer player in the lobby. */
  addBot: (level: BotLevel) => Promise<boolean>;
  removeBot: (playerId: string) => Promise<boolean>;
  /**
   * Create a table, seat `bots` computer players and start. A failure after the table exists
   * leaves the player in its lobby with the error, never on a table half set up.
   */
  playSolo: (name: string, bots: number, options: Partial<GameOptions>, level: BotLevel) => Promise<void>;
  /** False when offline: the message was not sent and stays in the field. */
  sendChat: (text: string) => boolean;
}

export function useGame(): GameConnection {
  const [connected, setConnected] = useState(() => socket.connected && !loadSession());
  // Read synchronously by act/sendChat: a tap must not slip in before React re-renders.
  const liveRef = useRef(connected);
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [state, setState] = useState<PublicGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [epoch, setEpoch] = useState(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    const live = (value: boolean) => {
      liveRef.current = value;
      setConnected(value);
    };
    let retry: ReturnType<typeof setTimeout> | null = null;
    const onConnect = async () => {
      if (retry) clearTimeout(retry);
      retry = null;
      const s = sessionRef.current;
      if (!s) return live(true);
      try {
        await request("room:rejoin", { roomId: s.roomId, playerId: s.playerId, token: s.token });
        live(true);
        setEpoch((e) => e + 1);
      } catch (err) {
        // No answer is not a refusal: keep the seat. A dropped socket retries on its next
        // "connect"; a socket still up but silent (timeout) gets asked again shortly.
        if (isTransportError(err)) {
          if (socket.connected) retry = setTimeout(() => void onConnect(), 2000);
          return;
        }
        live(socket.connected);
        saveSession(null);
        forgetSeat(s.roomId);
        setSession(null);
        setState(null);
        setError((err as Error).message);
      }
    };
    const onDisconnect = () => live(false);
    // The OS knows before the socket does: a half-open connection takes ~45 s to emit "disconnect".
    const onOffline = () => live(false);
    // Back online with a socket that never dropped: no "connect" will come, so take the seat back now.
    const onOnline = () => {
      if (socket.connected && !liveRef.current) void onConnect();
    };
    const onState = (s: PublicGameState) => setState(s);
    const onChat = (m: ChatMessage) => setChat((c) => [...c.slice(-99), m]);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:state", onState);
    socket.on("chat:message", onChat);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    if (socket.connected) void onConnect();
    return () => {
      if (retry) clearTimeout(retry);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:state", onState);
      socket.off("chat:message", onChat);
    };
  }, []);

  const create = useCallback(async (name: string, options: Partial<GameOptions>) => {
    const res = await request<{ roomId: string; playerId: string; token: string }>("room:create", {
      name,
      options,
    });
    const s = { ...res, name };
    saveSession(s);
    setSession(s);
    setChat([]);
    setEpoch((e) => e + 1);
  }, []);

  const join = useCallback(async (roomId: string, name: string) => {
    const res = await request<{ roomId: string; playerId: string; token: string }>("room:join", {
      roomId,
      name,
    });
    const s = { roomId: res.roomId, playerId: res.playerId, token: res.token, name };
    saveSession(s);
    setSession(s);
    setChat([]);
    setEpoch((e) => e + 1);
  }, []);

  const resume = useCallback(
    async (roomId: string, name: string) => {
      const seat = loadSeat(roomId);
      if (seat) {
        try {
          await request("room:rejoin", { roomId: seat.roomId, playerId: seat.playerId, token: seat.token });
          const s = { roomId: seat.roomId, playerId: seat.playerId, token: seat.token, name: seat.name };
          saveSession(s);
          setSession(s);
          setChat([]);
          setEpoch((e) => e + 1);
          return;
        } catch (err) {
          if (isTransportError(err)) throw err; // no answer: the seat may well be fine, keep it
          forgetSeat(roomId); // stale token or vanished table: fall back to code + name
        }
      }
      await join(roomId, name || seat?.name || "");
    },
    [join],
  );

  const leave = useCallback(async () => {
    const roomId = sessionRef.current?.roomId;
    const inProgress = !!state && state.phase !== "lobby";
    try {
      // Offline, the server already holds the seat as absent; a buffered leave would only replay later.
      if (liveRef.current) await request("room:leave");
    } catch {
      // leaving is best-effort
    }
    saveSession(null);
    if (roomId && !inProgress) forgetSeat(roomId);
    setSession(null);
    setState(null);
    setChat([]);
  }, [state]);

  const act = useCallback(async (action: GameAction) => {
    if (!liveRef.current) return false;
    try {
      await request("game:action", action);
      setError(null);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }, []);

  const addBot = useCallback(async (level: BotLevel) => {
    if (!liveRef.current) return false;
    try {
      await request("room:addBot", { level });
      setError(null);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }, []);

  const removeBot = useCallback(async (playerId: string) => {
    if (!liveRef.current) return false;
    try {
      await request("room:removeBot", { playerId });
      setError(null);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }, []);

  const playSolo = useCallback(
    async (name: string, bots: number, options: Partial<GameOptions>, level: BotLevel) => {
      await create(name, options);
      try {
        for (let i = 0; i < bots; i++) await request("room:addBot", { level });
        await request("game:action", { type: "start" });
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [create],
  );

  const sendChat = useCallback((text: string): boolean => {
    if (!liveRef.current) return false;
    socket.emit("chat:message", text);
    return true;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    connected,
    session,
    state,
    error,
    chat,
    epoch,
    clearError,
    create,
    join,
    resume,
    leave,
    act,
    addBot,
    removeBot,
    playSolo,
    sendChat,
  };
}

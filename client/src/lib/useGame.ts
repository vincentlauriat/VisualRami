import { useCallback, useEffect, useRef, useState } from "react";
import type { GameAction, GameOptions, PublicGameState } from "@visualrami/shared";
import { forgetSeat, loadSeat, loadSession, request, saveSession, socket, type Session } from "./socket";

export interface ChatMessage {
  from: string;
  name: string;
  text: string;
  at: number;
}

export interface GameConnection {
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
  sendChat: (text: string) => void;
}

export function useGame(): GameConnection {
  const [connected, setConnected] = useState(socket.connected);
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [state, setState] = useState<PublicGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [epoch, setEpoch] = useState(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    const onConnect = async () => {
      setConnected(true);
      const s = sessionRef.current;
      if (!s) return;
      try {
        await request("room:rejoin", { roomId: s.roomId, playerId: s.playerId, token: s.token });
        setEpoch((e) => e + 1);
      } catch (err) {
        saveSession(null);
        forgetSeat(s.roomId);
        setSession(null);
        setState(null);
        setError((err as Error).message);
      }
    };
    const onDisconnect = () => setConnected(false);
    const onState = (s: PublicGameState) => setState(s);
    const onChat = (m: ChatMessage) => setChat((c) => [...c.slice(-99), m]);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:state", onState);
    socket.on("chat:message", onChat);
    if (socket.connected) void onConnect();
    return () => {
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
        } catch {
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
      await request("room:leave");
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
    try {
      await request("game:action", action);
      setError(null);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }, []);

  const sendChat = useCallback((text: string) => {
    socket.emit("chat:message", text);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { connected, session, state, error, chat, epoch, clearError, create, join, resume, leave, act, sendChat };
}

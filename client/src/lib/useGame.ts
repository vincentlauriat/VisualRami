import { useCallback, useEffect, useRef, useState } from "react";
import type { GameAction, GameOptions, PublicGameState } from "@visualrami/shared";
import { loadSession, request, saveSession, socket, type Session } from "./socket";

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
    const s = { ...res, name };
    saveSession(s);
    setSession(s);
    setChat([]);
    setEpoch((e) => e + 1);
  }, []);

  const leave = useCallback(async () => {
    try {
      await request("room:leave");
    } catch {
      // leaving is best-effort
    }
    saveSession(null);
    setSession(null);
    setState(null);
    setChat([]);
  }, []);

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

  return { connected, session, state, error, chat, epoch, clearError, create, join, leave, act, sendChat };
}

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { GameOptions } from "@visualrami/shared";
import type { ChatMessage } from "../lib/useGame";
import { Icon } from "./Icon";
import { Rules } from "./Rules";

interface Props {
  messages: ChatMessage[];
  log: string[];
  /** This table's options: the Règles tab states them as they apply here. */
  options: GameOptions;
  /** Returns false when the message could not be sent (offline): the text then stays in the field. */
  onSend: (text: string) => boolean;
  /** No connection: sending waits, typing does not. */
  offline?: boolean;
  /** Closes the panel when it is shown as a bottom sheet (phones). */
  onClose?: () => void;
}

/** One DOM node per game event: a seven-day table would otherwise grow the log without bound. */
const LOG_LINES = 200;

export function Chat({ messages, log, options, onSend, offline, onClose }: Props) {
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"log" | "chat" | "rules">("log");
  const body = useRef<HTMLDivElement>(null);

  // Scroll the panel itself. scrollIntoView would also scroll every ancestor, the window included.
  useEffect(() => {
    const el = body.current;
    // Log and chat read from the latest line; the rules read from the top.
    if (el) el.scrollTop = tab === "rules" ? 0 : el.scrollHeight;
  }, [messages, log, tab]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (onSend(t)) setText("");
  }

  return (
    <aside className="side" id="side-panel" aria-label="Journal, chat et règles">
      <div className="tabs">
        <button type="button" className={tab === "log" ? "on" : ""} aria-pressed={tab === "log"} onClick={() => setTab("log")}>
          Journal
        </button>
        <button type="button" className={tab === "chat" ? "on" : ""} aria-pressed={tab === "chat"} onClick={() => setTab("chat")}>
          Chat {messages.length > 0 && <span className="tag">{messages.length}</span>}
        </button>
        <button type="button" className={tab === "rules" ? "on" : ""} aria-pressed={tab === "rules"} onClick={() => setTab("rules")}>
          Règles
        </button>
        {onClose && (
          <button type="button" className="side-close" onClick={onClose} aria-label="Fermer le journal, le chat et les règles">
            <Icon name="close" />
          </button>
        )}
      </div>
      <div className="side-body" ref={body}>
        {tab === "rules" ? (
          <Rules options={options} />
        ) : tab === "log" ? (
          log.slice(-LOG_LINES).map((line, i) => (
            <p key={i} className="log-line">
              {line}
            </p>
          ))
        ) : (
          messages.map((m, i) => (
            <p key={i} className="chat-line">
              <b>{m.name}</b> {m.text}
            </p>
          ))
        )}
      </div>
      {tab === "chat" && (
        <form className="chat-form" onSubmit={submit}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" aria-label="Message" maxLength={300} />
          <button type="submit" disabled={offline}>Envoyer</button>
        </form>
      )}
    </aside>
  );
}

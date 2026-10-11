import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage } from "../lib/useGame";
import { Icon } from "./Icon";

interface Props {
  messages: ChatMessage[];
  log: string[];
  onSend: (text: string) => void;
  /** Closes the panel when it is shown as a bottom sheet (phones). */
  onClose?: () => void;
}

/** One DOM node per game event: a seven-day table would otherwise grow the log without bound. */
const LOG_LINES = 200;

export function Chat({ messages, log, onSend, onClose }: Props) {
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"log" | "chat">("log");
  const body = useRef<HTMLDivElement>(null);

  // Scroll the panel itself. scrollIntoView would also scroll every ancestor, the window included.
  useEffect(() => {
    const el = body.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, log, tab]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <aside className="side" id="side-panel" aria-label="Journal et chat">
      <div className="tabs">
        <button type="button" className={tab === "log" ? "on" : ""} aria-pressed={tab === "log"} onClick={() => setTab("log")}>
          Journal
        </button>
        <button type="button" className={tab === "chat" ? "on" : ""} aria-pressed={tab === "chat"} onClick={() => setTab("chat")}>
          Chat {messages.length > 0 && <span className="tag">{messages.length}</span>}
        </button>
        {onClose && (
          <button type="button" className="side-close" onClick={onClose} aria-label="Fermer le journal et le chat">
            <Icon name="close" />
          </button>
        )}
      </div>
      <div className="side-body" ref={body}>
        {tab === "log"
          ? log.slice(-LOG_LINES).map((line, i) => (
              <p key={i} className="log-line">
                {line}
              </p>
            ))
          : messages.map((m, i) => (
              <p key={i} className="chat-line">
                <b>{m.name}</b> {m.text}
              </p>
            ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" aria-label="Message" maxLength={300} />
        <button type="submit">Envoyer</button>
      </form>
    </aside>
  );
}

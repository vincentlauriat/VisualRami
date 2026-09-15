import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage } from "../lib/useGame";

interface Props {
  messages: ChatMessage[];
  log: string[];
  onSend: (text: string) => void;
  /** Closes the panel when it is shown as a bottom sheet (phones). */
  onClose?: () => void;
}

export function Chat({ messages, log, onSend, onClose }: Props) {
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"log" | "chat">("log");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, log, tab]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <aside className="side">
      <div className="tabs">
        <button type="button" className={tab === "log" ? "on" : ""} onClick={() => setTab("log")}>
          Journal
        </button>
        <button type="button" className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}>
          Chat {messages.length > 0 && <span className="tag">{messages.length}</span>}
        </button>
        {onClose && (
          <button type="button" className="side-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        )}
      </div>
      <div className="side-body">
        {tab === "log"
          ? log.map((line, i) => (
              <p key={i} className="log-line">
                {line}
              </p>
            ))
          : messages.map((m, i) => (
              <p key={i} className="chat-line">
                <b>{m.name}</b> {m.text}
              </p>
            ))}
        <div ref={bottom} />
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" maxLength={300} />
        <button type="submit">Envoyer</button>
      </form>
    </aside>
  );
}

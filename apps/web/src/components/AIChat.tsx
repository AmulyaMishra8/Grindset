import { useState, useRef, useEffect } from "react";
import type { Problem } from "../data/problems";
import { api } from "../api/client";
import "./AIChat.css";

type Message = { role: "user" | "ai"; content: string };
export type AiMessage = Message;

type Part = { type: "text"; value: string } | { type: "code"; lang: string; value: string };

function parseContent(content: string): Part[] {
  const parts: Part[] = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    if (m.index > last) parts.push({ type: "text", value: content.slice(last, m.index) });
    parts.push({ type: "code", lang: m[1] || "javascript", value: m[2].trim() });
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push({ type: "text", value: content.slice(last) });
  return parts;
}

function renderText(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((chunk, i) => {
    if (chunk.startsWith("**") && chunk.endsWith("**"))
      return <strong key={i}>{chunk.slice(2, -2)}</strong>;
    if (chunk.startsWith("`") && chunk.endsWith("`"))
      return <code key={i}>{chunk.slice(1, -1)}</code>;
    return <span key={i}>{chunk}</span>;
  });
}

function AiBubble({ content, onApplyCode }: { content: string; onApplyCode: (code: string, lang: string) => void }) {
  const parts = parseContent(content);
  return (
    <div className="ai-bubble">
      {parts.map((p, i) => {
        if (p.type === "text") {
          return (
            <span key={i}>
              {p.value.split("\n").map((line, j) => (
                <span key={j}>{renderText(line)}{j < p.value.split("\n").length - 1 && <br />}</span>
              ))}
            </span>
          );
        }
        return (
          <div key={i} className="ai-code-block">
            <div className="ai-code-header">
              <span className="ai-code-lang">{p.lang}</span>
              <button
                className="ai-apply-btn"
                onClick={() => onApplyCode(p.value, p.lang)}
                title="Apply this code to the editor"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Apply to editor
              </button>
            </div>
            <pre className="ai-code-pre"><code>{p.value}</code></pre>
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  problem: Problem;
  code: string;
  language: string;
  messages: Message[];
  onMessagesChange: (msgs: Message[]) => void;
  onApplyCode: (code: string, language: string) => void;
  mode?: "practice" | "test";
};

export default function AIChat({ problem, code, language, messages, onMessagesChange, onApplyCode, mode = "practice" }: Props) {
  const setMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    const next = typeof updater === "function" ? updater(messages) : updater;
    onMessagesChange(next);
  };
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const updatedHistory = [...messages];
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const { reply } = await api.post<{ reply: string }>("/api/judge/chat", {
        problem: { title: problem.title, problemStatement: problem.problemStatement },
        code, language, message: text, history: updatedHistory, mode,
      });
      setMessages((prev) => [...prev, { role: "ai", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", content: "Sorry, couldn't reach the AI service." }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <div className="ai-chat">
      <div className="ai-chat-header">
        <div className="ai-header-left">
          <span className="ai-icon">✦</span>
          <span className="ai-title">Junior Dev</span>
          <span className={`ai-context-chip ai-mode-chip-${mode}`}>
            {mode === "test" ? "No context" : "Has context"}
          </span>
          <span className="ai-context-chip">{language}</span>
        </div>
        <button className="ai-clear" onClick={() => setMessages([])}>Clear</button>
      </div>

      <div className="ai-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`ai-message ai-message-${msg.role}`}>
            {msg.role === "ai" && <span className="ai-avatar">✦</span>}
            {msg.role === "ai"
              ? <AiBubble content={msg.content} onApplyCode={onApplyCode} />
              : <div className="ai-bubble">{msg.content}</div>
            }
            {msg.role === "user" && <span className="user-avatar">U</span>}
          </div>
        ))}
        {loading && (
          <div className="ai-message ai-message-ai">
            <span className="ai-avatar">✦</span>
            <div className="ai-bubble ai-typing"><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="ai-input-row">
        <textarea
          ref={textareaRef}
          className="ai-input"
          placeholder="Tell your junior what to do next…"
          value={input}
          onChange={(e) => { setInput(e.target.value); autoResize(); }}
          onKeyDown={onKeyDown}
          rows={1}
        />
        <button className="ai-send" onClick={send} disabled={!input.trim() || loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

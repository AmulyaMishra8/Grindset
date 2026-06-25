import { useState, useRef, useEffect } from "react";
import type { Problem, ChatFormat } from "../data/problems";
import { api } from "../api/client";
import "./ProblemPanel.css";

const EW_COLOR = "#5c6bc0";
const EW_INITIALS = "EW";

function darkenColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * 0.35)}, ${Math.round(g * 0.35)}, ${Math.round(b * 0.35)})`;
}

function renderText(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) =>
    part.startsWith("`") && part.endsWith("`")
      ? <code key={i}>{part.slice(1, -1)}</code>
      : <span key={i}>{part}</span>
  );
}

// ── Interactive Slack thread ─────────────────────────────────────────────────
type HistoryMsg = { role: "user" | "pm"; content: string };

function InteractiveThread({ chat, problem, onHistoryChange }: { chat: ChatFormat; problem: Problem; onHistoryChange: (h: HistoryMsg[]) => void }) {
  const [history, setHistory] = useState<HistoryMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ewDark = darkenColor(EW_COLOR);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }

    const updated: HistoryMsg[] = [...history, { role: "user", content: text }];
    setHistory(updated);
    setLoading(true);

    try {
      const { reply } = await api.post<{ reply: string }>("/api/judge/pm-chat", {
        problemStatement: problem.problemStatement,
        sealedExpectations: problem.sealedExpectations,
        message: text,
        history,
      });
      const next = [...updated, { role: "pm" as const, content: reply }];
      setHistory(next);
      onHistoryChange(next);
    } catch {
      const next = [...updated, { role: "pm" as const, content: "Sorry, can't talk right now — ping me later." }];
      setHistory(next);
      onHistoryChange(next);
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
    el.style.height = Math.min(el.scrollHeight, 100) + "px";
  };

  return (
    <div className="interactive-thread">
      <div className="thread-scroll">
        {/* ── Initial brief messages from Ethan ── */}
        {chat.messages.map((msg, i) => (
          <div key={`init-${i}`} className="chat-message">
            <div className="chat-avatar-col">
              {i === 0
                ? <div className="chat-avatar" style={{ background: EW_COLOR, color: ewDark }}>{EW_INITIALS}</div>
                : <div className="chat-avatar-spacer" />
              }
            </div>
            <div className="chat-body">
              {i === 0 && (
                <div className="chat-header">
                  <span className="chat-name">Ethan Wong</span>
                  <span className="chat-role">Product Manager</span>
                  <span className="chat-ts">{msg.timestamp}</span>
                </div>
              )}
              <p className="chat-text">
                {renderText(msg.text)}
                {i === chat.messages.length - 1 && history.length === 0 && (
                  <span className="chat-edited"> (edited)</span>
                )}
              </p>
            </div>
          </div>
        ))}

        {/* reactions only while no conversation yet */}
        {chat.reactions.length > 0 && history.length === 0 && (
          <div className="chat-reactions">
            {chat.reactions.map((r, i) => (
              <span key={i} className="reaction-pill">{r.emoji} {r.count}</span>
            ))}
          </div>
        )}

        {/* ── Conversation ── */}
        {history.map((msg, i) => {
          if (msg.role === "user") {
            const showHeader = i === 0 || history[i - 1]?.role === "pm";
            return (
              <div key={`h-${i}`} className="chat-message chat-message-you">
                <div className="chat-avatar-col">
                  {showHeader
                    ? <div className="chat-avatar chat-avatar-you">ME</div>
                    : <div className="chat-avatar-spacer" />
                  }
                </div>
                <div className="chat-body">
                  {showHeader && (
                    <div className="chat-header">
                      <span className="chat-name chat-name-you">You</span>
                    </div>
                  )}
                  <p className="chat-text">{msg.content}</p>
                </div>
              </div>
            );
          }

          const showAvatar = i === 0 || history[i - 1]?.role === "user";
          return (
            <div key={`h-${i}`} className="chat-message">
              <div className="chat-avatar-col">
                {showAvatar
                  ? <div className="chat-avatar" style={{ background: EW_COLOR, color: ewDark }}>{EW_INITIALS}</div>
                  : <div className="chat-avatar-spacer" />
                }
              </div>
              <div className="chat-body">
                {showAvatar && (
                  <div className="chat-header">
                    <span className="chat-name">Ethan Wong</span>
                    <span className="chat-role">Product Manager</span>
                  </div>
                )}
                <p className="chat-text">{renderText(msg.content)}</p>
              </div>
            </div>
          );
        })}

        {/* typing indicator */}
        {loading && (
          <div className="chat-message">
            <div className="chat-avatar-col"><div className="chat-avatar-spacer" /></div>
            <div className="chat-body">
              <div className="pm-typing"><span /><span /><span /></div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="thread-input-row">
        <textarea
          ref={textareaRef}
          className="thread-input"
          placeholder="Ask Ethan about the requirements…"
          value={input}
          onChange={(e) => { setInput(e.target.value); autoResize(); }}
          onKeyDown={onKeyDown}
          rows={1}
        />
        <button className="thread-send" onClick={send} disabled={!input.trim() || loading}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────
export type PmHistoryMsg = HistoryMsg;

export default function ProblemPanel({ problem, onChatHistoryChange, mode = "practice" }: { problem: Problem; onChatHistoryChange: (h: HistoryMsg[]) => void; mode?: "practice" | "test" }) {
  const hasThread = !!problem.chatFormat;
  const difficultyClass =
    problem.difficulty === "Easy" ? "badge-easy"
    : problem.difficulty === "Medium" ? "badge-medium"
    : "badge-hard";

  return (
    <div className="problem-panel">
      <div className={`panel-content ${hasThread ? "panel-content-thread" : ""}`}>
          <div className={hasThread ? "description-layout" : ""}>
            <div className="problem-header">
              <div className="problem-title-row">
                <h1 className="problem-title">{problem.title}</h1>
                <span className={`mode-badge mode-badge-${mode}`}>
                  {mode === "test" ? "Test" : "Practice"}
                </span>
              </div>
              <span className={`difficulty-badge ${difficultyClass}`}>{problem.difficulty}</span>
            </div>
            <div className="problem-meta">
              <span className="meta-domain">{problem.domain}</span>
              <span className="meta-time">~{problem.estimatedMinutes} min</span>
            </div>

            {hasThread
              ? <InteractiveThread chat={problem.chatFormat as ChatFormat} problem={problem} onHistoryChange={onChatHistoryChange} />
              : <p className="problem-statement">{problem.problemStatement}</p>
            }
          </div>
        </div>
    </div>
  );
}

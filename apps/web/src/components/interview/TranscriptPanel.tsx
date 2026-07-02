import { useEffect, useRef } from "react";
import type { Turn } from "../../api/interview";

// The running conversation. Interviewer questions keep their [difficulty] tag as
// a small badge; the candidate's answers render as plain bubbles.

const DIFF_TAG = /^\[(Easy|Medium|Hard)\]\s*/i;

function splitDifficulty(text: string): { difficulty: string | null; body: string } {
  const m = text.match(DIFF_TAG);
  if (!m) return { difficulty: null, body: text };
  const diff = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  return { difficulty: diff, body: text.replace(DIFF_TAG, "") };
}

interface TranscriptPanelProps {
  turns: Turn[];
  interviewer: string;          // name shown above interviewer bubbles
  pendingUser?: string | null;  // live caption being spoken, not yet sent
  thinking?: boolean;
}

export default function TranscriptPanel({ turns, interviewer, pendingUser, thinking }: TranscriptPanelProps) {
  const who = interviewer.split(" ")[0];
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, pendingUser, thinking]);

  return (
    <div className="iv-transcript">
      {turns.map((t, i) => {
        if (t.role === "assistant") {
          const { difficulty, body } = splitDifficulty(t.content);
          return (
            <div className="iv-turn iv-turn-ai" key={i}>
              <div className="iv-turn-who">{who}</div>
              <div className="iv-bubble iv-bubble-ai">
                {difficulty && (
                  <span className={`iv-diff iv-diff-${difficulty.toLowerCase()}`}>{difficulty}</span>
                )}
                {body}
              </div>
            </div>
          );
        }
        return (
          <div className="iv-turn iv-turn-me" key={i}>
            <div className="iv-turn-who">You</div>
            <div className="iv-bubble iv-bubble-me">{t.content}</div>
          </div>
        );
      })}

      {pendingUser && (
        <div className="iv-turn iv-turn-me">
          <div className="iv-turn-who">You</div>
          <div className="iv-bubble iv-bubble-me iv-bubble-pending">{pendingUser}</div>
        </div>
      )}

      {thinking && (
        <div className="iv-turn iv-turn-ai">
          <div className="iv-turn-who">Ethan</div>
          <div className="iv-bubble iv-bubble-ai iv-bubble-thinking">
            <span className="iv-dot" /><span className="iv-dot" /><span className="iv-dot" />
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}

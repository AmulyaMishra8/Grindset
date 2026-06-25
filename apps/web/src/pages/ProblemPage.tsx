import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import ProblemPanel, { type PmHistoryMsg } from "../components/ProblemPanel";
import CodeEditor from "../components/CodeEditor";
import AIChat, { type AiMessage } from "../components/AIChat";
import type { Problem } from "../data/problems";
import { api } from "../api/client";
import "./ProblemPage.css";

export default function ProblemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get("mode") as "practice" | "test") ?? "practice";

  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [splitPct, setSplitPct] = useState(40);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiHeight, setAiHeight] = useState(280);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [chatHistory, setChatHistory] = useState<PmHistoryMsg[]>([]);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingH = useRef(false);
  const draggingV = useRef(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setProblem(null);

    api.get<Problem>(`/api/judge/problems/${id}`)
      .then((p) => {
        setProblem(p);
        setCode("");
        setChatHistory([]);
        setAiMessages([{
          role: "ai",
          content: mode === "test"
            ? "Hey! Ready to help whenever you are — share what we're building and we'll get started."
            : `Hey, I've read the **${p.title}** brief. Before we write anything — I spotted a few things that seem vague or could bite us in prod. Want me to flag them, or do you have a plan already?`,
        }]);
      })
      .catch((err) => {
        if (err.status === 404) setNotFound(true);
        else navigate("/problems/1", { replace: true });
      })
      .finally(() => setLoading(false));
  }, [id]);

  const onHMouseDown = useCallback(() => {
    draggingH.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onVMouseDown = useCallback(() => {
    draggingV.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (draggingH.current) {
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(Math.max(pct, 20), 75));
    }

    if (draggingV.current) {
      const fromBottom = rect.bottom - e.clientY;
      setAiHeight(Math.min(Math.max(fromBottom, 150), rect.height * 0.6));
    }
  }, []);

  const onMouseUp = useCallback(() => {
    draggingH.current = false;
    draggingV.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted, #888)" }}>
        Loading...
      </div>
    );
  }

  if (notFound || !problem) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
        <p style={{ color: "var(--text-muted, #888)" }}>Problem not found.</p>
        <button onClick={() => navigate("/problems/1")}>Go to Problem 1</button>
      </div>
    );
  }

  return (
    <div
      className="problem-page"
      ref={containerRef}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div className="main-area">
        <div className="problem-pane" style={{ width: `${splitPct}%` }}>
          <ProblemPanel problem={problem} onChatHistoryChange={setChatHistory} mode={mode} />
        </div>

        <div className="v-divider" onMouseDown={onHMouseDown} />

        <div className="editor-pane" style={{ width: `${100 - splitPct}%` }}>
          <CodeEditor
            problem={problem}
            code={code}
            language={language}
            onCodeChange={setCode}
            onLanguageChange={setLanguage}
            onToggleAI={() => setAiOpen((p) => !p)}
            aiOpen={aiOpen}
            chatHistory={chatHistory}
            aiHistory={aiMessages}
            mode={mode}
          />
        </div>
      </div>

      {aiOpen && (
        <>
          <div className="h-divider" onMouseDown={onVMouseDown} />
          <div className="ai-panel" style={{ height: aiHeight }}>
            <AIChat
              problem={problem}
              code={code}
              language={language}
              messages={aiMessages}
              onMessagesChange={setAiMessages}
              mode={mode}
              onApplyCode={(newCode, lang) => {
                setCode(newCode);
                const langMap: Record<string, string> = { js: "javascript", ts: "typescript", py: "python", javascript: "javascript", typescript: "typescript", python: "python" };
                if (langMap[lang]) setLanguage(langMap[lang]);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

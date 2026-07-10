import { useState } from "react";
import Editor, { type BeforeMount } from "@monaco-editor/react";
import type { Problem } from "../data/problems";
import PipelineOverlay from "./PipelineOverlay";
import { api } from "../api/client";
import "./CodeEditor.css";

type CaseResult = { description: string; passed: boolean; expected?: unknown; got?: unknown; error?: string; expectedThrow?: string };
type RunResult =
  | { status: "ran"; passed: number; total: number; results: CaseResult[] }
  | { status: "empty" | "no_tests" | "timeout" | "runtime_error" | "error" | "moved"; error?: string; message?: string };

const fmt = (v: unknown) => {
  let s: string;
  try { s = JSON.stringify(v); } catch { s = String(v); }
  if (s === undefined) s = String(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
};

const defineGrindsetTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("grindset-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment",  foreground: "424874", fontStyle: "italic" },
      { token: "keyword",  foreground: "9c6fff" },
      { token: "string",   foreground: "00e5a0" },
      { token: "number",   foreground: "ff9f43" },
      { token: "type",     foreground: "7cd4fd" },
      { token: "function", foreground: "e8eaf6" },
    ],
    colors: {
      "editor.background":                    "#0d0d14",
      "editor.foreground":                    "#e8eaf6",
      "editor.lineHighlightBackground":       "#13131f",
      "editor.selectionBackground":           "#1f1f4a",
      "editor.inactiveSelectionBackground":   "#1a1a35",
      "editorLineNumber.foreground":          "#2a2a45",
      "editorLineNumber.activeForeground":    "#7986cb",
      "editorCursor.foreground":              "#7986cb",
      "editorIndentGuide.background1":        "#2a2a45",
      "editorIndentGuide.activeBackground1":  "#3a3a5c",
      "scrollbarSlider.background":           "#2a2a4580",
      "scrollbarSlider.hoverBackground":      "#3a3a5c80",
    },
  });
};

const LANGUAGES = [
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "Python",     value: "python" },
];

type Props = {
  problem: Problem;
  code: string;
  language: string;
  onCodeChange: (code: string) => void;
  onEditorReady?: (editor: { revealLine: (n: number) => void; layout: () => void }) => void;
  onLanguageChange: (lang: string) => void;
  mode?: "practice" | "test";
};

export default function CodeEditor({
  problem, code, language, onCodeChange, onEditorReady, onLanguageChange, mode = "practice",
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [solution, setSolution] = useState<{ code: string; language: string } | null>(null);
  const [solutionOpen, setSolutionOpen] = useState(false);

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    setOverlayOpen(true);
  };

  const handleRun = async () => {
    if (running || submitted) return;
    setRunning(true);
    setRunResult(null);
    try {
      const r = await api.post<RunResult>("/api/judge/run", { problemId: problem.id, code, language });
      setRunResult(r);
    } catch (e) {
      setRunResult({ status: "error", error: (e as Error)?.message ?? "Run failed" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="code-editor-panel">
      <div className="editor-toolbar">
        <select
          className="lang-select"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          disabled={submitted}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      <div className="editor-body">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={(val) => onCodeChange(val ?? "")}
          onMount={(editor) => onEditorReady?.(editor)}
          beforeMount={defineGrindsetTheme}
          theme="grindset-dark"
          options={{
            fontSize: 14,
            fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: "on",
            renderLineHighlight: "line",
            tabSize: 4,
            padding: { top: 12, bottom: 12 },
            automaticLayout: true,
            readOnly: submitted,
          }}
        />
      </div>

      {overlayOpen && (
        <PipelineOverlay
          problemId={problem.id}
          code={code}
          language={language}
          mode={mode}
          onClose={() => setOverlayOpen(false)}
          onSolution={(refCode, lang) => setSolution({ code: refCode, language: lang })}
        />
      )}

      {solutionOpen && solution && (
        <div className="solution-modal-overlay" onClick={() => setSolutionOpen(false)}>
          <div className="solution-modal" onClick={(e) => e.stopPropagation()}>
            <div className="solution-modal-head">
              <span className="solution-modal-title">Reference solution · {solution.language}</span>
              <button className="solution-modal-close" onClick={() => setSolutionOpen(false)} aria-label="Close">×</button>
            </div>
            <pre className="solution-code"><code>{solution.code}</code></pre>
          </div>
        </div>
      )}

      {(running || runResult) && (
        <div className="run-results">
          <div className="run-results-head">
            <span className="run-results-title">
              {running
                ? "Running tests…"
                : runResult?.status === "ran"
                  ? `${runResult.passed} / ${runResult.total} tests passed`
                  : "Tests"}
            </span>
            {!running && (
              <button className="run-results-close" onClick={() => setRunResult(null)} aria-label="Close">×</button>
            )}
          </div>
          {!running && runResult && (
            <div className="run-results-body">
              {runResult.status === "ran" ? (
                runResult.results.map((r, i) => (
                  <div key={i} className={`run-case ${r.passed ? "pass" : "fail"}`}>
                    <span className="run-case-icon">{r.passed ? "✓" : "✗"}</span>
                    <span className="run-case-desc">{r.description}</span>
                    {!r.passed && (
                      <span className="run-case-detail">
                        {r.error
                          ? `error: ${r.error}`
                          : r.expectedThrow
                            ? `expected to throw "${r.expectedThrow}" — got ${fmt(r.got)}`
                            : `expected ${fmt(r.expected)} · got ${fmt(r.got)}`}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="run-msg">
                  {runResult.status === "timeout"
                    ? "Timed out — check for an infinite loop."
                    : runResult.status === "no_tests"
                      ? "No automated tests for this problem yet."
                      : runResult.status === "empty"
                        ? "Write some code first."
                        : runResult.error || runResult.message || "Something went wrong."}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="editor-actions">
        <button
          className="action-btn run-btn"
          onClick={handleRun}
          disabled={running || submitted}
        >
          {running ? "Running…" : "▶ Run"}
        </button>
        <button
          className={`action-btn submit-btn ${submitted ? "submit-locked" : ""}`}
          onClick={handleSubmit}
          disabled={submitted}
        >
          {submitted ? "Submitted" : "Submit"}
        </button>
        {solution && (
          <button className="action-btn solution-btn" onClick={() => setSolutionOpen(true)} title="Reveal the reference solution">
            Solution
          </button>
        )}
      </div>
    </div>
  );
}

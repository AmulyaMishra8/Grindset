import { useState } from "react";
import Editor, { type BeforeMount } from "@monaco-editor/react";
import type { Problem } from "../data/problems";
import PipelineOverlay from "./PipelineOverlay";
import "./CodeEditor.css";

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
  onLanguageChange: (lang: string) => void;
  onToggleAI: () => void;
  aiOpen: boolean;
  chatHistory: { role: "user" | "pm"; content: string }[];
  aiHistory: { role: "user" | "ai"; content: string }[];
  mode?: "practice" | "test";
};

export default function CodeEditor({
  problem, code, language, onCodeChange, onLanguageChange, onToggleAI, aiOpen, chatHistory, aiHistory, mode = "practice",
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    setOverlayOpen(true);
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
          chatHistory={chatHistory}
          aiHistory={aiHistory}
          mode={mode}
          onClose={() => setOverlayOpen(false)}
        />
      )}

      <div className="editor-actions">
        <button
          className={`action-btn ai-toggle-btn ${aiOpen ? "ai-toggle-active" : ""}`}
          onClick={onToggleAI}
        >
          <span className="ai-btn-icon">✦</span> AI
        </button>
        <button
          className={`action-btn submit-btn ${submitted ? "submit-locked" : ""}`}
          onClick={handleSubmit}
          disabled={submitted}
        >
          {submitted ? "Submitted" : "Submit"}
        </button>
      </div>
    </div>
  );
}

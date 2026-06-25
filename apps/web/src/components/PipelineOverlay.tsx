import { useEffect, useRef, useState } from "react";
import "./PipelineOverlay.css";

export type PipelineStage = "generating" | "running" | "analyzing";
export type PipelineStatus = "idle" | PipelineStage | "complete" | "error";

type TestResult = {
  description: string;
  passed: boolean;
  got?: unknown;
  expected?: unknown;
  reason?: string;
  threwError?: string;
  expectedThrow?: string;
};

type EvalScores = { codeQuality: number; edgeCaseHandling: number; complexityAnalysis: number; requirementsClarification: number };
type HiringDecision = "Nailed it" | "Strong attempt" | "On the right track" | "Needs work" | "Start over";
type EvalResult =
  | { mode: "practice"; review: string }
  | { mode: "test"; scores: EvalScores; average: number; hiringDecision: HiringDecision; review: string };

export type PipelineResult =
  | { status: "complete"; score: { passed: number; total: number }; complexity: { time: string; space: string }; testResults: TestResult[]; evaluation: EvalResult }
  | { status: "untestable";    reason: string }
  | { status: "runtime_error"; error: string; raw?: string }
  | { status: "timeout" }
  | { status: "error";         error: string };

const STAGES: { key: PipelineStage; label: string; sub: string }[] = [
  { key: "generating", label: "Generating test cases",  sub: "AI reads your code and builds targeted tests" },
  { key: "running",    label: "Running in sandbox",     sub: "Each test case executed against your function" },
  { key: "analyzing",  label: "Analysing results",      sub: "Senior-engineer review of your solution" },
];

function StageRow({ stage, current, result }: {
  stage: typeof STAGES[number];
  current: PipelineStatus;
  result: PipelineResult | null;
}) {
  const order: PipelineStatus[] = ["generating", "running", "analyzing", "complete"];
  const currentIdx = order.indexOf(current);
  const stageIdx   = order.indexOf(stage.key);

  const isDone    = currentIdx > stageIdx || (result !== null && current !== "error");
  const isActive  = current === stage.key;
  const isPending = !isDone && !isActive;

  return (
    <div className={`pipeline-stage ${isActive ? "ps-active" : isDone ? "ps-done" : "ps-pending"}`}>
      <div className="ps-icon">
        {isDone    && <svg viewBox="0 0 16 16" fill="none"><polyline points="2,8 6,12 14,4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        {isActive  && <span className="ps-spinner" />}
        {isPending && <span className="ps-dot" />}
      </div>
      <div className="ps-text">
        <span className="ps-label">{stage.label}</span>
        <span className="ps-sub">{stage.sub}</span>
      </div>
    </div>
  );
}

// Minimal markdown renderer
function AnalysisText({ text }: { text: string }) {
  return (
    <div className="ov-analysis-body">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="ov-a-heading">{line.slice(3)}</p>;
        if (line.startsWith("- "))  return <p key={i} className="ov-a-item">• {renderBold(line.slice(2))}</p>;
        if (!line.trim())           return <div key={i} className="ov-a-gap" />;
        return <p key={i} className="ov-a-line">{renderBold(line)}</p>;
      })}
    </div>
  );
}

function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

function HiringBadge({ decision }: { decision: HiringDecision }) {
  const cfg: Record<HiringDecision, { cls: string; icon: string }> = {
    "Nailed it":          { cls: "hb-strong-hire",   icon: "✦"  },
    "Strong attempt":     { cls: "hb-hire",           icon: "↑"  },
    "On the right track": { cls: "hb-reservations",   icon: "→"  },
    "Needs work":         { cls: "hb-no-hire",        icon: "↓"  },
    "Start over":         { cls: "hb-strong-no-hire", icon: "↺"  },
  };
  const { cls, icon } = cfg[decision];
  return (
    <div className={`hiring-badge ${cls}`}>
      <span className="hb-icon">{icon}</span>
      <span className="hb-label">{decision}</span>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 75 ? "var(--easy)" : score >= 50 ? "var(--medium)" : "var(--hard)";
  return (
    <div className="score-bar-row">
      <span className="score-bar-label">{label}</span>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="score-bar-num" style={{ color }}>{score}</span>
    </div>
  );
}

type Props = {
  problemId: number;
  code: string;
  language: string;
  chatHistory: { role: "user" | "pm"; content: string }[];
  aiHistory: { role: "user" | "ai"; content: string }[];
  mode?: "practice" | "test";
  onClose: () => void;
};

export default function PipelineOverlay({ problemId, code, language, chatHistory, aiHistory, mode = "practice", onClose }: Props) {
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>("generating");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/judge/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ problemId, code, language, chatHistory, aiHistory, mode }),
        });

        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;
          buf += decoder.decode(value, { stream: true });

          // SSE chunks: split on double newline
          const chunks = buf.split("\n\n");
          buf = chunks.pop() ?? "";

          for (const chunk of chunks) {
            const eventMatch = chunk.match(/^event: (\w+)/m);
            const dataMatch  = chunk.match(/^data: (.+)/m);
            if (!eventMatch || !dataMatch) continue;

            const event = eventMatch[1];
            const data  = JSON.parse(dataMatch[1]);

            if (event === "stage") {
              setPipelineStatus(data.stage as PipelineStage);
            } else if (event === "done") {
              setResult(data as PipelineResult);
              setPipelineStatus("complete");
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setResult({ status: "error", error: (err as Error).message });
          setPipelineStatus("error");
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Scroll to results when they arrive
  useEffect(() => {
    if (result) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [result]);

  const isRunning = pipelineStatus !== "complete" && pipelineStatus !== "error";

  return (
    <div className="pipeline-overlay">
      <div className="pipeline-card">

        {/* Header */}
        <div className="pipeline-header">
          <span className="pipeline-title">
            {isRunning ? "Evaluating your solution…" : result?.status === "complete" ? "Evaluation complete" : "Evaluation failed"}
          </span>
          {!isRunning && (
            <button className="pipeline-close" onClick={onClose}>✕</button>
          )}
        </div>

        {/* Stage steps */}
        <div className="pipeline-stages">
          {STAGES.map((s) => (
            <StageRow key={s.key} stage={s} current={pipelineStatus} result={result} />
          ))}
        </div>

        {/* Results */}
        {result && (
          <div className="pipeline-result" ref={resultRef}>

            {/* Untestable */}
            {result.status === "untestable" && (
              <div className="pres-untestable">
                <p className="pres-ut-reason">{result.reason}</p>
                <p className="pres-ut-hint">Rewrite as a self-contained function — pass data in as parameters, no DB clients or HTTP calls.</p>
              </div>
            )}

            {/* Runtime error */}
            {result.status === "runtime_error" && (
              <pre className="pres-error">{result.error}{result.raw ? `\n\n${result.raw}` : ""}</pre>
            )}

            {/* Timeout */}
            {result.status === "timeout" && (
              <p className="pres-msg">Your code exceeded the 5-second time limit.</p>
            )}

            {/* Error */}
            {result.status === "error" && (
              <pre className="pres-error">{result.error}</pre>
            )}

            {/* Complete */}
            {result.status === "complete" && (
              <>
                {/* Test mode: hiring badge + scores */}
                {result.evaluation.mode === "test" && (
                  <>
                    <HiringBadge decision={result.evaluation.hiringDecision} />

                    <div className="pres-summary">
                      <div className="pres-score">
                        <span className={`pres-score-num ${result.score.passed === result.score.total ? "score-full" : result.score.passed === 0 ? "score-zero" : "score-partial"}`}>
                          {result.score.passed}/{result.score.total}
                        </span>
                        <span className="pres-score-label">tests passed</span>
                      </div>
                      <div className="pres-complexity">
                        <span className="complexity-pill">Time {result.complexity.time}</span>
                        <span className="complexity-pill">Space {result.complexity.space}</span>
                      </div>
                    </div>

                    <div className="pres-scores">
                      <ScoreBar label="Code Quality"               score={result.evaluation.scores.codeQuality} />
                      <ScoreBar label="Edge Case Handling"         score={result.evaluation.scores.edgeCaseHandling} />
                      <ScoreBar label="Complexity Analysis"        score={result.evaluation.scores.complexityAnalysis} />
                      <ScoreBar label="Requirements Clarification" score={result.evaluation.scores.requirementsClarification} />
                      <div className="score-average">
                        <span className="score-avg-label">Overall</span>
                        <span className={`score-avg-num ${result.evaluation.average >= 75 ? "score-full" : result.evaluation.average >= 50 ? "score-partial" : "score-zero"}`}>
                          {result.evaluation.average}/100
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* Practice mode: test pass rate only, no scores */}
                {result.evaluation.mode === "practice" && (
                  <div className="pres-summary">
                    <div className="pres-score">
                      <span className={`pres-score-num ${result.score.passed === result.score.total ? "score-full" : result.score.passed === 0 ? "score-zero" : "score-partial"}`}>
                        {result.score.passed}/{result.score.total}
                      </span>
                      <span className="pres-score-label">tests passed</span>
                    </div>
                    <div className="pres-complexity">
                      <span className="complexity-pill">Time {result.complexity.time}</span>
                      <span className="complexity-pill">Space {result.complexity.space}</span>
                    </div>
                  </div>
                )}

                {/* Test cases (both modes) */}
                <div className="pres-tests">
                  {result.testResults.map((r, i) => (
                    <div key={i} className={`pres-test ${r.passed ? "ptest-pass" : "ptest-fail"}`}>
                      <span className="ptest-icon">{r.passed ? "✓" : "✗"}</span>
                      <div className="ptest-body">
                        <span className="ptest-desc">{r.description}</span>
                        {!r.passed && (
                          <div className="ptest-detail">
                            {r.reason     && <span>{r.reason}</span>}
                            {r.threwError && <span>threw: <code>{r.threwError}</code> · expected: <code>{r.expectedThrow}</code></span>}
                            {r.got !== undefined && <span>got <code>{JSON.stringify(r.got)}</code> · expected <code>{JSON.stringify(r.expected)}</code></span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* AI feedback (both modes, different title) */}
                <div className="pres-analysis">
                  <p className="pres-analysis-title">
                    {result.evaluation.mode === "practice" ? "Prompt Coaching" : "AI Review"}
                  </p>
                  <AnalysisText text={result.evaluation.review} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

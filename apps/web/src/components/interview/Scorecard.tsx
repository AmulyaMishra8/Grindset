import type { Scorecard as ScorecardData } from "../../api/interview";

// End-of-interview results: an overall ring, per-dimension bars, strengths/gaps,
// and the Easy/Medium/Hard breakdown.

function scoreColor(score: number): string {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

interface ScorecardProps {
  data: ScorecardData;
  roleLabel: string;
  durationS: number;
  persisted: boolean;
  onRestart: () => void;
}

export default function Scorecard({ data, roleLabel, durationS, persisted, onRestart }: ScorecardProps) {
  const ring = scoreColor(data.overall);
  const diffs: Array<"Easy" | "Medium" | "Hard"> = ["Easy", "Medium", "Hard"];

  return (
    <div className="iv-results">
      <div className="iv-results-head">
        <div
          className="iv-score-ring"
          style={{ ["--ring" as string]: ring, ["--pct" as string]: `${data.overall}%` }}
        >
          <span className="iv-score-num">{data.overall}</span>
          <span className="iv-score-of">/100</span>
        </div>
        <div className="iv-results-meta">
          <h1 className="iv-h1">{roleLabel} interview</h1>
          <p className="iv-results-summary">{data.summary}</p>
          <p className="iv-results-sub">Duration: {fmtDuration(durationS)}</p>
        </div>
      </div>

      <section className="iv-card">
        <h2 className="iv-card-title">By dimension</h2>
        {data.dimensions.map((d) => (
          <div className="iv-dim-row" key={d.label}>
            <div className="iv-dim-top">
              <span className="iv-dim-label">{d.label}</span>
              <span className="iv-dim-score" style={{ color: scoreColor(d.score) }}>{d.score}</span>
            </div>
            <div className="iv-dim-bar">
              <div className="iv-dim-fill" style={{ width: `${d.score}%`, background: scoreColor(d.score) }} />
            </div>
            <p className="iv-dim-comment">{d.comment}</p>
          </div>
        ))}
      </section>

      <div className="iv-two-col">
        <section className="iv-card">
          <h2 className="iv-card-title">Strengths</h2>
          {data.strengths.length ? (
            <ul className="iv-list iv-list-good">
              {data.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          ) : <p className="iv-muted">No standout strengths recorded.</p>}
        </section>

        <section className="iv-card">
          <h2 className="iv-card-title">Areas to improve</h2>
          {data.gaps.length ? (
            <ul className="iv-list iv-list-gap">
              {data.gaps.map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          ) : <p className="iv-muted">No major gaps recorded.</p>}
        </section>
      </div>

      <section className="iv-card">
        <h2 className="iv-card-title">By difficulty</h2>
        <div className="iv-diff-grid">
          {diffs.map((d) => {
            const b = data.perDifficulty[d];
            return (
              <div className="iv-diff-cell" key={d}>
                <span className={`iv-diff iv-diff-${d.toLowerCase()}`}>{d}</span>
                <span className="iv-diff-stat">{b.handledWell}/{b.asked}</span>
                <span className="iv-diff-cap">handled well</span>
              </div>
            );
          })}
        </div>
      </section>

      {!persisted && (
        <p className="iv-muted iv-note">
          Note: this result wasn’t saved to history (the history table isn’t migrated on this environment yet).
        </p>
      )}

      <div className="iv-results-actions">
        <button className="iv-btn-primary" onClick={onRestart}>Start another interview</button>
      </div>
    </div>
  );
}

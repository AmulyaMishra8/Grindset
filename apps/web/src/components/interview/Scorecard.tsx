import DifficultyMeter from "../DifficultyMeter";
import type { Scorecard as ScorecardData } from "../../api/interview";

// End-of-interview results: an overall ring, per-dimension bars, strengths/gaps,
// and the Easy/Medium/Hard breakdown.
//
// The old version coloured every score green/amber/red, which meant the page was
// a rainbow whether you did well or badly. Red is the reviewer's pen across this
// product, so it appears here only where you actually fell short: a dimension
// under the bar, and each gap — set as the same ↳ margin note used everywhere.

const PAR = 60;

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
  const diffs: Array<"Easy" | "Medium" | "Hard"> = ["Easy", "Medium", "Hard"];
  const weakOverall = data.overall < PAR;

  return (
    <div className="iv-results">
      <div className="iv-results-head">
        <div
          className={`iv-score-ring${weakOverall ? " iv-score-ring-weak" : ""}`}
          style={{ ["--pct" as string]: `${data.overall}%` }}
        >
          <span className="iv-score-num">{data.overall}</span>
          <span className="iv-score-of">/100</span>
        </div>
        <div className="iv-results-meta">
          <p className="iv-eyebrow">{roleLabel} round · {fmtDuration(durationS)}</p>
          <h1 className="iv-h1">Your scorecard</h1>
          <p className="iv-results-summary">{data.summary}</p>
        </div>
      </div>

      <section className="iv-card">
        <h2 className="iv-card-title">By dimension</h2>
        {data.dimensions.map((d) => {
          const weak = d.score < PAR;
          return (
            <div className="iv-dim-row" key={d.label}>
              <div className="iv-dim-top">
                <span className="iv-dim-label">{d.label}</span>
                <span className={`iv-dim-score${weak ? " iv-weak" : ""}`}>{d.score}</span>
              </div>
              <div className="iv-dim-bar">
                <div
                  className={`iv-dim-fill${weak ? " iv-dim-fill-weak" : ""}`}
                  style={{ width: `${d.score}%` }}
                />
              </div>
              <p className="iv-dim-comment">{d.comment}</p>
            </div>
          );
        })}
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
                <DifficultyMeter level={d} />
                <span className="iv-diff-stat">{b.handledWell}/{b.asked}</span>
                <span className="iv-diff-cap">handled well</span>
              </div>
            );
          })}
        </div>
      </section>

      {!persisted && (
        <p className="iv-muted iv-note">
          This result wasn’t saved to your history — the history table isn’t migrated on this
          environment yet.
        </p>
      )}

      <div className="iv-results-actions">
        <button className="iv-btn-primary" onClick={onRestart}>Start another interview</button>
      </div>
    </div>
  );
}

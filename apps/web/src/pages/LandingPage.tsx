import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "./Landing.css";

// The public front door. Logged-in visitors are forwarded straight into the
// app; everyone else gets the pitch: this is not another LeetCode — you're
// trained and graded on how you lead an AI, not just the code you type.
//
// Design language: red is the reviewer's pen. It only ever marks something
// that went wrong. Work that's right is simply clean — no second accent.

// A hand-drawn-looking underline: a 12px up/down bump repeated across the
// phrase, drawn on load like someone marking up your transcript. The viewBox
// is sized to the word it sits under so the wave doesn't get squashed.
const SQUIGGLE = `M0,4 ${"q3,-4 6,0 t6,0 ".repeat(7)}`;

// The three people you have to manage in a single task. The marker is the
// role, not a number — who you're talking to is the thing that changes.
const STAGES = [
  {
    who: "PM",
    title: "Interrogate the brief",
    text: "A product manager drops a task in chat: a deadline, a fuzzy requirement, and one trap buried in the wording. Ask what a senior would ask before writing a line.",
  },
  {
    who: "JUNIOR",
    title: "Lead your AI junior",
    text: "Split the work and delegate it to an AI junior who writes straight into your editor. A vague brief gets you vague code — exactly like real life.",
  },
  {
    who: "SENIOR",
    title: "Get graded like a lead",
    text: "Your code runs against real tests in a sandbox. Then a senior engineer reviews both the diff and how you clarified, decomposed, and delegated.",
  },
];

const SCORES = [
  { label: "Requirements clarification", weight: "×2", pct: 90 },
  { label: "Delegation quality", weight: "×2", pct: 81 },
  { label: "Code quality", weight: "", pct: 72 },
  { label: "Edge case handling", weight: "", pct: 64 },
];

const FEATURES = [
  {
    title: "Practice mode",
    text: "The junior already has full context and asks sharp questions back. Watch what good prompting looks like, with coaching instead of a score.",
  },
  {
    title: "Test mode",
    text: "The junior starts with nothing. Decompose the task, brief it from scratch, and take the hiring verdict at the end.",
  },
  {
    title: "Mock interviews",
    text: "Voice rounds with four interviewers — DSA, system design, business cases, behavioural — closing on a scored feedback card.",
  },
  {
    title: "Discuss",
    text: "Compare notes with other candidates: what they asked the PM, how they briefed the junior, where the trap was hiding.",
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();

  // Already signed in (incl. arriving back from an OAuth redirect) — skip the
  // marketing and go to work.
  if (!loading && user) return <Navigate to="/problems" replace />;

  return (
    <div className="landing">
      {/* ── Top bar ── */}
      <header className="ld-nav">
        <img src="/grindset_logo.png" alt="Grindset" className="ld-logo" />
        <nav className="ld-nav-actions">
          <Link to="/login" className="ld-btn ld-btn-ghost">Log in</Link>
          <Link to="/register" className="ld-btn ld-btn-primary">Get started</Link>
        </nav>
      </header>

      {/* ── Hero: the thesis, told as the transcript it grades ── */}
      <section className="ld-hero">
        <div className="ld-hero-copy">
          <p className="ld-eyebrow"><span className="ld-dot" />The agentic round is already here</p>
          <h1 className="ld-h1">
            <span className="ld-h1-hollow">LeetCode taught you to write code.</span>{" "}
            <span className="ld-h1-solid">
              Grindset trains you to lead AI<span className="ld-h1-stop">.</span>
            </span>
          </h1>
          <p className="ld-sub">
            The interview changed. You get an AI junior and a brief full of holes, and you're
            judged on how you lead them. Grindset gives you the whole loop — a PM to interrogate,
            a junior to delegate to, and a senior who grades the conversation, not just the diff.
          </p>
          <div className="ld-cta-row">
            <Link to="/register" className="ld-btn ld-btn-primary ld-btn-lg">Start practicing — free</Link>
            <Link to="/login" className="ld-btn ld-btn-ghost ld-btn-lg">I have an account</Link>
          </div>
        </div>

        {/* Signature: same task, two engineers. The pen marks only the miss. */}
        <figure className="ld-transcript">
          <figcaption className="ld-tr-head">
            <span>Same task, two engineers</span>
            <span className="ld-tr-file">merge_meetings.py</span>
          </figcaption>

          <div className="ld-track ld-track-miss">
            <p className="ld-line">
              <span className="ld-role">you → junior</span>
              <span className="ld-said">
                write a function to merge{" "}
                <span className="ld-marked">
                  overlapping
                  <svg className="ld-squiggle" viewBox="0 0 84 8" preserveAspectRatio="none" aria-hidden="true">
                    <path d={SQUIGGLE} />
                  </svg>
                </span>{" "}
                meeting intervals
              </span>
            </p>
            <p className="ld-note">↳ overlapping — defined how?</p>
            <p className="ld-line">
              <span className="ld-role">junior</span>
              <span className="ld-said ld-said-dim">shipped in 4 seconds. no questions.</span>
            </p>
            <p className="ld-result ld-result-fail">
              tests 7/9 &nbsp;·&nbsp; [1,4] [4,5] merged into [1,5]
            </p>
            <p className="ld-verdict ld-verdict-fail">No hire — never asked</p>
          </div>

          <div className="ld-track ld-track-pass">
            <p className="ld-line">
              <span className="ld-role">you → pm</span>
              <span className="ld-said">
                do back-to-back meetings count as overlapping? and is the input sorted?
              </span>
            </p>
            <p className="ld-line">
              <span className="ld-role">pm</span>
              <span className="ld-said ld-said-dim">
                back-to-back is fine, that's not a conflict. input is unsorted.
              </span>
            </p>
            <p className="ld-line">
              <span className="ld-role">you → junior</span>
              <span className="ld-said">
                sort by start, then merge only where start is strictly less than the previous end.
                return [] for empty input.
              </span>
            </p>
            <p className="ld-result ld-result-pass">tests 9/9 &nbsp;·&nbsp; all edge cases held</p>
            <p className="ld-verdict ld-verdict-pass">Strong hire — clarified, then delegated</p>
          </div>
        </figure>
      </section>

      {/* ── The three people you manage ── */}
      <section className="ld-section">
        <h2 className="ld-h2">One task. Three people to manage.</h2>
        <div className="ld-stages">
          {STAGES.map((s) => (
            <article key={s.who} className="ld-stage">
              <span className="ld-stage-who">{s.who}</span>
              <h3 className="ld-stage-title">{s.title}</h3>
              <p className="ld-stage-text">{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Scoring ── */}
      <section className="ld-section ld-section-alt">
        <div className="ld-split">
          <div className="ld-split-copy">
            <h2 className="ld-h2 ld-h2-left">Graded on what actually matters</h2>
            <p className="ld-copy">
              Perfect code behind a lazy prompt still fails. How you clarified the brief and how
              clearly you briefed your junior each count double — because that's the skill the
              agentic round is actually testing.
            </p>
            <p className="ld-copy">
              Every submission runs against real tests in a sandbox, then comes back with a written
              review: what you got right, what you missed, and why it would matter in production.
            </p>
          </div>

          <div className="ld-report">
            <p className="ld-report-head">Review · submission #1</p>
            {SCORES.map((s) => (
              <div key={s.label} className="ld-score">
                <span className="ld-score-label">
                  {s.label}
                  {s.weight && <span className="ld-score-weight">{s.weight}</span>}
                </span>
                <span className="ld-score-track" aria-hidden="true">
                  <span className="ld-score-fill" style={{ width: `${s.pct}%` }} />
                </span>
              </div>
            ))}
            <p className="ld-report-verdict">
              You shipped working code, but you accepted the brief as written.
              Ask what “overlapping” means before you delegate it.
            </p>
          </div>
        </div>
      </section>

      {/* ── What's in the box ── */}
      <section className="ld-section">
        <h2 className="ld-h2">Everything in one place</h2>
        <div className="ld-features">
          {FEATURES.map((f) => (
            <article key={f.title} className="ld-feature">
              <h3 className="ld-feature-title">{f.title}</h3>
              <p className="ld-feature-text">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Sign here. The page ends on paper. ── */}
      <section className="ld-final">
        <h2 className="ld-final-h">
          The round changed<span className="ld-h1-stop">.</span> Train for the one you'll sit.
        </h2>
        <Link to="/register" className="ld-btn ld-btn-primary ld-btn-lg">Create a free account</Link>
        <p className="ld-final-note">No card. Your first task is waiting in the queue.</p>
      </section>

      <footer className="ld-footer">
        <span>© {new Date().getFullYear()} Grindset</span>
        <Link to="/login">Log in</Link>
      </footer>
    </div>
  );
}

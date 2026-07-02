import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "./Landing.css";

// The public front door. Logged-in visitors are forwarded straight into the
// app; everyone else gets the pitch: this is not another LeetCode — you're
// trained and graded on how you lead an AI, not just the code you type.

const STEPS = [
  {
    n: "01",
    title: "Interrogate the brief",
    text:
      "A PM drops a task in chat — deadlines, vague requirements, a hidden trap. Ask the questions a senior would ask before writing a single line.",
  },
  {
    n: "02",
    title: "Lead your AI junior",
    text:
      "Decompose the work and delegate it to an AI junior dev who writes straight into your editor. Vague prompts get you vague code — just like real life.",
  },
  {
    n: "03",
    title: "Get graded like a lead",
    text:
      "Your submission runs in a sandbox, then a senior-engineer AI reviews the code and how you clarified, decomposed, and delegated.",
  },
];

const FEATURES = [
  {
    title: "Practice mode",
    text: "The junior has full context and asks smart questions. Watch what good prompting looks like, with coaching instead of scores.",
  },
  {
    title: "Test mode",
    text: "The junior starts with zero context. Decompose the task, guide it from scratch, and earn a hiring verdict.",
  },
  {
    title: "AI mock interviews",
    text: "Voice-driven rounds with four interviewers — DSA, system design, business cases, and behavioural — ending in a scored feedback card.",
  },
  {
    title: "Discuss",
    text: "Compare approaches with other candidates: what they asked the PM, how they prompted, where the traps were.",
  },
];

const SCORES = [
  { label: "Requirements clarification", note: "counts double", pct: 90 },
  { label: "Code quality", note: "", pct: 72 },
  { label: "Edge case handling", note: "", pct: 64 },
  { label: "Complexity analysis", note: "", pct: 58 },
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

      {/* ── Hero ── */}
      <section className="ld-hero">
        <p className="ld-kicker">The agentic coding round is here</p>
        <h1 className="ld-h1">
          LeetCode taught you to write code.
          <br />
          <span className="ld-h1-accent">Grindset trains you to lead AI.</span>
        </h1>
        <p className="ld-sub">
          Top companies now test how you work <em>with</em> an AI junior dev — how you clarify
          fuzzy requirements, decompose the task, and review what comes back. Practice the whole
          loop here: an AI PM to interrogate, an AI junior to lead, and a senior-engineer AI to
          grade you at the end.
        </p>
        <div className="ld-cta-row">
          <Link to="/register" className="ld-btn ld-btn-primary ld-btn-lg">Start practicing — it's free</Link>
          <Link to="/login" className="ld-btn ld-btn-ghost ld-btn-lg">I have an account</Link>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="ld-section">
        <h2 className="ld-h2">One problem, three skills</h2>
        <div className="ld-steps">
          {STEPS.map((s) => (
            <div key={s.n} className="ld-step">
              <span className="ld-step-n">{s.n}</span>
              <h3 className="ld-step-title">{s.title}</h3>
              <p className="ld-step-text">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Scoring ── */}
      <section className="ld-section ld-section-alt">
        <div className="ld-split">
          <div className="ld-split-copy">
            <h2 className="ld-h2">Graded on what actually matters</h2>
            <p className="ld-copy">
              Perfect code with a copy-pasted prompt fails. The evaluation weighs how you
              clarified requirements with the PM and how clearly you briefed your junior —
              twice as heavily as anything else — because that's the skill the agentic round
              is testing.
            </p>
            <p className="ld-copy">
              Every submission runs against real test cases in a sandbox, then gets a written
              review: what you got right, what you missed, and why it matters in production.
            </p>
          </div>
          <div className="ld-scorecard" aria-hidden="true">
            {SCORES.map((s) => (
              <div key={s.label} className="ld-score-row">
                <span className="ld-score-label">
                  {s.label}
                  {s.note && <em className="ld-score-note"> · {s.note}</em>}
                </span>
                <div className="ld-score-track">
                  <div className="ld-score-fill" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
            <div className="ld-score-verdict">Verdict: <strong>Strong attempt</strong></div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="ld-section">
        <h2 className="ld-h2">Everything in one place</h2>
        <div className="ld-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="ld-feature">
              <h3 className="ld-feature-title">{f.title}</h3>
              <p className="ld-feature-text">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="ld-final">
        <h2 className="ld-h2">The round changed. Train for the one you'll actually face.</h2>
        <Link to="/register" className="ld-btn ld-btn-primary ld-btn-lg">Create a free account</Link>
      </section>

      <footer className="ld-footer">
        <span>© {new Date().getFullYear()} Grindset</span>
        <Link to="/login">Log in</Link>
      </footer>
    </div>
  );
}

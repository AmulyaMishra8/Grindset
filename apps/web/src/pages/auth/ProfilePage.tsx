import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../api/auth";
import { api } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { MfaSetup } from "../../components/MfaSetup";
import DifficultyMeter from "../../components/DifficultyMeter";
import "./Profile.css";

const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

type Bucket = { solved: number; attempted: number; total: number };
type MyStats = Bucket & {
  byDifficulty: Record<Difficulty, Bucket>;
  solvedIds: number[];
  unresolvedIds: number[];
};

type ProblemSummary = {
  id: number;
  title: string;
  difficulty: string;
  domain: string;
  estimatedMinutes: number;
};

type ListTab = "solved" | "unresolved";

function initialsFor(name?: string | null, email?: string | null): string {
  const displayName = name?.trim();
  if (displayName) {
    const parts = displayName.split(/\s+/);
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

// The logged-in account page: what you've solved, what you still owe, and the
// account/security settings. The work you've done is the point of the page, so
// it leads — the settings sit underneath it.
export function ProfilePage() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<MyStats | null>(null);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ListTab>("solved");

  useEffect(() => {
    // The list of problems is what turns the id lists from /me/stats into
    // something a person can read — and click.
    Promise.all([
      api.get<MyStats>("/api/judge/me/stats"),
      api.get<ProblemSummary[]>("/api/judge/problems"),
    ])
      .then(([s, p]) => { setStats(s); setProblems(p); })
      .catch(() => { /* the account sections still work without progress */ })
      .finally(() => setLoading(false));
  }, []);

  const byId = useMemo(() => new Map(problems.map((p) => [p.id, p])), [problems]);

  const listed = useMemo(() => {
    const ids = tab === "solved" ? stats?.solvedIds : stats?.unresolvedIds;
    return (ids ?? []).map((id) => byId.get(id)).filter((p): p is ProblemSummary => !!p);
  }, [tab, stats, byId]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  async function disableMfa() {
    await authApi.mfaDisable();
    await refresh();
  }

  if (!user) return null;

  const pct = stats && stats.total > 0 ? (stats.solved / stats.total) * 100 : 0;

  return (
    <div className="pf-page">
      {/* ── Who you are ── */}
      <header className="pf-head">
        <div className="pf-identity">
          <span className="pf-avatar">{initialsFor(user.displayName, user.email)}</span>
          <div className="pf-identity-text">
            <h1 className="pf-name">{user.displayName ?? "Your account"}</h1>
            <p className="pf-email">{user.email}</p>
          </div>
        </div>
        <button className="pf-btn pf-btn-ghost" onClick={handleLogout}>Sign out</button>
      </header>

      {/* ── What you've done ── */}
      <section className="pf-section">
        <h2 className="pf-section-title">Progress</h2>

        {loading && <p className="pf-empty">Loading your progress…</p>}

        {!loading && !stats && (
          <p className="pf-empty">Couldn't load your progress. Reload to try again.</p>
        )}

        {!loading && stats && (
          <div className="pf-progress">
            <div className="pf-progress-top">
              <p className="pf-count">
                <span className="pf-count-num">{stats.solved}</span>
                <span className="pf-count-of">/ {stats.total} solved</span>
              </p>
              {stats.unresolvedIds.length > 0 && (
                <p className="pf-unresolved">{stats.unresolvedIds.length} still unresolved</p>
              )}
            </div>

            <span className="pf-track" aria-hidden="true">
              <span className="pf-fill" style={{ width: `${pct}%` }} />
            </span>

            <div className="pf-diffs">
              {DIFFICULTIES.filter((d) => stats.byDifficulty[d].total > 0).map((d) => {
                const b = stats.byDifficulty[d];
                return (
                  <div className="pf-diff" key={d}>
                    <DifficultyMeter level={d} />
                    <span className="pf-diff-track" aria-hidden="true">
                      <span
                        className="pf-diff-fill"
                        style={{ width: `${(b.solved / b.total) * 100}%` }}
                      />
                    </span>
                    <span className="pf-diff-count">
                      {b.solved}<span className="pf-diff-total">/{b.total}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── The problems themselves ── */}
      {!loading && stats && (
        <section className="pf-section">
          <div className="pf-section-head">
            <h2 className="pf-section-title">Your problems</h2>
            <div className="pf-tabs">
              <button
                className={`pf-tab ${tab === "solved" ? "pf-tab-on" : ""}`}
                onClick={() => setTab("solved")}
              >
                Solved {stats.solvedIds.length}
              </button>
              <button
                className={`pf-tab ${tab === "unresolved" ? "pf-tab-on" : ""}`}
                onClick={() => setTab("unresolved")}
              >
                Unresolved {stats.unresolvedIds.length}
              </button>
            </div>
          </div>

          {listed.length === 0 ? (
            <div className="pf-empty-state">
              <p>
                {tab === "solved"
                  ? "Nothing solved yet. Submit a problem and it lands here."
                  : "Nothing unresolved. Everything you've submitted passed."}
              </p>
              {tab === "solved" && (
                <Link to="/problems" className="pf-btn pf-btn-primary">Pick a problem</Link>
              )}
            </div>
          ) : (
            <ul className="pf-list">
              {listed.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/problems/${p.id}`}
                    className={`pf-row ${tab === "unresolved" ? "pf-row-unresolved" : ""}`}
                  >
                    <span className="pf-row-id">{String(p.id).padStart(2, "0")}</span>
                    <span className="pf-row-title">{p.title}</span>
                    <span className="pf-row-domain">{p.domain}</span>
                    <DifficultyMeter level={p.difficulty} />
                    <span className="pf-row-status">
                      {tab === "solved" ? "✓" : "Retry →"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Account ── */}
      <section className="pf-section">
        <h2 className="pf-section-title">Account</h2>
        <dl className="pf-facts">
          <div className="pf-fact">
            <dt>Name</dt>
            <dd>{user.displayName ?? <span className="pf-unset">Not set</span>}</dd>
          </div>
          <div className="pf-fact">
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="pf-fact">
            <dt>Email verified</dt>
            <dd>
              {user.emailVerified
                ? "Verified"
                : <span className="pf-flag">Not verified — check your inbox</span>}
            </dd>
          </div>
        </dl>
      </section>

      {/* ── Security ── */}
      <section className="pf-section">
        <h2 className="pf-section-title">Two-factor authentication</h2>
        {user.mfaEnabled ? (
          <div className="pf-mfa-on">
            <div>
              <p className="pf-mfa-state">On</p>
              <p className="pf-mfa-hint">You'll be asked for a code from your authenticator at sign-in.</p>
            </div>
            <button className="pf-btn pf-btn-ghost" onClick={disableMfa}>Turn off</button>
          </div>
        ) : (
          <MfaSetup onEnabled={refresh} />
        )}
      </section>
    </div>
  );
}

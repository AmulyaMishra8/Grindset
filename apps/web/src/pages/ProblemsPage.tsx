import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Problem } from "../data/problems";
import DifficultyMeter from "../components/DifficultyMeter";
import "./ProblemsPage.css";

type Tab = "practice" | "test";
type DiffFilter = "All" | "Easy" | "Medium" | "Hard";
type ProblemSummary = Pick<Problem, "id" | "slug" | "title" | "difficulty" | "domain" | "estimatedMinutes">;

// Only the fields this page needs; /me/stats returns the difficulty buckets too.
type MyStats = { solved: number; total: number; solvedIds: number[]; unresolvedIds: number[] };

const TAB_META: Record<Tab, { label: string; endpoint: string; description: string; emptyText: string }> = {
  practice: {
    label: "Practice",
    endpoint: "/api/judge/practice/problems",
    description: "The junior has full context and asks questions back. Coaching, no verdict.",
    emptyText: "No practice problems yet.",
  },
  test: {
    label: "Test yourself",
    endpoint: "/api/judge/test/problems",
    description: "The junior starts with nothing. Decompose the task and brief it from scratch.",
    emptyText: "No test problems yet.",
  },
};

const DIFFICULTIES: DiffFilter[] = ["All", "Easy", "Medium", "Hard"];

export default function ProblemsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) ?? "practice";

  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [diff, setDiff] = useState<DiffFilter>("All");

  const setTab = (t: Tab) => setSearchParams({ tab: t }, { replace: true });

  const load = (t: Tab) => {
    setLoading(true);
    setError(null);
    api.get<ProblemSummary[]>(TAB_META[t].endpoint)
      .then(setProblems)
      .catch((err) => setError(err?.message ?? "Failed to load problems"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(tab); }, [tab]);

  // Progress is a nice-to-have on this page: if it fails, the list still works.
  useEffect(() => {
    api.get<MyStats>("/api/judge/me/stats").then(setStats).catch(() => setStats(null));
  }, []);

  const solved = useMemo(() => new Set(stats?.solvedIds ?? []), [stats]);
  const unresolved = useMemo(() => new Set(stats?.unresolvedIds ?? []), [stats]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return problems.filter((p) => {
      const matchesDiff = diff === "All" || p.difficulty === diff;
      const matchesQuery =
        !q || p.title.toLowerCase().includes(q) || p.domain.toLowerCase().includes(q);
      return matchesDiff && matchesQuery;
    });
  }, [problems, query, diff]);

  const filtering = query.trim() !== "" || diff !== "All";

  return (
    <div className="problems-page">
      <div className="pp-inner">
        {/* ── Header: which mode you're in, and where you stand ── */}
        <header className="pp-head">
          <div className="pp-head-copy">
            <nav className="pp-tabs">
              {(["practice", "test"] as Tab[]).map((t) => (
                <button
                  key={t}
                  className={`pp-tab ${tab === t ? "pp-tab-on" : ""}`}
                  onClick={() => setTab(t)}
                >
                  {TAB_META[t].label}
                </button>
              ))}
            </nav>
            {/* The tabs already name the mode — the title names the page. */}
            <h1 className="pp-title">Problems</h1>
            <p className="pp-desc">{TAB_META[tab].description}</p>
          </div>

          {stats && stats.total > 0 && (
            <div className="pp-progress">
              <p className="pp-progress-head">Your progress</p>
              <p className="pp-progress-count">
                <span className="pp-solved">{stats.solved}</span>
                <span className="pp-of">/ {stats.total} solved</span>
              </p>
              <span className="pp-progress-track" aria-hidden="true">
                <span
                  className="pp-progress-fill"
                  style={{ width: `${(stats.solved / stats.total) * 100}%` }}
                />
              </span>
              {stats.unresolvedIds.length > 0 && (
                <p className="pp-unresolved">
                  {stats.unresolvedIds.length} still unresolved
                </p>
              )}
            </div>
          )}
        </header>

        {/* ── Toolbar ── */}
        <div className="pp-toolbar">
          <div className="pp-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search problems or domains"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search problems"
            />
            {query && (
              <button className="pp-search-clear" onClick={() => setQuery("")} aria-label="Clear search">×</button>
            )}
          </div>
          <div className="pp-chips">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                className={`pp-chip ${diff === d ? "pp-chip-on" : ""}`}
                onClick={() => setDiff(d)}
                aria-pressed={diff === d}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="pp-error">
            <span>Could not load problems. {error}</span>
            <button onClick={() => load(tab)}>Try again</button>
          </div>
        )}

        {loading && (
          <div className="pp-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="pp-card pp-skeleton" key={i} style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="pp-card-top"><span className="sk sk-id" /><span className="sk sk-diff" /></div>
                <span className="sk sk-title" />
                <div className="pp-card-foot"><span className="sk sk-domain" /><span className="sk sk-time" /></div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && (
          <>
            <p className="pp-count">
              {filtered.length} {filtered.length === 1 ? "problem" : "problems"}
              {filtering && <span className="pp-count-of"> of {problems.length}</span>}
            </p>

            {filtered.length === 0 ? (
              <div className="pp-empty">
                <p>{problems.length === 0 ? TAB_META[tab].emptyText : "Nothing matches those filters."}</p>
                {filtering && problems.length > 0 && (
                  <button
                    className="pp-empty-reset"
                    onClick={() => { setQuery(""); setDiff("All"); }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="pp-grid">
                {filtered.map((p, i) => {
                  // Red is the pen everywhere in this product: a problem you
                  // submitted but never got green is still carrying a mark.
                  const status = solved.has(p.id)
                    ? "solved"
                    : unresolved.has(p.id)
                      ? "unresolved"
                      : "";
                  return (
                    <button
                      key={p.id}
                      className={`pp-card ${status ? `pp-card-${status}` : ""}`}
                      style={{ animationDelay: `${Math.min(i, 8) * 0.03}s` }}
                      onClick={() => navigate(`/problems/${p.id}?mode=${tab}`)}
                    >
                      <div className="pp-card-top">
                        <span className="pp-id">{String(p.id).padStart(2, "0")}</span>
                        {status === "solved" && <span className="pp-status pp-status-solved">✓ Solved</span>}
                        {status === "unresolved" && <span className="pp-status pp-status-unresolved">Unresolved</span>}
                        <DifficultyMeter level={p.difficulty} />
                      </div>
                      <h3 className="pp-card-title">{p.title}</h3>
                      <div className="pp-card-foot">
                        <span className="pp-domain">{p.domain}</span>
                        <span className="pp-time">~{p.estimatedMinutes}m</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

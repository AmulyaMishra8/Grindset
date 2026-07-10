import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Problem } from "../data/problems";
import "./ProblemsPage.css";

type Tab = "practice" | "test" | "discuss";
type DiffFilter = "All" | "Easy" | "Medium" | "Hard";
type ProblemSummary = Pick<Problem, "id" | "slug" | "title" | "difficulty" | "domain" | "estimatedMinutes">;

const TAB_META: Record<Tab, { label: string; endpoint: string; description: string; emptyText: string }> = {
  practice: {
    label: "Practice",
    endpoint: "/api/judge/practice/problems",
    description: "The AI junior has full context and asks smart questions. Learn what good prompting looks like by watching it happen.",
    emptyText: "No practice problems yet.",
  },
  test: {
    label: "Test Yourself",
    endpoint: "/api/judge/test/problems",
    description: "The AI junior starts with zero context. Your job is to decompose the task and guide it from scratch.",
    emptyText: "No test problems yet.",
  },
  discuss: {
    label: "Discuss",
    endpoint: "",
    description: "",
    emptyText: "",
  },
};

const DIFFICULTIES: DiffFilter[] = ["All", "Easy", "Medium", "Hard"];

export default function ProblemsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) ?? "practice";

  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [diff, setDiff] = useState<DiffFilter>("All");

  const setTab = (t: Tab) => setSearchParams({ tab: t }, { replace: true });

  const load = (t: Tab) => {
    if (t === "discuss") return;
    setLoading(true);
    setError(null);
    api.get<ProblemSummary[]>(TAB_META[t].endpoint)
      .then(setProblems)
      .catch((err) => setError(err?.message ?? "Failed to load problems"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(tab); }, [tab]);

  const difficultyClass = (d: string) =>
    d === "Easy" ? "badge-easy" : d === "Medium" ? "badge-medium" : "badge-hard";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return problems.filter((p) => {
      const matchesDiff = diff === "All" || p.difficulty === diff;
      const matchesQuery =
        !q || p.title.toLowerCase().includes(q) || p.domain.toLowerCase().includes(q);
      return matchesDiff && matchesQuery;
    });
  }, [problems, query, diff]);

  return (
    <div className="problems-page">
      {/* Tab bar */}
      <div className="mode-tabs">
        {(["practice", "test"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`mode-tab mode-tab-${t} ${tab === t ? "mode-tab-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {TAB_META[t].label}
          </button>
        ))}
      </div>

      {/* Practice / Test */}
      {tab !== "discuss" && (
        <div className="problems-scroll">
          <div className={`mode-banner mode-banner-${tab}`}>
            <span className={`mode-pill mode-pill-${tab}`}>
              {tab === "practice" ? "Learning Mode" : "Assessment Mode"}
            </span>
            <p className="mode-desc">{TAB_META[tab].description}</p>
          </div>

          {/* Toolbar: search + difficulty filter */}
          <div className="problems-toolbar">
            <div className="search-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search problems or domains…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">×</button>
              )}
            </div>
            <div className="diff-filters">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  className={`diff-chip ${diff === d ? "diff-chip-active" : ""} diff-chip-${d.toLowerCase()}`}
                  onClick={() => setDiff(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="problems-error">
              Could not load problems: {error}
              <button onClick={() => load(tab)}>Retry</button>
            </div>
          )}

          {loading && (
            <div className="problem-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="problem-card skeleton-card" key={i} style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="skeleton-card-top">
                    <span className="sk sk-id" /><span className="sk sk-badge" />
                  </div>
                  <span className="sk sk-title" />
                  <div className="skeleton-card-foot">
                    <span className="sk sk-domain" /><span className="sk sk-time" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && (
            <>
              <p className="problems-subheading">
                {filtered.length} {filtered.length === 1 ? "problem" : "problems"}
                {(query || diff !== "All") && <span className="filtered-of"> of {problems.length}</span>}
              </p>
              {filtered.length === 0 ? (
                <div className="problems-empty-state">
                  <span className="empty-glyph" aria-hidden>⌗</span>
                  <p>{problems.length === 0 ? TAB_META[tab].emptyText : "No problems match your filters."}</p>
                </div>
              ) : (
                <div className="problem-grid">
                  {filtered.map((p, i) => (
                    <button
                      key={p.id}
                      className={`problem-card problem-card-${tab}`}
                      style={{ animationDelay: `${Math.min(i, 8) * 0.03}s` }}
                      onClick={() => navigate(`/problems/${p.id}?mode=${tab}`)}
                    >
                      <div className="card-top">
                        <span className="card-id">#{p.id}</span>
                        <span className={`difficulty-badge ${difficultyClass(p.difficulty)}`}>
                          <span className="diff-dot" />{p.difficulty}
                        </span>
                      </div>
                      <h3 className="card-title">{p.title}</h3>
                      <div className="card-foot">
                        <span className="domain-chip">{p.domain}</span>
                        <span className="card-time">~{p.estimatedMinutes}m</span>
                      </div>
                      <span className="card-arrow" aria-hidden>→</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

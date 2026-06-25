import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Problem } from "../data/problems";
import "./ProblemsPage.css";

type Tab = "practice" | "test" | "discuss";
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

export default function ProblemsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) ?? "practice";

  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="problems-page">
      {/* Tab bar */}
      <div className="mode-tabs">
        {(["practice", "test", "discuss"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`mode-tab mode-tab-${t} ${tab === t ? "mode-tab-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {TAB_META[t].label}
          </button>
        ))}
      </div>

      {/* Discuss placeholder */}
      {tab === "discuss" && (
        <div className="discuss-placeholder">
          <p className="discuss-title">Community Discussions</p>
          <p className="discuss-sub">Coming soon — share approaches, compare strategies, ask questions.</p>
        </div>
      )}

      {/* Practice / Test */}
      {tab !== "discuss" && (
        <>
          <div className={`mode-banner mode-banner-${tab}`}>
            <span className={`mode-pill mode-pill-${tab}`}>
              {tab === "practice" ? "Learning Mode" : "Assessment Mode"}
            </span>
            <p className="mode-desc">{TAB_META[tab].description}</p>
          </div>

          {loading && <div className="problems-loading">Loading…</div>}

          {error && (
            <div className="problems-error">
              Could not load problems: {error}
              <button onClick={() => load(tab)}>Retry</button>
            </div>
          )}

          {!loading && !error && (
            <>
              <p className="problems-subheading">{problems.length} problems</p>
              <table className="problems-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Domain</th>
                    <th>Difficulty</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.length === 0 && (
                    <tr><td colSpan={5} className="problems-empty">{TAB_META[tab].emptyText}</td></tr>
                  )}
                  {problems.map((p) => (
                    <tr
                      key={p.id}
                      className={`problem-row problem-row-${tab}`}
                      onClick={() => navigate(`/problems/${p.id}?mode=${tab}`)}
                    >
                      <td className="col-id">{p.id}</td>
                      <td className="col-title">{p.title}</td>
                      <td className="col-domain">{p.domain}</td>
                      <td className="col-difficulty">
                        <span className={`difficulty-badge ${difficultyClass(p.difficulty)}`}>{p.difficulty}</span>
                      </td>
                      <td className="col-time">~{p.estimatedMinutes}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}

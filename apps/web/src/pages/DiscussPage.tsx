import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { VoteControl } from "../components/VoteControl";
import { timeAgo } from "../lib/timeAgo";
import "./Discuss.css";

type Sort = "new" | "top";

type ThreadSummary = {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  createdAt: string;
  score: number;
  myVote: number;
  commentCount: number;
};

export default function DiscussPage() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("new");

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const load = (s: Sort) => {
    setLoading(true);
    setError(null);
    api.get<ThreadSummary[]>(`/api/discuss/threads?sort=${s}`)
      .then(setThreads)
      .catch((e) => setError(e?.message ?? "Failed to load discussions"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(sort); }, [sort]);

  const vote = async (id: string, value: 1 | -1) => {
    try {
      const r = await api.post<{ score: number; myVote: number }>(`/api/discuss/threads/${id}/vote`, { value });
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, score: r.score, myVote: r.myVote } : t)));
    } catch {
      /* ignore — vote just won't change */
    }
  };

  const submit = async () => {
    setPosting(true);
    setPostError(null);
    try {
      const r = await api.post<{ id: string }>("/api/discuss/threads", { title, body });
      navigate(`/discuss/${r.id}`);
    } catch (e) {
      setPostError(e instanceof ApiError ? e.message : "Could not post");
      setPosting(false);
    }
  };

  return (
    <div className="discuss-page">
      <div className="discuss-header">
        <div>
          <h1 className="discuss-h1">Discuss</h1>
          <p className="discuss-tagline">Share approaches, ask questions, compare strategies.</p>
        </div>
        <button className="btn-primary" onClick={() => setComposing((c) => !c)}>
          {composing ? "Cancel" : "New thread"}
        </button>
      </div>

      {composing && (
        <div className="compose-card">
          <input
            className="compose-title"
            placeholder="Title"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="compose-body"
            placeholder="What's on your mind?"
            value={body}
            maxLength={10000}
            rows={5}
            onChange={(e) => setBody(e.target.value)}
          />
          {postError && <p className="compose-error">{postError}</p>}
          <div className="compose-actions">
            <button
              className="btn-primary"
              disabled={posting || title.trim().length < 3 || body.trim().length < 1}
              onClick={submit}
            >
              {posting ? "Posting…" : "Post thread"}
            </button>
          </div>
        </div>
      )}

      <div className="discuss-toolbar">
        <div className="sort-toggle">
          <button className={sort === "new" ? "on" : ""} onClick={() => setSort("new")}>Newest</button>
          <button className={sort === "top" ? "on" : ""} onClick={() => setSort("top")}>Top</button>
        </div>
      </div>

      {error && <div className="discuss-error">{error}<button onClick={() => load(sort)}>Retry</button></div>}

      {loading && (
        <div className="thread-list">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="thread-card skeleton" key={i} style={{ animationDelay: `${i * 0.06}s` }} />
          ))}
        </div>
      )}

      {!loading && !error && threads.length === 0 && (
        <div className="discuss-empty">
          <div className="discuss-empty-icon">💬</div>
          <p>No discussions yet. Start the first one!</p>
        </div>
      )}

      {!loading && !error && threads.length > 0 && (
        <div className="thread-list">
          {threads.map((t) => (
            <div className="thread-card" key={t.id}>
              <VoteControl score={t.score} myVote={t.myVote} onVote={(v) => vote(t.id, v)} />
              <div className="thread-main" onClick={() => navigate(`/discuss/${t.id}`)}>
                <h3 className="thread-title">{t.title}</h3>
                <p className="thread-excerpt">{t.excerpt}</p>
                <div className="thread-meta">
                  <span className="thread-author">{t.author}</span>
                  <span className="dot">·</span>
                  <span>{timeAgo(t.createdAt)}</span>
                  <span className="dot">·</span>
                  <span className="thread-comments">
                    {t.commentCount} {t.commentCount === 1 ? "comment" : "comments"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

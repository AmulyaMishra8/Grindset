import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { VoteControl } from "../components/VoteControl";
import { timeAgo } from "../lib/timeAgo";
import "./Discuss.css";

type Comment = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  score: number;
  myVote: number;
};

type ThreadDetail = {
  id: string;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  score: number;
  myVote: number;
  comments: Comment[];
};

export default function DiscussThreadPage() {
  const { id } = useParams<{ id: string }>();
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.get<ThreadDetail>(`/api/discuss/threads/${id}`)
      .then(setThread)
      .catch((e) => setError(e?.message ?? "Failed to load thread"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const voteThread = async (value: 1 | -1) => {
    if (!thread) return;
    try {
      const r = await api.post<{ score: number; myVote: number }>(`/api/discuss/threads/${thread.id}/vote`, { value });
      setThread({ ...thread, score: r.score, myVote: r.myVote });
    } catch { /* ignore */ }
  };

  const voteComment = async (cid: string, value: 1 | -1) => {
    if (!thread) return;
    try {
      const r = await api.post<{ score: number; myVote: number }>(`/api/discuss/comments/${cid}/vote`, { value });
      setThread({
        ...thread,
        comments: thread.comments.map((c) => (c.id === cid ? { ...c, score: r.score, myVote: r.myVote } : c)),
      });
    } catch { /* ignore */ }
  };

  const submitComment = async () => {
    if (!thread) return;
    setPosting(true);
    setPostError(null);
    try {
      await api.post<{ id: string }>(`/api/discuss/threads/${thread.id}/comments`, { body: comment });
      setComment("");
      load(); // refresh to show the new comment with server-truth ordering
    } catch (e) {
      setPostError(e instanceof ApiError ? e.message : "Could not post comment");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="discuss-page thread-page">
      <Link to="/discuss" className="back-link">← Back to Discuss</Link>

      {loading && <div className="thread-detail skeleton-detail" />}
      {error && <div className="discuss-error">{error}<button onClick={load}>Retry</button></div>}

      {thread && !loading && (
        <>
          <div className="thread-detail">
            <VoteControl score={thread.score} myVote={thread.myVote} onVote={voteThread} />
            <div className="thread-detail-main">
              <h1 className="thread-detail-title">{thread.title}</h1>
              <div className="thread-meta">
                <span className="thread-author">{thread.author}</span>
                <span className="dot">·</span>
                <span>{timeAgo(thread.createdAt)}</span>
              </div>
              <p className="thread-detail-body">{thread.body}</p>
            </div>
          </div>

          <div className="comment-composer">
            <textarea
              placeholder="Add a comment…"
              value={comment}
              maxLength={5000}
              rows={3}
              onChange={(e) => setComment(e.target.value)}
            />
            {postError && <p className="compose-error">{postError}</p>}
            <div className="compose-actions">
              <button className="btn-primary" disabled={posting || comment.trim().length < 1} onClick={submitComment}>
                {posting ? "Posting…" : "Comment"}
              </button>
            </div>
          </div>

          <div className="comment-count-bar">
            {thread.comments.length} {thread.comments.length === 1 ? "comment" : "comments"}
          </div>

          <div className="comment-list">
            {thread.comments.map((c) => (
              <div className="comment-card" key={c.id}>
                <VoteControl score={c.score} myVote={c.myVote} onVote={(v) => voteComment(c.id, v)} />
                <div className="comment-main">
                  <div className="thread-meta">
                    <span className="thread-author">{c.author}</span>
                    <span className="dot">·</span>
                    <span>{timeAgo(c.createdAt)}</span>
                  </div>
                  <p className="comment-body">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

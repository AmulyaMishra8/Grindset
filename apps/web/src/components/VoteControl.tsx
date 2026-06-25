type Props = {
  score: number;
  myVote: number; // -1 | 0 | 1
  onVote: (value: 1 | -1) => void;
  busy?: boolean;
};

// Reddit-style vertical up/down voter with the running score in the middle.
export function VoteControl({ score, myVote, onVote, busy }: Props) {
  const state = myVote === 1 ? "up" : myVote === -1 ? "down" : "neutral";
  return (
    <div className={`vote-control vote-${state}`}>
      <button
        className={`vote-btn ${myVote === 1 ? "on" : ""}`}
        onClick={() => onVote(1)}
        disabled={busy}
        aria-label="Upvote"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 14l6-6 6 6" />
        </svg>
      </button>
      <span className="vote-score">{score}</span>
      <button
        className={`vote-btn ${myVote === -1 ? "on" : ""}`}
        onClick={() => onVote(-1)}
        disabled={busy}
        aria-label="Downvote"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 10l6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

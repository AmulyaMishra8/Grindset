# VoteControl Component

Reddit-style vertical up/down voter with score display.

## Props

- **score** — number — The current score/vote count.
- **myVote** — number — User's own vote: `1` (upvoted), `-1` (downvoted), `0` (no vote).
- **onVote** — function — Callback when user clicks up/down; receives `1` or `-1`.

## Usage

```jsx
<VoteControl
  score={42}
  myVote={1}
  onVote={(value) => updateVote(value)}
/>
```

## Styling

- Buttons: `--text-secondary`, hover → `--text-primary`
- Voted state: `--accent` (#7c4dff)
- Score: bold, `--text-primary`

Stateless presentational component; parent manages state.

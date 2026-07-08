export interface VoteControlProps {
  score: number;
  myVote: number;
  onVote: (value: 1 | -1) => void;
}

export function VoteControl(props: VoteControlProps): JSX.Element;

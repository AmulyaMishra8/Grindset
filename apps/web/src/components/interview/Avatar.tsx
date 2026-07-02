// Lightweight stand-in for the interviewer "Ethan Wong". A real Ready Player Me +
// TalkingHead 3D avatar can drop in here later; for now this is a dependency-free
// CSS/SVG face that animates a "speaking" mouth and a "listening" pulse so the
// turn state is legible at a glance.

interface AvatarProps {
  name: string;
  accent: string;
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
}

export default function Avatar({ name, accent, speaking, listening, thinking }: AvatarProps) {
  const state = speaking ? "speaking" : thinking ? "thinking" : listening ? "listening" : "idle";
  const firstName = name.split(" ")[0];
  return (
    <div className={`iv-avatar iv-avatar-${state}`} style={{ ["--accent" as string]: accent }}>
      <div className="iv-avatar-ring" />
      <svg viewBox="0 0 120 120" className="iv-avatar-face" aria-hidden="true">
        {/* head */}
        <circle cx="60" cy="58" r="40" className="iv-face-bg" />
        {/* hair */}
        <path d="M22 52 Q60 4 98 52 Q92 30 60 26 Q28 30 22 52 Z" className="iv-hair" />
        {/* eyes */}
        <circle cx="46" cy="54" r="4.5" className="iv-eye" />
        <circle cx="74" cy="54" r="4.5" className="iv-eye" />
        {/* mouth — scaleY animates while speaking */}
        <rect x="48" y="74" width="24" height="8" rx="4" className="iv-mouth" />
      </svg>
      <div className="iv-avatar-label">
        {firstName}
        <span className="iv-avatar-state">
          {state === "speaking" ? "speaking…" : state === "thinking" ? "thinking…" : state === "listening" ? "listening…" : "ready"}
        </span>
      </div>
    </div>
  );
}

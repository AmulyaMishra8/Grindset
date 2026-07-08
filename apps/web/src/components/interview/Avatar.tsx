// Lightweight stand-in for the interviewer. Dependency-free CSS/SVG face whose
// mouth is lip-synced to the ACTUAL interviewer audio: an rAF loop reads the
// shared voice level (getVoiceLevel — the real loudness of the ElevenLabs audio,
// or a simulated flap for the browser voice) and drives the mouth's scaleY.

import { useEffect, useRef } from "react";
import { getVoiceLevel } from "../../lib/voiceLevel";

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

  const mouthRef = useRef<SVGRectElement>(null);
  const smooth = useRef(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = mouthRef.current;
      if (el) {
        const target = speaking ? getVoiceLevel() : 0;
        smooth.current += (target - smooth.current) * 0.4; // ease out jitter
        const scaleY = 0.55 + smooth.current * 2.3; // 0.55 = resting, ~2.85 = wide open
        el.style.transform = `scaleY(${scaleY.toFixed(3)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

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
        {/* mouth — scaleY is driven by the live audio level (see effect above) */}
        <rect ref={mouthRef} x="48" y="74" width="24" height="8" rx="4" className="iv-mouth" />
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

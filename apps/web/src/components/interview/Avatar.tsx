// The interviewer's face. Dependency-free CSS/SVG, but per-persona: each of the
// four interviewers gets a distinct look (hair, skin tone, glasses) so they read
// as different people, and the mouth is lip-synced to the ACTUAL audio via the
// shared voice level (getVoiceLevel).

import { useEffect, useRef } from "react";
import { getVoiceLevel } from "../../lib/voiceLevel";

interface AvatarProps {
  name: string;
  accent: string;
  variant?: string; // interviewer role id → picks the look below
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
}

type Look = { skin: string; hair: string; long: boolean; glasses: boolean };

// One look per interviewer: Alex (DSA, m, glasses), Priya (SysDesign, f),
// Marcus (Business, m), Jordan (HR, f).
const LOOKS: Record<string, Look> = {
  dsa:           { skin: "#e8b58c", hair: "#2a211b", long: false, glasses: true },
  system_design: { skin: "#d69f6e", hair: "#1b1410", long: true,  glasses: false },
  business:      { skin: "#b07d52", hair: "#140e0a", long: false, glasses: false },
  hr:            { skin: "#f1c9a6", hair: "#5b3a22", long: true,  glasses: false },
};

export default function Avatar({ name, accent, variant, speaking, listening, thinking }: AvatarProps) {
  const state = speaking ? "speaking" : thinking ? "thinking" : listening ? "listening" : "idle";
  const firstName = name.split(" ")[0];
  const look = (variant && LOOKS[variant]) || LOOKS.dsa;

  const mouthRef = useRef<SVGRectElement>(null);
  const smooth = useRef(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = mouthRef.current;
      if (el) {
        const target = speaking ? getVoiceLevel() : 0;
        smooth.current += (target - smooth.current) * 0.4; // ease jitter
        el.style.transform = `scaleY(${(0.5 + smooth.current * 2.3).toFixed(3)})`;
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
        {/* long hair sits behind the head */}
        {look.long && (
          <path d="M24 60 Q22 22 60 20 Q98 22 96 60 L94 98 Q90 76 86 64 Q60 36 34 64 Q30 76 26 98 Z" fill={look.hair} />
        )}
        {/* shoulders / shirt in the persona accent */}
        <path d="M16 120 Q16 96 44 90 L76 90 Q104 96 104 120 Z" fill={accent} opacity="0.92" />
        <path d="M16 120 Q16 96 44 90 L60 120 Z" fill="#000" opacity="0.06" />
        {/* neck */}
        <rect x="52" y="78" width="16" height="16" rx="4" fill={look.skin} />
        <rect x="52" y="86" width="16" height="8" fill="#000" opacity="0.08" />
        {/* ears */}
        <circle cx="30" cy="56" r="6" fill={look.skin} />
        <circle cx="90" cy="56" r="6" fill={look.skin} />
        {/* head */}
        <circle cx="60" cy="54" r="32" fill={look.skin} />
        {/* hair cap on top */}
        <path d="M29 52 Q60 12 91 52 Q90 30 60 23 Q30 30 29 52 Z" fill={look.hair} />
        {/* eyebrows */}
        <rect x="42" y="44" width="12" height="3" rx="1.5" fill={look.hair} />
        <rect x="66" y="44" width="12" height="3" rx="1.5" fill={look.hair} />
        {/* eyes (iv-eye keeps the "looking up while thinking" CSS tweak) */}
        <circle cx="48" cy="53" r="3.6" className="iv-eye" fill="#2b2b3a" />
        <circle cx="72" cy="53" r="3.6" className="iv-eye" fill="#2b2b3a" />
        {/* glasses */}
        {look.glasses && (
          <g stroke="#2b2b3a" strokeWidth="2" fill="none" opacity="0.85">
            <rect x="40" y="47" width="16" height="12" rx="4" />
            <rect x="64" y="47" width="16" height="12" rx="4" />
            <path d="M56 52 H64" />
          </g>
        )}
        {/* nose */}
        <path d="M60 55 Q63 61 58.5 63" stroke="#00000022" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* mouth — scaleY driven per-frame by the live audio level */}
        <rect ref={mouthRef} x="50" y="70" width="20" height="6" rx="3" className="iv-mouth" />
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

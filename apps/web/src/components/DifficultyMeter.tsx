import "./DifficultyMeter.css";

// Difficulty is ordinal, so it reads as a filled meter rather than a colour.
// That keeps red free to mean the one thing it means everywhere in this product
// — the reviewer's pen — and it survives colour-blindness, which a green/amber/
// red badge does not.

const NOTCHES: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };

export default function DifficultyMeter({ level }: { level: string }) {
  const filled = NOTCHES[level] ?? 0;
  return (
    <span className="diff-meter">
      <span className="diff-notches" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`notch ${n <= filled ? "notch-on" : ""}`} />
        ))}
      </span>
      {level}
    </span>
  );
}

import type { RoleMeta, Quota } from "../../api/interview";

// The role selection screen — four persona cards + the user's remaining daily
// budget. Picking a card starts an interview.

interface RolePickerProps {
  roles: RoleMeta[];
  quota: Quota | null;
  starting: string | null; // id of the role currently being started
  onPick: (roleId: string) => void;
}

export default function RolePicker({ roles, quota, starting, onPick }: RolePickerProps) {
  const outOfBudget = quota ? quota.remaining <= 0 : false;

  return (
    <div className="iv-picker">
      <div className="iv-picker-head">
        <h1 className="iv-h1">AI Interview</h1>
        <p className="iv-tagline">
          A live, voice-driven mock interview with Ethan. Pick a round to begin.
        </p>
        {quota && (
          <p className={`iv-quota${outOfBudget ? " iv-quota-empty" : ""}`}>
            {outOfBudget
              ? "You've used all of today's interviews — come back tomorrow."
              : `${quota.remaining} of ${quota.limit} interviews left today`}
          </p>
        )}
      </div>

      <div className="iv-role-grid">
        {roles.map((r) => (
          <button
            key={r.id}
            className="iv-role-card"
            style={{ ["--accent" as string]: r.accent }}
            disabled={!!starting || outOfBudget}
            onClick={() => onPick(r.id)}
          >
            <div className="iv-role-dot" />
            <h3 className="iv-role-label">{r.label}</h3>
            <p className="iv-role-interviewer">with {r.interviewer}</p>
            <p className="iv-role-blurb">{r.blurb}</p>
            <ul className="iv-role-dims">
              {r.dimensions.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <span className="iv-role-cta">
              {starting === r.id ? "Starting…" : "Start interview →"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

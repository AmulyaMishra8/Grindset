import type { RoleMeta, Quota } from "../../api/interview";

// The role selection screen — four persona cards + the user's remaining daily
// budget. Picking a card starts an interview.
//
// The personas used to be told apart by a per-role accent colour, which put four
// more hues on a page where red already means something. They're told apart by
// who they are instead: the interviewer's initials, their name, and the round.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

interface RolePickerProps {
  roles: RoleMeta[];
  quota: Quota | null;
  starting: string | null; // id of the role currently being started
  onPick: (roleId: string) => void;
}

export default function RolePicker({ roles, quota, starting, onPick }: RolePickerProps) {
  // No cap when the server reports unlimited (INTERVIEW_DAILY_LIMIT=0).
  const outOfBudget = quota && !quota.unlimited ? quota.remaining <= 0 : false;

  return (
    <div className="iv-picker">
      <div className="iv-picker-head">
        <p className="iv-eyebrow">Live voice round</p>
        <h1 className="iv-h1">AI Interview</h1>
        <p className="iv-tagline">
          Four interviewers, four rounds. Pick one and they'll start asking.
        </p>
        {quota && !quota.unlimited && (
          <p className={`iv-quota${outOfBudget ? " iv-quota-empty" : ""}`}>
            {outOfBudget
              ? "You've used all of today's interviews. Come back tomorrow."
              : `${quota.remaining} of ${quota.limit} interviews left today`}
          </p>
        )}
      </div>

      <div className="iv-role-grid">
        {roles.map((r) => (
          <button
            key={r.id}
            className="iv-role-card"
            disabled={!!starting || outOfBudget}
            onClick={() => onPick(r.id)}
          >
            <span className="iv-role-initials">{initials(r.interviewer)}</span>
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

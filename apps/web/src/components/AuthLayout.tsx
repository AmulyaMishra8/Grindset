import type { ReactNode } from "react";
import { Link } from "react-router-dom";

// The two-pane frame used by every auth screen. Left is the form and nothing
// else; right names the three people you manage, so you're oriented before
// you've typed. The heading has to read true on register as well as login —
// nobody creating an account is "coming back" to anything. The right pane is
// context, not content: it hides on narrow screens rather than shrink to a stub.

const ROLES = [
  { who: "PM", line: "Interrogate the brief before you touch the keyboard." },
  { who: "JUNIOR", line: "Brief it clearly. Vague in, vague out." },
  { who: "SENIOR", line: "Graded on the conversation, not just the diff." },
];

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-screen">
      <div className="auth-form-pane">
        <Link to="/" className="auth-brand" aria-label="Grindset home">
          <img src="/grindset_logo.png" alt="Grindset" />
        </Link>

        <div className="auth-form">
          {eyebrow && (
            <p className="auth-eyebrow">
              <span className="auth-dot" />
              {eyebrow}
            </p>
          )}
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </div>

      <aside className="auth-aside">
        <p className="auth-aside-head">The three people you manage</p>
        <ul className="auth-roles">
          {ROLES.map((r) => (
            <li key={r.who} className="auth-role">
              <span className="auth-role-who">{r.who}</span>
              <span className="auth-role-line">{r.line}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

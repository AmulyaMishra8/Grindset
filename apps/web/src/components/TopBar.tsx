import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { PublicUser } from "@grindset/auth-shared";
import "./TopBar.css";

// Initials for the avatar: from the display name ("Amulya Mishra" -> "AM"),
// else the first letter of the email, else a fallback.
function initialsFor(user: PublicUser | null): string {
  const name = user?.displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/);
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  if (user?.email) return user.email[0].toUpperCase();
  return "?";
}

export default function TopBar() {
  const { user } = useAuth();
  const initials = initialsFor(user);
  const label = user?.displayName || user?.email || "Account";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link to="/problems" className="topbar-logo-link" aria-label="Home">
          <img src="/grindset_logo.png" alt="Grindset" className="topbar-logo" />
        </Link>
        <nav className="topbar-nav">
          <NavLink
            to="/problems"
            className={({ isActive }) => `nav-btn${isActive ? " active" : ""}`}
          >
            Problems
          </NavLink>
          <NavLink
            to="/discuss"
            className={({ isActive }) => `nav-btn${isActive ? " active" : ""}`}
          >
            Discuss
          </NavLink>
          <NavLink
            to="/interview"
            className={({ isActive }) => `nav-btn${isActive ? " active" : ""}`}
          >
            AI Interview
          </NavLink>
        </nav>
      </div>
      <div className="topbar-right">
        <Link to="/profile" className="topbar-avatar" title={label} aria-label={label}>
          {initials}
        </Link>
      </div>
    </header>
  );
}

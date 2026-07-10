import { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../api/client";
import "./UserMenu.css";

const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

type Bucket = { solved: number; attempted: number; total: number };
type MyStats = Bucket & { byDifficulty: Record<Difficulty, Bucket> };

function initialsFor(name?: string | null, email?: string | null): string {
  const displayName = name?.trim();
  if (displayName) {
    const parts = displayName.split(/\s+/);
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const initials = initialsFor(user?.displayName, user?.email);

  // Refetch each time the menu opens — the user may have solved something since.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFailed(false);
    api.get<MyStats>("/api/judge/me/stats")
      .then(setStats)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [open]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        open &&
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <div className="user-menu-container" ref={menuRef}>
      <button
        ref={buttonRef}
        className="user-menu-button"
        onClick={() => setOpen((p) => !p)}
        title={user?.displayName || user?.email || "Account"}
        aria-label="User menu"
      >
        {initials}
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <div className="menu-header">
            <div className="menu-avatar">{initials}</div>
            <div className="menu-user-info">
              <div className="menu-name">{user?.displayName || "User"}</div>
              <div className="menu-email">{user?.email}</div>
            </div>
          </div>

          <div className="menu-divider" />

          {loading && <div className="menu-loading">Loading stats…</div>}
          {failed && <div className="menu-loading">Couldn’t load your stats.</div>}

          {!loading && !failed && stats && (
            <div className="menu-section">
              <div className="menu-section-title">Your Progress</div>

              <div className="solved-summary">
                <span className="solved-count">{stats.solved}</span>
                <span className="solved-of">/ {stats.total} solved</span>
                {stats.attempted > stats.solved && (
                  <span className="solved-attempted">
                    {stats.attempted - stats.solved} in progress
                  </span>
                )}
              </div>

              <div className="progress-rows">
                {/* A difficulty with no problems seeded would render a dead 0/0
                    bar — skip it rather than show something that looks broken. */}
                {DIFFICULTIES.filter((d) => stats.byDifficulty[d].total > 0).map((d) => {
                  const b = stats.byDifficulty[d];
                  const pct = (b.solved / b.total) * 100;
                  return (
                    <div key={d} className="progress-row">
                      <span className={`progress-label progress-${d.toLowerCase()}`}>{d}</span>
                      <div className="progress-track">
                        <div
                          className={`progress-fill progress-fill-${d.toLowerCase()}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="progress-count">
                        {b.solved}<span className="progress-total">/{b.total}</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {stats.attempted === 0 && (
                <p className="progress-empty">
                  Submit a problem and it’ll show up here.
                </p>
              )}
            </div>
          )}

          <div className="menu-divider" />

          <div className="menu-actions">
            <a href="/profile" className="menu-link" onClick={() => setOpen(false)}>
              View Profile
            </a>
            <button className="menu-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

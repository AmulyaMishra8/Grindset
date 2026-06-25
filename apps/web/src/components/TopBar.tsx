import { NavLink } from "react-router-dom";
import "./TopBar.css";

export default function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <img src="/grindset_logo.png" alt="Grindset" className="topbar-logo" />
        <nav className="topbar-nav">
          <NavLink
            to="/problems"
            className={({ isActive }) => `nav-btn${isActive ? " active" : ""}`}
          >
            Problems
          </NavLink>
          <button className="nav-btn">Discuss</button>
        </nav>
      </div>
      <div className="topbar-right">
        <button className="topbar-icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
        <button className="topbar-avatar">V</button>
      </div>
    </header>
  );
}

import { NavLink, Link } from "react-router-dom";
import UserMenu from "./UserMenu";
import "./TopBar.css";

export default function TopBar() {

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
        <UserMenu />
      </div>
    </header>
  );
}

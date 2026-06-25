import { useNavigate } from "react-router-dom";
import { authApi } from "../../api/auth";
import { useAuth } from "../../hooks/useAuth";
import { MfaSetup } from "../../components/MfaSetup";

// The logged-in landing page: shows the account and lets the user manage MFA.
export function ProfilePage() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  async function disableMfa() {
    await authApi.mfaDisable();
    await refresh();
  }

  if (!user) return null;

  const ok = { color: "#22c55e", fontWeight: 600 };
  const bad = { color: "#ef4444", fontWeight: 600 };

  return (
    <div className="page">
      <div className="row-between">
        <h1>Your account</h1>
        <button className="btn btn-secondary" style={{ width: "auto" }} onClick={handleLogout}>
          Sign out
        </button>
      </div>

      <div className="panel">
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Name:</strong> {user.displayName ?? "Not set"}</p>
        <p>
          <strong>Email verified:</strong>{" "}
          {user.emailVerified
            ? <span style={ok}>Yes</span>
            : <span style={bad}>No — check your inbox</span>}
        </p>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Two-factor authentication</h2>
        {user.mfaEnabled ? (
          <div className="row-between">
            <span style={ok}>Enabled</span>
            <button className="btn btn-secondary" style={{ width: "auto" }} onClick={disableMfa}>
              Disable
            </button>
          </div>
        ) : (
          <MfaSetup onEnabled={refresh} />
        )}
      </div>
    </div>
  );
}

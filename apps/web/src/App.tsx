import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import "./App.css";
import "./auth.css";
import { AuthProvider } from "./context/AuthProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import TopBar from "./components/TopBar";
import ProblemPage from "./pages/ProblemPage";
import ProblemsPage from "./pages/ProblemsPage";
import DiscussPage from "./pages/DiscussPage";
import DiscussThreadPage from "./pages/DiscussThreadPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { VerifyEmailPage } from "./pages/auth/VerifyEmailPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { MfaChallengePage } from "./pages/auth/MfaChallengePage";
import { ProfilePage } from "./pages/auth/ProfilePage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public auth screens — no TopBar */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/mfa" element={<MfaChallengePage />} />

          {/* Protected app screens */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/problems" replace />} />
            <Route
              path="/problems"
              element={
                <div className="app">
                  <TopBar />
                  <main className="app-main" style={{ overflowY: "auto" }}>
                    <ProblemsPage />
                  </main>
                </div>
              }
            />
            <Route
              path="/problems/:id"
              element={
                <div className="app">
                  <TopBar />
                  <main className="app-main">
                    <ProblemPage />
                  </main>
                </div>
              }
            />
            <Route
              path="/discuss"
              element={
                <div className="app">
                  <TopBar />
                  <main className="app-main" style={{ overflowY: "auto" }}>
                    <DiscussPage />
                  </main>
                </div>
              }
            />
            <Route
              path="/discuss/:id"
              element={
                <div className="app">
                  <TopBar />
                  <main className="app-main" style={{ overflowY: "auto" }}>
                    <DiscussThreadPage />
                  </main>
                </div>
              }
            />
            <Route
              path="/profile"
              element={
                <div className="app">
                  <TopBar />
                  <main className="app-main" style={{ padding: "24px" }}>
                    <ProfilePage />
                  </main>
                </div>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import "./App.css";
import "./auth.css";
import { AuthProvider } from "./context/AuthProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import TopBar from "./components/TopBar";
import LandingPage from "./pages/LandingPage";
import ProblemPage from "./pages/ProblemPage";
import ProblemsPage from "./pages/ProblemsPage";
import DiscussPage from "./pages/DiscussPage";
import DiscussThreadPage from "./pages/DiscussThreadPage";
import InterviewPage from "./pages/InterviewPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { MfaChallengePage } from "./pages/auth/MfaChallengePage";
import { ProfilePage } from "./pages/auth/ProfilePage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public front door — forwards logged-in users to /problems */}
          <Route path="/" element={<LandingPage />} />

          {/* Public auth screens — no TopBar */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/mfa" element={<MfaChallengePage />} />

          {/* Protected app screens */}
          <Route element={<ProtectedRoute />}>
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
              path="/interview"
              element={
                <div className="app">
                  <TopBar />
                  <main className="app-main" style={{ overflowY: "auto" }}>
                    <InterviewPage />
                  </main>
                </div>
              }
            />
            <Route
              path="/profile"
              element={
                <div className="app">
                  <TopBar />
                  {/* app-main is overflow:hidden by default — the profile page is
                      taller than the viewport, so it needs its own scroll. */}
                  <main className="app-main" style={{ overflowY: "auto" }}>
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

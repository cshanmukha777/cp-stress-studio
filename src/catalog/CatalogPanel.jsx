import { Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import AuthForm from "./AuthForm";
import ProblemsPage from "./ProblemsPage";
import ProfilePage from "./ProfilePage";
import TagsPage from "./TagsPage";
import AnalyticsPage from "./AnalyticsPage";
import { api, getToken, setToken } from "./api";
import "./catalog.css";

export default function CatalogPanel({ mode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!mode && Boolean(getToken()));
  const [tab, setTab] = useState("problems");
  const [notice, setNotice] = useState("");

  const [attempt, setAttempt] = useState(0);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (mode || !token || user) return;
    let current = true;
    api
      .me()
      .then((account) => {
        if (current && getToken() === token) setUser(account);
      })
      .catch(() => {
        if (current && getToken() === token) {
          setSessionError(
            "Could not verify your session. Check the API and retry.",
          );
        }
      })
      .finally(() => {
        if (current) setChecking(false);
      });

    return () => {
      current = false;
    };
  }, [attempt, mode, user]);

  useEffect(() => {
    const expired = () => {
      setUser(null);
      setTab("problems");
      setNotice("Your session expired. Please sign in again.");
      setChecking(false);
      navigate("/login", { replace: true });
    };
    window.addEventListener("cp-session-expired", expired);
    return () => window.removeEventListener("cp-session-expired", expired);
  }, [navigate]);

  function logout() {
    setToken(null);
    setUser(null);
    setTab("problems");
    setNotice("");
    navigate("/login", { replace: true });
  }

  if (!mode && !user && !getToken()) return <Navigate to="/login" replace />;

  return (
    <div className="cat-overlay" onKeyDown={(e) => e.stopPropagation()}>
      <header className="cat-header">
        <h1>Account &amp; Problems</h1>
        {user && !mode && (
          <nav className="cat-tabs">
            {[
              ["analytics", "Analytics"],
              ["problems", "Problems"],
              ["tags", "Tags"],
              ["profile", "Profile"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`cat-tab ${tab === key ? "active" : ""}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
        <div className="cat-spacer" />
        {user && !mode && (
          <>
            <span className="cat-muted">
              {user.profile?.handle ?? user.email} · {user.role}
            </span>
            <button onClick={logout}>Sign out</button>
          </>
        )}
        <button onClick={() => navigate("/")}>Back to workbench</button>
      </header>
      <main className="cat-body">
        {!mode && checking ? (
          <p className="cat-muted">Checking session...</p>
        ) : mode ? (
          <>
            {notice && <p className="cat-error">{notice}</p>}
            <AuthForm
              key={mode}
              mode={mode}
              onAuthed={(u) => {
                setNotice("");
                setUser(u);
                setSessionError("");
                navigate("/catalog", { replace: true });
              }}
            />
          </>
        ) : !user ? (
          <div className="cat-card">
            <p role="alert">
              {sessionError || "Could not verify the current session."}
            </p>
            <button
              onClick={() => {
                setChecking(true);
                setSessionError("");
                setAttempt((n) => n + 1);
              }}
            >
              Retry
            </button>
          </div>
        ) : tab === "problems" ? (
          <ProblemsPage />
        ) : tab === "analytics" ? (
          <AnalyticsPage />
        ) : tab === "tags" ? (
          <TagsPage />
        ) : (
          <ProfilePage />
        )}
      </main>
    </div>
  );
}

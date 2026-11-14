import { useEffect, useState } from "react";
import AuthForm from "./AuthForm";
import ProblemsPage from "./ProblemsPage";
import ProfilePage from "./ProfilePage";
import TagsPage from "./TagsPage";
import AnalyticsPage from "./AnalyticsPage";
import { api, getToken, setToken } from "./api";
import "./catalog.css";

export default function CatalogPanel({ onClose }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [tab, setTab] = useState("problems");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const expired = () => {
      setUser(null);
      setTab("problems");
      setNotice("Your session expired. Please sign in again.");
    };
    window.addEventListener("cp-session-expired", expired);
    return () => window.removeEventListener("cp-session-expired", expired);
  }, []);

  function logout() {
    setToken(null);
    setUser(null);
    setTab("problems");
    setNotice("");
  }

  return (
    <div className="cat-overlay" onKeyDown={(e) => e.stopPropagation()}>
      <header className="cat-header">
        <h1>Account &amp; Problems</h1>
        {user && (
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
        {user && (
          <>
            <span className="cat-muted">
              {user.profile?.handle ?? user.email} · {user.role}
            </span>
            <button onClick={logout}>Sign out</button>
          </>
        )}
        <button onClick={onClose}>Back to workbench</button>
      </header>
      <main className="cat-body">
        {checking ? (
          <p className="cat-muted">Checking session...</p>
        ) : !user ? (
          <>
            {notice && <p className="cat-error">{notice}</p>}
            <AuthForm
              onAuthed={(u) => {
                setNotice("");
                setUser(u);
              }}
            />
          </>
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
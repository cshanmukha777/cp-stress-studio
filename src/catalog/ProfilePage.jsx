import { useEffect, useState } from "react";
import { api } from "./api";

const LANGUAGES = [
  ["cpp", "C++17"],
  ["python", "Python 3"],
  ["java", "Java"],
];

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ displayName: "", bio: "", language: "cpp" });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .profile()
      .then((p) => {
        setProfile(p);
        setForm({
          displayName: p.displayName,
          bio: p.bio ?? "",
          language: p.language,
        });
      })
      .catch((e) => setError(e.message));
  }, []);

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    setSaved(false);
  };

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setBusy(true);
    try {
      await api.updateProfile({
        displayName: form.displayName,
        bio: form.bio.trim() === "" ? null : form.bio,
        language: form.language,
      });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!profile && !error) return <p className="cat-muted">Loading profile...</p>;

  return (
    <form className="cat-card cat-profile" onSubmit={submit}>
      <h2>Your profile</h2>
      {profile && (
        <p className="cat-muted">
          {profile.user.email} · {profile.user.role} · joined{" "}
          {new Date(profile.user.createdAt).toLocaleDateString()}
        </p>
      )}
      <label>
        Handle
        <input value={profile?.handle ?? ""} disabled />
      </label>
      <label>
        Display name
        <input required value={form.displayName} onChange={set("displayName")} />
      </label>
      <label>
        Bio
        <textarea rows="3" maxLength="300" value={form.bio} onChange={set("bio")} />
      </label>
      <label>
        Preferred language
        <select value={form.language} onChange={set("language")}>
          {LANGUAGES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="cat-error" role="alert">
          {error}
        </p>
      )}
      {saved && <p className="cat-ok">Profile saved.</p>}
      <button className="primary" type="submit" disabled={busy || !profile}>
        {busy ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
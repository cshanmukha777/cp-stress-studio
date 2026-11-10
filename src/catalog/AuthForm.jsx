import { useState } from "react";
import { api, setToken } from "./api";

export default function AuthForm({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    handle: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result =
        mode === "login"
          ? await api.login(form.email, form.password)
          : await api.register(form);
      setToken(result.token);
      onAuthed(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="cat-card" onSubmit={submit}>
      <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>
      <label>
        Email
        <input type="email" required value={form.email} onChange={set("email")} />
      </label>
      <label>
        Password
        <input
          type="password"
          required
          minLength={mode === "register" ? 8 : undefined}
          value={form.password}
          onChange={set("password")}
        />
      </label>
      {mode === "register" && (
        <>
          <label>
            Display name
            <input required value={form.displayName} onChange={set("displayName")} />
          </label>
          <label>
            Handle
            <input required value={form.handle} onChange={set("handle")} />
          </label>
        </>
      )}
      {error && (
        <p className="cat-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Register"}
      </button>
      <button
        type="button"
        className="cat-link"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
        }}
      >
        {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
      </button>
    </form>
  );
}
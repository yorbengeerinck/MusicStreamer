import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth, type UserSlug } from "../auth";
import "../spotify.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { user } = useParams<{ user: UserSlug }>();
  const slug = user === "yorben" || user === "zus" ? user : null;

  const displayName = slug === "yorben" ? "Yorben" : slug === "zus" ? "Yenthel" : "Onbekend";
  const avatar = slug === "yorben" ? "/avatars/yorben.jpg" : "/avatars/yenthel.jpg";

  const baseUrl =
    (import.meta as any).env?.VITE_API_URL ||
    (import.meta.env.PROD ? window.location.origin : "http://localhost:5000");

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submitLogin() {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: slug, password }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setError(err?.error || "Login mislukt");
        return;
      }
      const data = await resp.json();
      login(data.token, slug); // session-only (in-memory)
      navigate(`/${slug}`);
    } catch {
      setError("Kon niet verbinden met de server.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") submitLogin();
  }

  if (!slug) {
    return (
      <div className="spotify-app">
        <aside className="sidebar"><h1 className="logo">🎵 MusicStreamer</h1></aside>
        <main className="main-content select-mode">
          <section className="auth-page">
            <h2 className="select-title">Onbekende gebruiker</h2>
            <Link className="btn-primary" to="/">Terug</Link>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="spotify-app">
      <aside className="sidebar"><h1 className="logo">🎵 MusicStreamer</h1></aside>

      <main className="main-content select-mode">
        <section className="auth-page">
          <div className="auth-card">
            <div className="auth-user">
              <img className="user-avatar lg" src={avatar} alt={displayName} />
              <h2 className="auth-title">Inloggen — {displayName}</h2>
            </div>

            <label className="modal-label" htmlFor="password">Wachtwoord</label>

            <div className="password-field">
              <input
                id="password"
                ref={inputRef}
                type={showPassword ? "text" : "password"}
                className="login-input"
                placeholder="Voer je wachtwoord in"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Verberg wachtwoord" : "Toon wachtwoord"}
                aria-pressed={showPassword}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setShowPassword((v) => !v);
                  inputRef.current?.focus({ preventScroll: true });
                }}
                disabled={loading}
                title={showPassword ? "Verberg wachtwoord" : "Toon wachtwoord"}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M2.1 3.51 3.51 2.1l18.39 18.39-1.41 1.41-2.53-2.53A11.53 11.53 0 0 1 12 20C6.73 20 2.36 16.64 1 12c.54-1.79 1.54-3.39 2.86-4.7l-1.76-1.79zm6.2 6.2 1.6 1.6a2.75 2.75 0 0 0 3.48 3.48l1.6 1.6A5.25 5.25 0 0 1 8.3 9.71zM12 6.5c5.27 0 9.64 3.36 11 8-.42 1.39-1.12 2.66-2.05 3.74l-2.04-2.04A5.25 5.25 0 0 0 10.8 8.54l-2-2A11.6 11.6 0 0 1 12 6.5z"></path>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 5c5.27 0 9.64 3.36 11 8-1.36 4.64-5.73 8-11 8S2.36 17.64 1 13c1.36-4.64 5.73-8 11-8zm0 2.5C7.86 7.5 4.27 10.19 3.1 13 4.27 15.81 7.86 18.5 12 18.5S19.73 15.81 20.9 13C19.73 10.19 16.14 7.5 12 7.5zm0 2a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z"></path>
                  </svg>
                )}
              </button>
            </div>

            {error && <div className="modal-error">{error}</div>}

            <div className="auth-actions">
              <Link className="btn-secondary" to="/">Annuleren</Link>
              <button
                type="button"
                className="btn-primary"
                onClick={submitLogin}
                disabled={loading || password.length === 0}
              >
                {loading ? "Bezig…" : "Inloggen"}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
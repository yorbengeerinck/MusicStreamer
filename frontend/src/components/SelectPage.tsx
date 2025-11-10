import { useNavigate } from "react-router-dom";
import "../spotify.css";

export default function SelectPage() {
  const navigate = useNavigate();

  return (
    <div className="spotify-app">
      <aside className="sidebar">
        <h1 className="logo">🎵 MusicStreamer</h1>
      </aside>

      <main className="main-content select-mode">
        <section className="select-page">
          <h2 className="select-title">Kies een gebruiker</h2>
          <div className="user-grid">
            <button
              type="button"
              className="user-card"
              aria-label="Open Yorben playlist"
              onClick={() => navigate("/login/yorben")}
            >
              <img className="user-avatar" src="/avatars/yorben.jpg" alt="Yorben" />
              <span className="user-name"> 🎵 Yorben</span>
            </button>

            <button
              type="button"
              className="user-card"
              aria-label="Open Yenthel playlist"
              onClick={() => navigate("/login/zus")}
            >
              <img className="user-avatar" src="/avatars/yenthel.jpg" alt="Yenthel" />
              <span className="user-name"> 🎵 Yenthel</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
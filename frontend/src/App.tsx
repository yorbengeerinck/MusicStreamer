import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SongPlayer from "./components/SongPlayer";
import SongList, { type Song } from "./components/SongList";
import { useAuth } from "./auth";
import SearchBar from "./components/SearchBar";
import ThemeToggle from "./components/ThemeToggle";
import { getCurrentTheme, setTheme } from "./theme";
import "./spotify.css";

type AppProps = {
  collection?: string; // bijvoorbeeld "yenthel"
};

function App({ collection }: AppProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [darkMode, setDarkMode] = useState(getCurrentTheme() === "dark");
  const navigate = useNavigate();

  // Dynamische backend URL: localhost voor dev, Render URL voor productie
  const baseUrl =
    (import.meta as any).env?.VITE_API_URL ||
    (import.meta.env.PROD ? window.location.origin : "http://localhost:5000");

  const { token } = useAuth();

  useEffect(() => {
    let abort = false;
    async function loadSongs() {
      if (!token) { setSongs([]); return; }
      const resp = await fetch(
        `${baseUrl}/songs${collection ? `?collection=${collection}` : ""}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) { if (!abort) setSongs([]); return; }
      const data = await resp.json().catch(() => []);
      if (!abort) setSongs(Array.isArray(data) ? data : []);
    }
    loadSongs();
    return () => { abort = true; };
  }, [token, collection, baseUrl]);

  // toggle handler
  const onToggleTheme = (next?: boolean) => {
    const val = typeof next === "boolean" ? next : !darkMode;
    setTheme(val ? "dark" : "light");
    setDarkMode(val);
  };

  const filteredSongs = songs.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const currentIndex = filteredSongs.findIndex((s) => s.id === currentSongId);

  function playPrev() {
    if (filteredSongs.length === 0) return;
    if (currentIndex > 0) {
      setCurrentSongId(filteredSongs[currentIndex - 1].id);
    } else {
      setCurrentSongId(filteredSongs[filteredSongs.length - 1].id);
    }
  }

  function playNext() {
    if (filteredSongs.length === 0) return;
    if (currentIndex < filteredSongs.length - 1) {
      setCurrentSongId(filteredSongs[currentIndex + 1].id);
    } else {
      setCurrentSongId(filteredSongs[0].id);
    }
  }

  function shuffleSong() {
    if (filteredSongs.length === 0) return;
    const randomSong =
      filteredSongs[Math.floor(Math.random() * filteredSongs.length)];
    setCurrentSongId(randomSong.id);
  }

  // bepaal huidig nummer één keer
  const currentSong = songs.find(s => s.id === currentSongId) ?? null;

  const isSister = collection === "yenthel";
  const displayName = isSister ? "Yenthel" : "Yorben";
  const avatarSrc = `/avatars/${isSister ? "yenthel" : "yorben"}.jpg`;
  const playlistTitle = isSister ? "Playlist van Yenthel" : "Playlist van Yorben";

  return (
    <div className="spotify-app music-mode">
      {/* NAV: brand links, theme center, profile + switch rechts */}
      <header className="topbar nav">
        <div className="nav-left">
          <span className="brand">MusicStreamer</span>
        </div>
        <div className="nav-center">
          <ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} />
        </div>
        <div className="nav-right">
          <button className="switch-btn" onClick={() => navigate("/")}>
            Kies gebruiker
          </button>
          <img className="avatar" src={avatarSrc} alt={displayName} />
        </div>
      </header>

      {/* Zoekbalk onder de nav, rest blijft ongewijzigd */}
      <main className="main-content">
        <header className="topbar under-nav">
          <SearchBar value={search} onChange={setSearch} />
        </header>

        <section className="playlist-section">
          <h2 className="playlist-title">{playlistTitle}</h2>
          <SongList
            songs={filteredSongs}
            currentSongId={currentSongId}
            onSelect={setCurrentSongId}
            collection={collection}
          />
        </section>
      </main>

      <footer className="player-footer">
        <SongPlayer
          song={currentSong}              // <-- gebruik de variabele
          onPrev={playPrev}
          onNext={playNext}
          onShuffle={shuffleSong}
          baseUrl={baseUrl}
        />
      </footer>
    </div>
  );
}

export default App;

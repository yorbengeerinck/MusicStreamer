import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import "./player.css";

export type Song = {
  id: string;
  name: string;
  artist?: string;
  durationMs?: number;
};

type Props = {
  songs: Song[];
  currentSongId: string | null;
  onSelect: (id: string) => void;
  collection?: string; // alleen voor titel/labeling indien gewenst
};

export default function SongList({ songs, currentSongId, onSelect }: Props) {
  return (
    <ul className="song-list">
      {songs.map((s) => (
        <li
          key={s.id}
          className={`song-item${s.id === currentSongId ? " active" : ""}`}
          onClick={() => onSelect(s.id)}
          onKeyDown={(e) => e.key === "Enter" && onSelect(s.id)}
          tabIndex={0}
          role="button"
          aria-pressed={s.id === currentSongId}
        >
          <div className="song-meta">
            <div className="song-title">{`🎵 ${s.name}`}</div>
            {s.artist && <div className="song-artist">{s.artist}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SongListContainer({ collection }: { collection?: string }) {
  const { token } = useAuth();
  const baseUrl =
    (import.meta as any).env?.VITE_API_URL ||
    (import.meta.env.PROD ? window.location.origin : "http://localhost:5000");

  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);

  useEffect(() => {
    let abort = false;
    async function load() {
      try {
        const resp = await fetch(`${baseUrl}/songs${collection ? `?collection=${collection}` : ""}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) {
          // 401 -> terug naar selectpage of toon fout
          if (!abort) console.error(`Laden mislukt (${resp.status})`);
          return;
        }
        const data = await resp.json();
        if (!abort) setSongs(Array.isArray(data) ? data : []);
      } catch {
        if (!abort) console.error("Kon songs niet laden");
      }
    }
    if (token) load();
    else setSongs([]); // niet ingelogd
    return () => { abort = true; };
  }, [token, collection, baseUrl]);

  return (
    <SongList
      songs={songs}
      currentSongId={currentSongId}
      onSelect={(id) => setCurrentSongId(id)}
    />
  );
}
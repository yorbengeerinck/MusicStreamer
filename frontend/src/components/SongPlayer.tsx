import React, { useEffect, useState } from "react";
import AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import "./player.css";
import { useAuth } from "../auth";
import type { Song } from "./SongList";

type SongPlayerProps = {
  song: Song | null;
  onPrev: () => void;
  onNext: () => void;
  onShuffle: () => void;
  baseUrl: string;
};

const SongPlayer: React.FC<SongPlayerProps> = ({
  song,
  onPrev,
  onNext,
  onShuffle,
  baseUrl,
}) => {
  const { token } = useAuth();
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Haal kortlevende signed URL op voor de huidige song
  useEffect(() => {
    let abort = false;

    async function fetchSignedUrl() {
      if (!song || !token) {
        setSrc(null);
        return;
      }
      setLoading(true);
      try {
        const resp = await fetch(`${baseUrl}/api/stream-url/${song.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) {
          if (!abort) setSrc(null);
          return;
        }
        const data = await resp.json().catch(() => null);
        if (!abort) setSrc(typeof data?.url === "string" ? data.url : null);
      } catch {
        if (!abort) setSrc(null);
      } finally {
        if (!abort) setLoading(false);
      }
    }

    fetchSignedUrl();
    return () => {
      abort = true;
    };
  }, [song?.id, token, baseUrl]);

  if (!song) {
    return (
      <div className="player-bar">
        <span className="player-empty">Kies een nummer om te spelen</span>
      </div>
    );
  }

  return (
    <div className="player-bar">
      <div className="player-controls">
        <button aria-label="Vorige" className="player-btn" onClick={onPrev}>
          ⏮️
        </button>
        <button aria-label="Shuffle" className="player-btn" onClick={onShuffle}>
          🔀
        </button>
        <button aria-label="Volgende" className="player-btn" onClick={onNext}>
          ⏭️
        </button>
      </div>

      <div className="player-song-row">
        <span className="player-song">{song.name}</span>
      </div>

      <AudioPlayer
        key={`${song.id}-${src ?? "none"}`} // forceer her-mount bij nieuwe signed URL
        autoPlay
        autoPlayAfterSrcChange
        preload="metadata"
        src={src ?? undefined}
        onEnded={onNext}
        onError={() => {
          /* stil in prod; geen console output */
        }}
        // crossOrigin is niet nodig op same-origin; we laten het weg
        showJumpControls={false}
        showDownloadProgress={false}
        customAdditionalControls={[]}
        layout="horizontal"
        style={{ borderRadius: "12px", boxShadow: "0 2px 12px #1db95433" }}
      />

      {!src && !loading && (
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          Kon stream-URL niet ophalen. Ben je ingelogd?
        </div>
      )}
    </div>
  );
};

export default SongPlayer;

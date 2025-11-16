import React, { useEffect, useRef, useState } from "react";
import AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import "./player.css";
import { useAuth } from "../auth";
import type { Song } from "./SongList";

declare global {
  interface Window {
    __MS_AUDIO_STORE?: {
      ctx: AudioContext | null;
      sources: WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>;
    };
  }
}
if (!window.__MS_AUDIO_STORE) {
  window.__MS_AUDIO_STORE = { ctx: null, sources: new WeakMap() };
}
const audioStore = window.__MS_AUDIO_STORE;

type SongPlayerProps = {
  song: Song | null;
  onPrev: () => void;
  onNext: () => void;
  onShuffle: () => void;
  baseUrl: string;
};

const SongPlayer: React.FC<SongPlayerProps> = ({ song, onPrev, onNext, onShuffle, baseUrl }) => {
  const { token } = useAuth();
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const playerRef = useRef<any>(null);
  const pannerRef = useRef<PannerNode | null>(null);

  const [isImmersive, setIsImmersive] = useState(() => {
    try {
      return localStorage.getItem("immersive") === "1";
    } catch {
      return false;
    }
  });
  const [supportsHRTF, setSupportsHRTF] = useState<boolean>(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      (window.AudioContext || (window as any).webkitAudioContext) &&
      typeof (window as any).AudioContext.prototype.createPanner === "function";
    setSupportsHRTF(Boolean(ok));
  }, []);

  useEffect(() => {
    const richAudio = playerRef.current?.audio?.current as HTMLAudioElement | undefined;
    if (richAudio && !richAudio.crossOrigin) {
      richAudio.crossOrigin = "anonymous";
    }
  });

  const ensureContext = (): AudioContext | null => {
    if (!audioStore.ctx || audioStore.ctx.state === "closed") {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      audioStore.ctx = new AC();
    }
    return audioStore.ctx;
  };

  const toggleImmersive = () => {
    setIsImmersive((prev) => !prev);
  };

  useEffect(() => {
    const richAudio = playerRef.current?.audio?.current as HTMLAudioElement | undefined;

    try {
      pannerRef.current?.disconnect();
    } catch {}
    pannerRef.current = null;

    if (!richAudio) {
      return;
    }

    const ctx = ensureContext();
    if (!ctx) {
      console.warn("AudioContext not available");
      setIsImmersive(false);
      return;
    }

    (async () => {
      try {
        if (ctx.state === "suspended") await ctx.resume();
      } catch (e) {
        console.warn("Failed to resume AudioContext:", e);
      }
    })();

    let sourceNode = audioStore.sources.get(richAudio);
    if (!sourceNode) {
      try {
        sourceNode = ctx.createMediaElementSource(richAudio);
        audioStore.sources.set(richAudio, sourceNode);
      } catch (err) {
        console.warn("Failed to create MediaElementSource:", err);
        setIsImmersive(false);
        return;
      }
    }

    try {
      sourceNode.disconnect();
    } catch {}

    if (!isImmersive) {
      try {
        sourceNode.connect(ctx.destination);
      } catch (err) {
        console.warn("Failed to connect source to destination:", err);
      }
      return;
    }

    try {
      const panner = ctx.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = 1;
      if (typeof panner.positionX !== "undefined") {
        panner.positionX.value = 0;
        panner.positionY.value = 0;
        panner.positionZ.value = -1;
      } else {
        panner.setPosition(0, 0, -1);
      }

      sourceNode.connect(panner);
      panner.connect(ctx.destination);
      pannerRef.current = panner;
    } catch (err) {
      console.warn("Failed to connect panner:", err);
      try {
        sourceNode.connect(ctx.destination);
      } catch {}
      setIsImmersive(false);
      return;
    }

    return () => {
      try {
        pannerRef.current?.disconnect();
      } catch {}
      pannerRef.current = null;
    };
  }, [isImmersive, src, song?.id]);

  useEffect(() => {
    return () => {
      if (audioStore.ctx && audioStore.ctx.state !== "closed") {
        try {
          audioStore.ctx.close();
        } catch {}
        audioStore.ctx = null;
      }
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("immersive", isImmersive ? "1" : "0");
    } catch {}
  }, [isImmersive]);

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
        className="rhap_container"
        ref={playerRef}
        key={`${song.id}-${src ?? "none"}`}
        autoPlay
        autoPlayAfterSrcChange
        preload="metadata"
        src={src ?? undefined}
        onEnded={onNext}
        onError={() => {}}
        showJumpControls={false}
        showDownloadProgress={false}
        customAdditionalControls={[]}
        layout="horizontal"
        crossOrigin="anonymous"
      />

      {!src && !loading && <div className="player-error">Kon stream-URL niet ophalen. Ben je ingelogd?</div>}

      <div className="player-meta">
        <div className="player-immersive-toggle">
          <label>
            <input type="checkbox" checked={isImmersive} onChange={toggleImmersive} disabled={!supportsHRTF} /> Immersive
            (HRTF)
          </label>
          {!supportsHRTF && <span className="player-immersive-note">Immersive niet ondersteund in deze browser</span>}
        </div>
      </div>
    </div>
  );
};

export default SongPlayer;

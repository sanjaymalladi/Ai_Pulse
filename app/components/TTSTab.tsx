'use client';

import { useState, useRef, useEffect } from 'react';

// Proxied through Next.js API route to avoid CORS
const TTS_ENDPOINT = '/api/tts';

interface TTSTabProps {
  script: string | null;
}

export default function TTSTab({ script }: TTSTabProps) {
  const [status, setStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const prevUrlRef = useRef<string | null>(null);

  // Cleanup old object URL
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  async function generateSpeech() {
    if (!script) return;
    setStatus('generating');
    setErrorMsg('');

    try {
      const res = await fetch(TTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script }),
      });

      if (!res.ok) throw new Error(`TTS_SERVER_REJECTED // HTTP ${res.status}`);
      if (!res.body) throw new Error('No response body');

      // Read SSE stream — route sends keep-alive pings every 5s while the
      // upstream model runs, then sends the audio payload as base64.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let done = false;

      while (!done) {
        const chunk = await reader.read();
        if (chunk.done) break;

        buf += decoder.decode(chunk.value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';

        for (const part of parts) {
          const lines = part.trim().split('\n');
          let event = 'message';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            if (line.startsWith('data:')) data = line.slice(5).trim();
          }

          if (event === 'ping') continue;

          if (event === 'error') {
            const payload = JSON.parse(data);
            throw new Error(payload.message || 'UNKNOWN_TTS_ERROR');
          }

          if (event === 'audio') {
            const { contentType, base64 } = JSON.parse(data);
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: contentType });

            if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
            const url = URL.createObjectURL(blob);
            prevUrlRef.current = url;
            setAudioUrl(url);
            setStatus('ready');
            setCurrentTime(0);
            setIsPlaying(false);
            done = true;
            break;
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'UNKNOWN_FAILURE');
      setStatus('error');
    }
  }


  function downloadWav() {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `tts_output_${Date.now()}.wav`;
    a.click();
  }

  // Audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoad = () => setDuration(audio.duration);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoad);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoad);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [audioUrl]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play();
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
  }

  function handleVolume(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    setIsMuted(v === 0);
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !isMuted;
    setIsMuted(next);
    audio.volume = next ? 0 : volume;
  }

  function formatTime(s: number) {
    if (!isFinite(s)) return '00:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  /* ─── States ─── */
  if (!script) {
    return (
      <div className="state-container">
        <p style={{ color: 'var(--text-dim)' }}>
          NO SCRIPT LOADED — GENERATE A SCRIPT IN{' '}
          <span style={{ color: 'var(--brand-neon)' }}>SCRIPT_GEN</span> FIRST.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '64px' }}>
      {/* Script Preview */}
      <div className="modal-box" style={{ width: '100%', maxWidth: '100%', boxShadow: 'none', position: 'relative' }}>
        <div className="modal-header">
          <span className="modal-title">LOADED_SCRIPT_PAYLOAD</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            {script.length.toLocaleString()} CHARS
          </span>
        </div>
        <div
          className="modal-body"
          style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-mono, monospace)',
            background: 'rgba(0,0,0,0.5)',
            padding: '24px',
            lineHeight: '1.6',
            fontSize: '0.9rem',
            color: 'var(--text-dim)',
            maxHeight: '180px',
            overflowY: 'auto',
          }}
        >
          {script}
        </div>
      </div>

      {/* Generate Button */}
      {status !== 'ready' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <button
            className="sys-btn"
            onClick={generateSpeech}
            disabled={status === 'generating'}
            style={{
              fontSize: '1rem',
              padding: '12px 32px',
              borderColor: 'var(--brand-neon)',
              color: status === 'generating' ? 'var(--text-dim)' : 'var(--brand-neon)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {status === 'generating' ? (
              <>
                <span style={{ position: 'relative', zIndex: 1 }}>[ SYNTHESIZING_AUDIO... ]</span>
                <span className="tts-shimmer" />
              </>
            ) : (
              '[ TRANSMIT_TO_TTS_ENGINE ]'
            )}
          </button>

          {status === 'generating' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <div className="loading-bar" style={{ maxWidth: '100%' }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                AWAITING AUDIO STREAM RESPONSE FROM NEURAL_VOICE_SVC...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="state-container error" style={{ borderColor: 'var(--brand-alert)' }}>
          <h3 style={{ color: 'var(--brand-alert)', fontSize: '1.25rem', marginBottom: '12px' }}>
            [ TTS_TRANSMISSION_FAILED ]
          </h3>
          <p style={{ marginBottom: '20px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>{errorMsg}</p>
          <button className="sys-btn error-btn" onClick={generateSpeech}>
            [ RETRY_TRANSMISSION ]
          </button>
        </div>
      )}

      {/* Audio Player */}
      {status === 'ready' && audioUrl && (
        <>
          <audio ref={audioRef} src={audioUrl} preload="auto" />

          <div
            className="tts-player"
            style={{
              border: '2px solid var(--brand-neon)',
              background: '#000',
              boxShadow: '0 0 40px rgba(204,255,0,0.08), 8px 8px 0 var(--brand-neon)',
              padding: '0',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Player Header */}
            <div
              style={{
                background: 'var(--brand-neon)',
                color: '#000',
                padding: '10px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em' }}>
                ◈ NEURAL_VOICE_OUTPUT // READY
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Waveform visualizer (CSS art) */}
            <div
              style={{
                padding: '24px 24px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                height: '72px',
              }}
            >
              {Array.from({ length: 64 }).map((_, i) => {
                const barProgress = (i / 64) * 100;
                const isPast = barProgress <= progress;
                const height = 20 + Math.sin(i * 0.8) * 12 + Math.sin(i * 0.3) * 10 + (i % 5 === 0 ? 14 : 0);
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${height}px`,
                      background: isPast
                        ? 'var(--brand-neon)'
                        : isPlaying
                        ? `rgba(204,255,0,${0.15 + Math.random() * 0.1})`
                        : 'rgba(255,255,255,0.08)',
                      transition: 'background 0.15s ease',
                      borderRadius: '1px',
                      animation: isPlaying && isPast ? `tts-wave-${i % 4} 0.4s ease infinite alternate` : 'none',
                    }}
                  />
                );
              })}
            </div>

            {/* Seek bar */}
            <div style={{ padding: '0 24px' }}>
              <div
                ref={progressRef}
                onClick={seek}
                style={{
                  width: '100%',
                  height: '6px',
                  background: 'rgba(255,255,255,0.1)',
                  cursor: 'crosshair',
                  position: 'relative',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${progress}%`,
                    background: 'var(--brand-neon)',
                    transition: 'width 0.1s linear',
                  }}
                />
                {/* Playhead */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: `${progress}%`,
                    transform: 'translate(-50%, -50%)',
                    width: '12px',
                    height: '12px',
                    background: 'var(--brand-neon)',
                    border: '2px solid #000',
                    boxShadow: '0 0 8px var(--brand-neon)',
                    transition: 'left 0.1s linear',
                  }}
                />
              </div>
            </div>

            {/* Controls */}
            <div
              style={{
                padding: '20px 24px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              {/* Play / Pause */}
              <button
                className="sys-btn"
                onClick={togglePlay}
                style={{
                  borderColor: 'var(--brand-neon)',
                  color: 'var(--brand-neon)',
                  padding: '10px 20px',
                  fontSize: '1.2rem',
                  minWidth: '60px',
                  textAlign: 'center',
                }}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>

              {/* Stop */}
              <button
                className="sys-btn"
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                  }
                }}
                style={{ padding: '10px 16px', fontSize: '1rem' }}
              >
                ⏹
              </button>

              {/* Volume */}
              <button
                className="sys-btn"
                onClick={toggleMute}
                style={{ padding: '10px 14px', fontSize: '1rem', minWidth: '44px' }}
              >
                {isMuted || volume === 0 ? '🔇' : '🔊'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={isMuted ? 0 : volume}
                onChange={handleVolume}
                style={{
                  width: '100px',
                  accentColor: 'var(--brand-neon)',
                  cursor: 'crosshair',
                }}
              />

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Regenerate */}
              <button
                className="sys-btn"
                onClick={() => { setStatus('idle'); setAudioUrl(null); }}
                style={{ fontSize: '0.8rem' }}
              >
                [ RE-SYNTHESIZE ]
              </button>

              {/* Download */}
              <button
                className="sys-btn"
                onClick={downloadWav}
                style={{
                  borderColor: 'var(--brand-neon)',
                  color: 'var(--brand-neon)',
                  fontSize: '0.8rem',
                }}
              >
                [ EXPORT_WAV ]
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        .tts-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(204,255,0,0.15) 50%, transparent 100%);
          animation: tts-shimmer 1.4s infinite linear;
        }
        @keyframes tts-shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(100%); }
        }
        @keyframes tts-wave-0 { to { transform: scaleY(1.3); } }
        @keyframes tts-wave-1 { to { transform: scaleY(1.5); } }
        @keyframes tts-wave-2 { to { transform: scaleY(1.2); } }
        @keyframes tts-wave-3 { to { transform: scaleY(1.4); } }
      `}</style>
    </div>
  );
}

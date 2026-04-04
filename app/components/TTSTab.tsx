'use client';

import { useEffect, useRef, useState } from 'react';
import { saveStudioTtsAudio } from '../lib/studioAudioCache';
import { getTtsDirectUrl, isVercelBrowser } from '../lib/ttsClient';

const TTS_START_ENDPOINT = '/api/tts/start';

interface TTSTabProps {
  script: string | null;
  initialAudioUrl?: string | null;
  initialServerAudioUrl?: string | null;
  onAudioGenerated?: (url: string | null) => void;
  onServerAudioGenerated?: (url: string | null) => void;
}

type TtsStatus = 'idle' | 'generating' | 'ready' | 'error';

function makeRequestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tts_${Date.now()}`;
}

export default function TTSTab({
  script,
  initialAudioUrl = null,
  initialServerAudioUrl = null,
  onAudioGenerated,
  onServerAudioGenerated,
}: TTSTabProps) {
  const [status, setStatus] = useState<TtsStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState('idle');
  const [statusDetail, setStatusDetail] = useState('');
  const [serverAudioUrl, setServerAudioUrl] = useState<string | null>(initialServerAudioUrl);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const prevUrlRef = useRef<string | null>(null);
  const activeRequestRef = useRef<string | null>(null);
  const activeJobRef = useRef<string | null>(null);
  const generateLockRef = useRef(false);

  useEffect(() => {
    if (!initialAudioUrl) return;
    setAudioUrl(initialAudioUrl);
    setStatus('ready');
    setCurrentTime(0);
    setIsPlaying(false);
  }, [initialAudioUrl]);

  useEffect(() => {
    if (!initialServerAudioUrl) return;
    setServerAudioUrl(initialServerAudioUrl);
  }, [initialServerAudioUrl]);

  async function finalizeTtsBlob(blob: Blob, currentRequestId: string) {
    await saveStudioTtsAudio(blob);
    if (prevUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(prevUrlRef.current);
    }
    if (activeRequestRef.current !== currentRequestId) return;
    const url = URL.createObjectURL(blob);
    prevUrlRef.current = url;
    setAudioUrl(url);
    onAudioGenerated?.(url);
    setStatus('ready');
    setCurrentTime(0);
    setIsPlaying(false);
    setLastEvent('audio_ready');
    setStatusDetail(`Audio finalized (${Math.round(blob.size / 1024)} KB).`);
  }

  async function pollJob(currentRequestId: string, currentJobId: string) {
    let attempts = 0;
    let consecutiveFailures = 0;

    while (activeRequestRef.current === currentRequestId && activeJobRef.current === currentJobId) {
      attempts += 1;
      try {
        const statusRes = await fetch(`/api/tts/status/${encodeURIComponent(currentJobId)}`, {
          cache: 'no-store',
        });
        const statusPayload = await statusRes.json().catch(() => ({}));
        if (!statusRes.ok) {
          throw new Error(statusPayload.error || `TTS_STATUS_FAILED // HTTP ${statusRes.status}`);
        }

        consecutiveFailures = 0;
        const jobStatus = typeof statusPayload.status === 'string' ? statusPayload.status : 'unknown';
        const eta = typeof statusPayload.eta === 'number' ? `${Math.round(statusPayload.eta)}s` : 'n/a';
        const rank =
          typeof statusPayload.rank === 'number' && typeof statusPayload.queue_size === 'number'
            ? `${statusPayload.rank}/${statusPayload.queue_size}`
            : 'n/a';

        setLastEvent(`status:${jobStatus}`);
        setStatusDetail(`JOB ${jobStatus.toUpperCase()} // ETA ${eta} // QUEUE ${rank} // POLL ${attempts}`);

        if (jobStatus === 'failed') {
          throw new Error(statusPayload.error || 'TTS_JOB_FAILED');
        }

        if (jobStatus === 'done') {
          setLastEvent('result_fetching');
          setStatusDetail('Job finished. Downloading audio result...');
          const resultRes = await fetch(`/api/tts/result/${encodeURIComponent(currentJobId)}`, {
            cache: 'no-store',
          });
          if (!resultRes.ok) {
            throw new Error(`TTS_RESULT_FAILED // HTTP ${resultRes.status}`);
          }
          const cachedUrl = resultRes.headers.get('X-Studio-Cache-Url');
          if (cachedUrl) {
            setServerAudioUrl(cachedUrl);
            onServerAudioGenerated?.(cachedUrl);
          }
          const blob = await resultRes.blob();
          if (blob.size === 0) throw new Error('TTS_EMPTY_RESULT');
          await finalizeTtsBlob(blob, currentRequestId);
          return;
        }
      } catch (error) {
        consecutiveFailures += 1;
        setLastEvent('poll_error');
        setStatusDetail(`Polling issue ${consecutiveFailures}/5. Retrying...`);
        if (consecutiveFailures >= 5) {
          throw error;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  async function generateSpeech() {
    if (!script || generateLockRef.current) return;

    const currentRequestId = makeRequestId();
    generateLockRef.current = true;
    activeRequestRef.current = currentRequestId;
    activeJobRef.current = null;
    setRequestId(currentRequestId);
    setJobId(null);
    setLastEvent('request_created');
    setStatusDetail('Submitting synthesis request.');
    setStatus('generating');
    setErrorMsg('');

    try {
      const directUrl = getTtsDirectUrl();
      if (directUrl) {
        setStatusDetail('Direct TTS URL is configured, but polling mode now expects the Next.js proxy.');
      }

      const startRes = await fetch(TTS_START_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script, requestId: currentRequestId }),
      });
      const startPayload = await startRes.json().catch(() => ({}));
      if (!startRes.ok) {
        throw new Error(startPayload.error || `TTS_START_FAILED // HTTP ${startRes.status}`);
      }

      const newJobId = String(startPayload.jobId || '');
      if (!newJobId) throw new Error('TTS_START_MISSING_JOB_ID');

      activeJobRef.current = newJobId;
      setJobId(newJobId);
      setLastEvent('job_started');
      setStatusDetail(`Job queued: ${newJobId}`);

      await pollJob(currentRequestId, newJobId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'UNKNOWN_FAILURE';
      if (activeRequestRef.current === currentRequestId) {
        setLastEvent('error');
        setStatusDetail('Generation failed before audio was finalized.');
        setErrorMsg(message);
        setStatus('error');
      }
    } finally {
      if (activeRequestRef.current === currentRequestId) {
        generateLockRef.current = false;
      }
    }
  }

  function downloadWav() {
    const downloadSource = serverAudioUrl || audioUrl;
    if (!downloadSource) return;
    const a = document.createElement('a');
    a.href = downloadSource;
    a.download = `tts_output_${Date.now()}.wav`;
    a.click();
  }

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
    else void audio.play();
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

  if (!script) {
    return (
      <div className="state-container">
        <p style={{ color: 'var(--text-dim)' }}>
          NO SCRIPT LOADED. GENERATE A SCRIPT IN <span style={{ color: 'var(--brand-neon)' }}>SCRIPT_GEN</span> FIRST.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '64px' }}>
      <div className="modal-box" style={{ width: '100%', maxWidth: '100%', boxShadow: 'none', position: 'relative' }}>
        <div className="modal-header">
          <span className="modal-title">LOADED_SCRIPT_PAYLOAD</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{script.length.toLocaleString()} CHARS</span>
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

      {isVercelBrowser() && !getTtsDirectUrl() && (
        <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.55, maxWidth: '760px' }}>
          POLLING MODE ACTIVE. The studio now starts a TTS job and polls for status instead of holding one long request open.
        </p>
      )}

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
                JOB STARTED. POLLING TTS STATUS UNTIL AUDIO IS READY...
              </span>
            </div>
          )}
        </div>
      )}

      {status === 'generating' && (
        <div className="stat-block outline" style={{ gap: '8px' }}>
          <span className="label">TTS_DIAGNOSTICS</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-core)' }}>REQUEST_ID // {requestId}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-core)' }}>JOB_ID // {jobId || 'pending'}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-core)' }}>LAST_EVENT // {lastEvent}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{statusDetail}</span>
        </div>
      )}

      {status === 'error' && (
        <div className="state-container error" style={{ borderColor: 'var(--brand-alert)' }}>
          <h3 style={{ color: 'var(--brand-alert)', fontSize: '1.25rem', marginBottom: '12px' }}>
            [ TTS_TRANSMISSION_FAILED ]
          </h3>
          <p style={{ marginBottom: '20px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>{errorMsg}</p>
          <p style={{ marginBottom: '20px', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
            REQUEST: {requestId || 'n/a'} {'//'} JOB: {jobId || 'n/a'} {'//'} LAST_EVENT: {lastEvent}
          </p>
          <button className="sys-btn error-btn" onClick={generateSpeech}>
            [ RETRY_TRANSMISSION ]
          </button>
        </div>
      )}

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
                NEURAL_VOICE_OUTPUT // READY
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div style={{ padding: '24px 24px 8px', display: 'flex', alignItems: 'center', gap: '3px', height: '72px' }}>
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
                          ? `rgba(204,255,0,${0.18 + (i % 5) * 0.01})`
                          : 'rgba(255,255,255,0.08)',
                      transition: 'background 0.15s ease',
                      borderRadius: '1px',
                      animation: isPlaying && isPast ? `tts-wave-${i % 4} 0.4s ease infinite alternate` : 'none',
                    }}
                  />
                );
              })}
            </div>

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

            <div style={{ padding: '20px 24px 24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
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
                {isPlaying ? 'PAUSE' : 'PLAY'}
              </button>

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
                STOP
              </button>

              <button
                className="sys-btn"
                onClick={toggleMute}
                style={{ padding: '10px 14px', fontSize: '1rem', minWidth: '44px' }}
              >
                {isMuted || volume === 0 ? 'MUTE' : 'VOL'}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={isMuted ? 0 : volume}
                onChange={handleVolume}
                style={{ width: '100px', accentColor: 'var(--brand-neon)', cursor: 'crosshair' }}
              />

              <div style={{ flex: 1 }} />

              <button
                className="sys-btn"
                onClick={() => {
                  generateLockRef.current = false;
                  activeRequestRef.current = null;
                  activeJobRef.current = null;
                  setStatus('idle');
                  setAudioUrl(null);
                  setServerAudioUrl(null);
                  setRequestId(null);
                  setJobId(null);
                  setLastEvent('idle');
                  setStatusDetail('');
                  onAudioGenerated?.(null);
                  onServerAudioGenerated?.(null);
                }}
                style={{ fontSize: '0.8rem' }}
              >
                [ RE-SYNTHESIZE ]
              </button>

              <button
                className="sys-btn"
                onClick={downloadWav}
                style={{ borderColor: 'var(--brand-neon)', color: 'var(--brand-neon)', fontSize: '0.8rem' }}
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
          to { transform: translateX(100%); }
        }
        @keyframes tts-wave-0 { to { transform: scaleY(1.3); } }
        @keyframes tts-wave-1 { to { transform: scaleY(1.5); } }
        @keyframes tts-wave-2 { to { transform: scaleY(1.2); } }
        @keyframes tts-wave-3 { to { transform: scaleY(1.4); } }
      `}</style>
    </div>
  );
}

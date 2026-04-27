'use client';

import { useState } from 'react';
import { fetchYouTubeTranscriptAction } from '../actions';

type YouTubeTabProps = {
  onTranscriptLoaded: (payload: { transcript: string; title: string; videoId: string }) => void;
};

export default function YouTubeTab({ onTranscriptLoaded }: YouTubeTabProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastLoaded, setLastLoaded] = useState<{ title: string; videoId: string } | null>(null);

  async function handleFetch() {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setLastLoaded(null);

    const result = await fetchYouTubeTranscriptAction(url.trim());
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setLastLoaded({ title: result.title, videoId: result.videoId });
    onTranscriptLoaded({
      transcript: result.transcript,
      title: result.title,
      videoId: result.videoId,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') void handleFetch();
  }

  return (
    <div className="modal-box" style={{ width: '100%', maxWidth: '100%', boxShadow: 'none' }}>
      <div className="modal-header">
        <span className="modal-title">YT_TRANSCRIPT_BYPASS</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: '12px' }}>
          SKIP NEWS SELECTION — PIPE YOUTUBE TRANSCRIPT DIRECTLY TO SCRIPT_GEN
        </span>
      </div>

      <div className="modal-body">
        {/* Instructions */}
        <div style={{
          background: 'rgba(0, 255, 204, 0.04)',
          border: '1px solid rgba(0, 255, 204, 0.2)',
          padding: '16px 20px',
          marginBottom: '28px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          color: 'var(--text-core)',
          lineHeight: '1.7',
        }}>
          <span style={{ color: 'var(--brand-neon)', fontWeight: 'bold' }}>[ BYPASS_MODE ]</span>
          {'  '}Paste any YouTube URL below. The transcript will be fetched and sent directly to the script generation engine.{' '}
          <br />
          Supported formats:{' '}
          <span style={{ color: '#aaa' }}>
            youtube.com/watch?v=ID · youtu.be/ID · youtube.com/shorts/ID
          </span>
        </div>

        {/* URL Input */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch', marginBottom: '20px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--brand-neon)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              pointerEvents: 'none',
              userSelect: 'none',
            }}>
              YT://
            </span>
            <input
              id="yt-url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://youtube.com/watch?v=..."
              disabled={loading}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid var(--text-core)',
                color: 'var(--text-bright)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                padding: '14px 16px 14px 58px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--brand-neon)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--text-core)')}
            />
          </div>
          <button
            id="yt-fetch-btn"
            className="sys-btn"
            onClick={() => void handleFetch()}
            disabled={loading || !url.trim()}
            style={{
              borderColor: loading ? 'var(--text-dim)' : 'var(--brand-neon)',
              color: loading ? 'var(--text-dim)' : 'var(--brand-neon)',
              minWidth: '180px',
              fontSize: '0.85rem',
              cursor: loading || !url.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '[ FETCHING... ]' : '[ FETCH_TRANSCRIPT ]'}
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ marginBottom: '20px' }}>
            <div className="loading-bar" />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-core)', marginTop: '8px' }}>
              ESTABLISHING LINK TO TRANSCRIPT NODE... DECODING SIGNAL...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{
            background: 'rgba(255, 51, 51, 0.08)',
            border: '1px solid var(--brand-alert)',
            padding: '16px 20px',
            marginBottom: '20px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
          }}>
            <span style={{ color: 'var(--brand-alert)', fontWeight: 'bold' }}>[ TRANSCRIPT_ERROR ]</span>
            <br />
            <span style={{ color: '#ccc', marginTop: '6px', display: 'block' }}>{error}</span>
          </div>
        )}

        {/* Success state */}
        {lastLoaded && (
          <div style={{
            background: 'rgba(0, 255, 204, 0.06)',
            border: '1px solid var(--brand-neon)',
            padding: '16px 20px',
            marginBottom: '20px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
          }}>
            <div style={{ color: 'var(--brand-neon)', fontWeight: 'bold', marginBottom: '8px' }}>
              [ TRANSCRIPT_LOADED ]
            </div>
            <div style={{ color: 'var(--text-bright)', marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-dim)' }}>TITLE: </span>
              {lastLoaded.title}
            </div>
            <div style={{ color: '#aaa', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>VIDEO_ID: </span>
              {lastLoaded.videoId}
            </div>
            <div style={{
              marginTop: '14px',
              padding: '10px 14px',
              background: 'rgba(0,255,204,0.04)',
              border: '1px dashed rgba(0,255,204,0.3)',
              color: 'var(--brand-neon)',
              fontSize: '0.8rem',
            }}>
              ▶ Transcript injected into pipeline. Navigate to{' '}
              <strong>SCRIPT_GEN</strong> to generate your script.
            </div>
          </div>
        )}

        {/* Quick-paste examples */}
        <div style={{
          marginTop: '32px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '20px',
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>
            QUICK_EXAMPLE_FORMAT:
          </div>
          {[
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'https://youtu.be/dQw4w9WgXcQ',
            'https://www.youtube.com/shorts/dQw4w9WgXcQ',
          ].map((ex) => (
            <button
              key={ex}
              onClick={() => setUrl(ex)}
              style={{
                display: 'block',
                background: 'none',
                border: 'none',
                color: 'rgba(0,255,204,0.5)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: '3px 0',
                textAlign: 'left',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--brand-neon)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(0,255,204,0.5)')}
            >
              → {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

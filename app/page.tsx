'use client';

import { useState, useEffect } from "react";
import { useShooAuth } from "@shoojs/react";
import { Article, fetchFeedsAction } from "./actions";
import NewsTab from "./components/NewsTab";
import ViralTab from "./components/ViralTab";
import ScriptTab from "./components/ScriptTab";
import TTSTab from "./components/TTSTab";

export default function Home() {
  const { identity, claims, loading: authLoading, signIn, clearIdentity } = useShooAuth();
  
  const [activeTab, setActiveTab] = useState<'news' | 'viral' | 'script' | 'tts'>('news');
  const [scriptSourceText, setScriptSourceText] = useState<string | null>(null);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [time, setTime] = useState('--:--:--');
  
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    // Clock
    const timer = setInterval(() => {
      setTime(new Date().toTimeString().split(' ')[0]);
    }, 1000);
    
    fetchLatestNews();

    return () => clearInterval(timer);
  }, []);

  async function fetchLatestNews() {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchFeedsAction();
      setArticles(data);
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  // To match the legacy brutalist design logic
  const latestArticle = articles.length > 0 ? articles[0] : null;
  let latestTimeStr = "----";
  
  if (latestArticle) {
    const pubDate = new Date(latestArticle.pubDate);
    const diffHours = Math.floor((new Date().getTime() - pubDate.getTime()) / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor((new Date().getTime() - pubDate.getTime()) / (1000 * 60));
      latestTimeStr = `-${diffMins}m`;
    } else if (diffHours < 24) {
      latestTimeStr = `-${diffHours}h`;
    } else {
      latestTimeStr = `-${Math.floor(diffHours / 24)}d`;
    }
  }

  if (!isDev && authLoading) {
    return (
      <div className="terminal-container">
        <div className="bg-grid"></div>
        <div className="state-container" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', border: '1px solid var(--brand-neon)', padding: '2rem' }}>
          <div className="loading-bar"></div>
          <p>AUTHENTICATING NEURAL LINK...</p>
        </div>
      </div>
    );
  }

  if (!isDev && !identity.userId) {
    return (
      <div className="terminal-container">
        <div className="bg-grid"></div>
        <div className="state-container" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', border: '1px solid var(--text-core)', padding: '2rem' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '16px', color: 'var(--brand-neon)' }}>[ SYSTEM_RESTRICTED ]</h3>
          <p style={{ marginBottom: '24px' }}>Please authenticate to access the raw feed matrix.</p>
          <button onClick={() => signIn({ requestPii: true })} className="sys-btn mt-4">
            [ SYSTEM_LOGIN ]
          </button>
        </div>
      </div>
    );
  }

  // Lock out unauthorized users if NEXT_PUBLIC_ALLOWED_EMAIL is set
  const allowedEmailsStr = process.env.NEXT_PUBLIC_ALLOWED_EMAILS;
  if (!isDev && allowedEmailsStr) {
    const allowedEmails = allowedEmailsStr.split(',').map(e => e.trim().toLowerCase());
    if (!claims?.email || !allowedEmails.includes(claims.email.toLowerCase())) {
      return (
        <div className="terminal-container">
          <div className="bg-grid"></div>
          <div className="state-container error" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', border: '1px solid var(--brand-alert)', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '16px', color: 'var(--brand-alert)' }}>[ UNAUTHORIZED_ACCESS ]</h3>
            <p style={{ marginBottom: '24px' }}>Identity {claims?.email || identity.userId} is not whitelisted.</p>
            <button onClick={clearIdentity} className="sys-btn error-btn mt-4">
              [ TERMINATE_SESSION ]
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="terminal-container">
      <div className="bg-grid"></div>

      <header className="masthead">
        <div className="logo-area">
          <div className="status-indicator"></div>
          <h1>AI_PULSE_DATA</h1>
          <span className="version-tag">NEXT // ARCH</span>
        </div>
        <div className="controls" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="data-readout">
            <span className="label">SYS.TIME</span>
            <span id="current-time">{time}</span>
          </div>
          <button onClick={fetchLatestNews} className="sys-btn">
            {loading ? '[ SYNCING... ]' : '[ REFRESH ]'}
          </button>
          <div style={{ marginLeft: '12px', borderLeft: '1px solid #333', paddingLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-core)' }}>
              IDENT: {claims?.email?.split('@')[0] || identity.userId?.substring(0, 8)}
            </span>
            <button onClick={clearIdentity} className="sys-btn" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
              [ LOGOUT ]
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="ticker-banner">
          <div className="stat-block">
            <span className="label">PACKETS_READ</span>
            <span className="value">{articles.length.toString().padStart(2, '0')}</span>
          </div>
          <div className="stat-block">
            <span className="label">LAST_SYNC</span>
            <span className="value">{latestTimeStr}</span>
          </div>
          <div className={`stat-block outline ${error ? 'border-red-500' : ''}`}>
            <span className="label">STATUS</span>
            <span className="value" style={{ color: error ? 'var(--brand-alert)' : (loading ? 'var(--text-core)' : 'var(--brand-neon)') }}>
              {error ? 'LINK_FAILED' : (loading ? 'RECEIVING_DATA' : 'STREAM_ACTIVE')}
            </span>
          </div>
        </section>

        <div className="feed-header custom-tabs" style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <button 
            onClick={() => setActiveTab('news')}
            className={`sys-btn tab-btn ${activeTab === 'news' ? 'active' : ''}`}
            style={{ fontSize: '1.25rem', borderBottomWidth: activeTab === 'news' ? '4px' : '1px' }}
          >
            &gt; RAW_FEED
          </button>
          
          <button 
            onClick={() => setActiveTab('viral')}
            className={`sys-btn tab-btn ${activeTab === 'viral' ? 'active' : ''}`}
            style={{ fontSize: '1.25rem', borderBottomWidth: activeTab === 'viral' ? '4px' : '1px' }}
          >
            &gt; VIRAL_DETECT
          </button>

          <button 
            onClick={() => setActiveTab('script')}
            className={`sys-btn tab-btn ${activeTab === 'script' ? 'active' : ''}`}
            style={{ fontSize: '1.25rem', borderBottomWidth: activeTab === 'script' ? '4px' : '1px' }}
          >
            &gt; SCRIPT_GEN
          </button>

          <button 
            onClick={() => setActiveTab('tts')}
            className={`sys-btn tab-btn ${activeTab === 'tts' ? 'active' : ''}`}
            style={{ fontSize: '1.25rem', borderBottomWidth: activeTab === 'tts' ? '4px' : '1px' }}
          >
            &gt; TTS_VOICE
          </button>
        </div>

        {error && (
          <div className="state-container error">
            <h3 style={{ color: 'var(--brand-alert)', fontSize: '1.5rem', marginBottom: '12px' }}>[ ERR_CONNECTION_REFUSED ]</h3>
            <p style={{ marginBottom: '24px' }}>Failed to establish link with rendering node.</p>
            <button onClick={fetchLatestNews} className="sys-btn error-btn">[ RETRY_CONNECTION ]</button>
          </div>
        )}

        {loading && articles.length === 0 && (
          <div className="state-container">
            <div className="loading-bar"></div>
            <p>Establishing connection to global matrix...</p>
          </div>
        )}

        {!loading && !error && activeTab === 'news' && (
          <NewsTab 
            articles={articles} 
            onArticleClick={(a) => {
              // Can pop up a classic modal here or open link directly
              window.open(a.link, '_blank');
            }} 
          />
        )}

        {!loading && !error && activeTab === 'viral' && (
          <ViralTab 
            articles={articles} 
            onTextLoaded={(text) => {
              setScriptSourceText(text);
            }} 
          />
        )}

        {!loading && !error && activeTab === 'script' && (
          <ScriptTab sourceText={scriptSourceText} onScriptGenerated={setGeneratedScript} />
        )}

        {activeTab === 'tts' && (
          <TTSTab script={generatedScript} />
        )}
      </main>
    </div>
  );
}

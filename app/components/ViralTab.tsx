'use client';

import { useState, useEffect } from 'react';
import { Article, pickViralArticleAction, fetchFullArticleAction } from '../actions';

export default function ViralTab({ articles, onTextLoaded }: { articles: Article[], onTextLoaded?: (text: string) => void }) {
  const [viralArticle, setViralArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fullHtml, setFullHtml] = useState<string | null>(null);
  const [fullText, setFullText] = useState<string | null>(null);

  useEffect(() => {
    async function loadViralNews() {
      if (!articles || articles.length === 0) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError('');
        const winner = await pickViralArticleAction(articles);
        if (winner) {
          setViralArticle(winner);
          
          // Phase 2: Fetch the complete article payload
          try {
            const fullNews = await fetchFullArticleAction(winner.link);
            if (fullNews && fullNews.content) {
              setFullHtml(fullNews.content);
              setFullText(fullNews.textContent);
              if (onTextLoaded) onTextLoaded(fullNews.textContent);
            } else {
              setFullHtml(winner.description); // fallback to excerpt
            }
          } catch (e) {
            setFullHtml(winner.description);
          }
        } else {
          setError('FAILED TO DETECT VIRAL NODE.');
        }
      } catch (e: any) {
        setError(e.message || 'API LINK FAILED');
      } finally {
        setLoading(false);
      }
    }
    loadViralNews();
  }, [articles]);

  if (loading) {
    return (
      <div className="state-container">
        <div className="loading-bar"></div>
        <p>SCANNING NEURAL LINK... DETECTING VIRAL PAYLOAD...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container error state-container">
        <h3>[ VIRAL_DETECTION_ERROR ]</h3>
        <p>{error}</p>
        <button className="sys-btn error-btn" onClick={() => window.location.reload()}>[ RETRY_SCAN ]</button>
      </div>
    );
  }

  if (!viralArticle) {
    return (
        <div className="state-container">
            <p>NO DATA TO ANALYZE</p>
        </div>
    )
  }

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium'
  }).format(new Date(viralArticle.pubDate));

  return (
    <div className="modal-box" style={{ width: '100%', maxWidth: '100%', boxShadow: 'none' }}>
      <div className="modal-header">
        <span className="modal-title">VIRAL_ARTICLE_DATA</span>
      </div>
      <div className="modal-body">
        <div style={{ marginBottom: '24px' }}>
          <span style={{ background: 'var(--brand-neon)', color: 'var(--bg-main)', padding: '4px 12px', fontWeight: 'bold' }}>
            [ VIRAL_DETECTED ]
          </span>
        </div>
        <h1>{viralArticle.title}</h1>
        <div className="modal-details">
          <span>SRC_NODE: <strong>{viralArticle.source}</strong></span>
          <span>TIMESTAMP: <strong>{formattedDate.toUpperCase()}</strong></span>
        </div>
        
        <div className="modal-content-html">
          {fullHtml ? (
            <div dangerouslySetInnerHTML={{ __html: fullHtml }} />
          ) : (
            <div className="state-container mt-4 mb-4">
              <div className="loading-bar"></div>
              <p>EXTRACTING RAW ARTICLE PAYLOAD...</p>
            </div>
          )}
        </div>
        
        
        <a href={viralArticle.link} target="_blank" rel="noopener noreferrer" className="out-link-btn flex inline-flex mt-8">
          [ INIT_HYPERLINK ]
        </a>
      </div>
    </div>
  );
}

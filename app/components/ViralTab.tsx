'use client';

import { useState, useEffect, useRef } from 'react';
import { Article, pickViralArticleAction, fetchFullArticleAction } from '../actions';
import { preferArxivHtmlUrl } from '../lib/arxivLinks';

type ViralTabProps = {
  articles: Article[];
  initialArticle?: Article | null;
  initialFullHtml?: string | null;
  initialFullText?: string | null;
  onViralLoaded?: (payload: { article: Article; fullHtml: string | null; fullText: string }) => void;
};

export default function ViralTab({
  articles,
  initialArticle = null,
  initialFullHtml = null,
  initialFullText = null,
  onViralLoaded,
}: ViralTabProps) {
  const [viralArticle, setViralArticle] = useState<Article | null>(initialArticle);
  const [loading, setLoading] = useState(!initialArticle);
  const [error, setError] = useState('');
  const [fullHtml, setFullHtml] = useState<string | null>(initialFullHtml);
  const [fullText, setFullText] = useState<string | null>(initialFullText);
  const pickStartedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFullForArticle(article: Article) {
      try {
        const fetchUrl = preferArxivHtmlUrl(article.link);
        const fullNews = await fetchFullArticleAction(fetchUrl);
        if (cancelled) return;
        if (fullNews && fullNews.content) {
          setFullHtml(fullNews.content);
          setFullText(fullNews.textContent);
          onViralLoaded?.({
            article,
            fullHtml: fullNews.content,
            fullText: fullNews.textContent,
          });
        } else {
          setFullHtml(article.description);
          setFullText(article.description);
          onViralLoaded?.({
            article,
            fullHtml: article.description,
            fullText: article.description,
          });
        }
      } catch {
        if (cancelled) return;
        setFullHtml(article.description);
        setFullText(article.description);
        onViralLoaded?.({
          article,
          fullHtml: article.description,
          fullText: article.description,
        });
      }
    }

    async function loadViralNews() {
      if (viralArticle && fullText) {
        setLoading(false);
        return;
      }
      if (!articles || articles.length === 0) {
        setLoading(false);
        return;
      }

      // Hydration / resume: already have a pick but not full body yet — fetch only (no LLM).
      if (viralArticle && !fullText) {
        setLoading(true);
        setError('');
        await loadFullForArticle(viralArticle);
        if (!cancelled) setLoading(false);
        return;
      }

      // Fresh pick
      if (!viralArticle) {
        if (pickStartedRef.current) {
          return;
        }
        let picked = false;
        try {
          pickStartedRef.current = true;
          setLoading(true);
          setError('');
          const winner = await pickViralArticleAction(articles);
          if (cancelled) return;
          if (winner) {
            picked = true;
            setViralArticle(winner);
            await loadFullForArticle(winner);
          } else {
            setError('FAILED TO DETECT VIRAL NODE.');
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'API LINK FAILED';
          setError(msg);
        } finally {
          if (!cancelled) setLoading(false);
          if (!cancelled && !picked) {
            pickStartedRef.current = false;
          }
        }
      }
    }

    void loadViralNews();
    return () => {
      cancelled = true;
    };
    // viralArticle is read inside but omitted on purpose: including it re-ran the effect after every pick and duplicated work.
    // Parent must pass a stable onViralLoaded (useCallback) so the clock tick does not retrigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, fullText]);

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
        
        
        <a href={preferArxivHtmlUrl(viralArticle.link)} target="_blank" rel="noopener noreferrer" className="out-link-btn flex inline-flex mt-8">
          [ INIT_HYPERLINK ]
        </a>
      </div>
    </div>
  );
}

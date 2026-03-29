'use client';

import { Article } from "../actions";

function getTimeAgo(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  
  if (interval > 1) return Math.floor(interval) + "y";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m";
  return Math.floor(seconds) + "s";
}

export default function NewsTab({ articles, onArticleClick }: { articles: Article[], onArticleClick: (a: Article) => void }) {
  if (!articles || articles.length === 0) {
    return (
      <div className="state-container" style={{ gridColumn: '1 / -1' }}>
        <p>DATA_STREAM_EMPTY</p>
      </div>
    );
  }

  return (
    <div className="news-grid">
      {articles.map((article, idx) => {
        // Strip out HTML to show a text preview
        const plainTextDesc = article.description.replace(/<[^>]+>/g, '');
        const timeAgo = getTimeAgo(new Date(article.pubDate));

        return (
          <div key={`${article.id}-${idx}`} className="article-card" onClick={() => onArticleClick(article)}>
            <div className="article-meta">
              <span className="src-tag">[ {article.source} ]</span>
              <span>T-{timeAgo.toUpperCase()}</span>
            </div>
            <h3>{article.title}</h3>
            <div className="article-preview">{plainTextDesc}</div>
            <div className="card-action">&gt; ACCESS_MEMO</div>
          </div>
        );
      })}
    </div>
  );
}

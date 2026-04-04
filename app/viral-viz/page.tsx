"use client";

import { useState } from "react";
import Link from "next/link";
import {
  fetchFeedsAction,
  previewViralPipelineAction,
  type ViralPipelinePreviewResult,
} from "../actions";

export default function ViralVizPage() {
  const [loading, setLoading] = useState(false);
  const [feedCount, setFeedCount] = useState<number | null>(null);
  const [preview, setPreview] = useState<ViralPipelinePreviewResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isProd =
    typeof process !== "undefined" && process.env.NODE_ENV === "production";

  async function loadFeed() {
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchFeedsAction();
      setFeedCount(data.length);
      const result = await previewViralPipelineAction(data);
      setPreview(result);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  if (isProd) {
    return (
      <div
        className="terminal-container"
        style={{ padding: "2rem", fontFamily: "var(--font-sys, monospace)" }}
      >
        <p>Pipeline visualizer is only available in development.</p>
        <Link href="/">← Back</Link>
      </div>
    );
  }

  return (
    <div
      className="terminal-container"
      style={{
        padding: "1.5rem",
        maxWidth: "1200px",
        margin: "0 auto",
        fontFamily: "var(--font-sys, monospace)",
        fontSize: "13px",
      }}
    >
      <header style={{ marginBottom: "1.5rem", borderBottom: "1px solid var(--brand-neon, #0f0)", paddingBottom: "12px" }}>
        <span
          style={{
            background: "var(--brand-alert, #f44)",
            color: "#000",
            padding: "2px 8px",
            fontWeight: 700,
            marginRight: "8px",
          }}
        >
          TEMP
        </span>
        <strong>VIRAL_PIPELINE_PRE_LLM</strong>
        <span style={{ opacity: 0.7, marginLeft: "12px" }}>
          embed → cluster → score → candidates (no chat model)
        </span>
        <div style={{ marginTop: "10px" }}>
          <Link href="/" style={{ color: "var(--brand-neon, #0f0)" }}>
            ← Studio home
          </Link>
        </div>
      </header>

      <button
        type="button"
        onClick={loadFeed}
        disabled={loading}
        style={{
          padding: "10px 16px",
          cursor: loading ? "wait" : "pointer",
          marginBottom: "1rem",
          border: "1px solid var(--brand-neon, #0f0)",
          background: "transparent",
          color: "inherit",
        }}
      >
        {loading ? "RUNNING…" : "Load RSS + run pipeline preview"}
      </button>

      {feedCount !== null && (
        <p style={{ marginBottom: "8px" }}>
          Articles in feed: <strong>{feedCount}</strong>
        </p>
      )}

      {err && (
        <pre
          style={{
            color: "var(--brand-alert, #f66)",
            whiteSpace: "pre-wrap",
            marginBottom: "1rem",
          }}
        >
          {err}
        </pre>
      )}

      {preview && preview.ok && preview.skippedEmbeddings && (
        <section style={{ marginTop: "1rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "8px" }}>No embeddings path</h2>
          <p style={{ opacity: 0.9 }}>{preview.reason}</p>
          <p>Article count: {preview.articleCount}</p>
          {preview.heuristicTop5.length > 0 && (
            <>
              <p style={{ marginTop: "8px" }}>
                Heuristic top {preview.heuristicTop5.length} (would go to LLM if this path):
              </p>
              <ol>
                {preview.heuristicTop5.map((row) => (
                  <li key={row.id} style={{ marginBottom: "6px" }}>
                    <strong>{row.title.slice(0, 120)}</strong>
                    <br />
                    <span style={{ opacity: 0.75 }}>
                      {row.source} · idx {row.idx}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

      {preview && preview.ok && !preview.skippedEmbeddings && (
        <section style={{ marginTop: "1rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "12px" }}>Timing</h2>
          <pre style={{ marginBottom: "1rem", opacity: 0.9 }}>
            embed: {preview.ms.embed} ms · cluster: {preview.ms.cluster} ms · total:{" "}
            {preview.ms.total} ms
          </pre>

          <h2 style={{ fontSize: "1rem", marginBottom: "8px" }}>Config</h2>
          <ul style={{ marginBottom: "1rem", lineHeight: 1.6 }}>
            <li>Articles: {preview.articleCount}</li>
            <li>Embedding dim: {preview.embeddingDim}</li>
            <li>
              Jina: {preview.jinaModel} / task {preview.jinaTask}
            </li>
            <li>Similarity threshold: {preview.threshold}</li>
            <li>Top clusters merged for LLM: {preview.topClustersForLlm}</li>
            <li>
              Cluster score: uniqueSources (HF papers↔arxiv normalized) × recency (3/2/1 if newest
              in &lt;24h / &lt;48h / &lt;72h; else 0). Half-life below is only for heuristic fallback.
            </li>
            <li>Recency half-life (h, fallback only): {preview.recencyHalfLifeHours}</li>
            <li>Embed title + description: {preview.useDescription ? "yes" : "no (title-only)"}</li>
            <li>
              Clusters: {preview.clusterCount} ({preview.singletonClusters} singletons,{" "}
              {preview.multiMemberClusters} multi-member)
            </li>
            <li>All singletons: {preview.allSingletons ? "yes" : "no"}</li>
            <li>
              Selection: <strong>{preview.selectionMode}</strong> · LLM candidate count:{" "}
              {preview.llmCandidateCount}
            </li>
          </ul>

          <p style={{ marginBottom: "8px", opacity: 0.85 }}>
            First embed string (truncated):{" "}
            <code style={{ wordBreak: "break-all" }}>{preview.embedTextSampleFirst}</code>
          </p>

          <h2 style={{ fontSize: "1rem", margin: "1rem 0 8px" }}>
            Clusters (top {preview.clustersRanked.length} by score)
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {preview.clustersRanked.map((c) => (
              <div
                key={c.rank + "-" + c.memberIndices[0]}
                style={{
                  border: c.inTopClusterBatch ? "2px solid var(--brand-neon, #0f0)" : "1px solid #444",
                  padding: "10px",
                  background: c.inTopClusterBatch ? "rgba(0,255,100,0.06)" : "transparent",
                }}
              >
                <div style={{ marginBottom: "6px" }}>
                  <strong>#{c.rank}</strong> size {c.size} · score {c.score.toFixed(4)} · sources{" "}
                  {c.uniqueSources} · max pub {c.maxPubDate}
                  {c.inTopClusterBatch && (
                    <span style={{ color: "var(--brand-neon, #0f0)", marginLeft: "8px" }}>
                      ← TOP BATCH (up to {preview.topClustersForLlm} clusters → LLM pool)
                    </span>
                  )}
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                  {c.membersPreview.map((m) => (
                    <li key={m.idx} style={{ marginBottom: "4px" }}>
                      <span style={{ opacity: 0.6 }}>[{m.idx}]</span> {m.title}
                      <div style={{ opacity: 0.55, fontSize: "11px" }}>
                        {m.source} · {m.pubDate}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: "1rem", margin: "1.25rem 0 8px" }}>
            LLM candidates (lines before JSON instruction — URL + title + domain + relative time)
          </h2>
          <p style={{ opacity: 0.8, marginBottom: "8px" }}>
            Indices: [{preview.candidateIndices.join(", ")}]
          </p>
          <ol>
            {preview.llmCandidatesPreview.map((a) => (
              <li key={a.id} style={{ marginBottom: "10px" }}>
                <strong>URL:</strong> <code style={{ wordBreak: "break-all" }}>{a.link}</code>
                <br />
                <strong>Title:</strong> {a.title}
                <br />
                <strong>Source:</strong> {a.source}
              </li>
            ))}
          </ol>
        </section>
      )}

      {preview && !preview.ok && (
        <pre style={{ color: "var(--brand-alert, #f66)" }}>{preview.error}</pre>
      )}
    </div>
  );
}

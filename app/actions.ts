'use server';

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { buildEmbedText, embedTextsJina } from './lib/jinaEmbed';
import {
  clusterByThreshold,
  maxPubDateMs,
  normalizeSourceKey,
  pickLlmCandidateIndices,
  scoreClusterViral,
  topArticlesByHeuristic,
  type ArticleLike,
} from './lib/viralCluster';

export interface Article {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
}

/** Dev-only: what the viral pipeline does before any LLM call (see /viral-viz). */
export type ViralPipelinePreviewResult =
  | {
      ok: true;
      skippedEmbeddings: false;
      articleCount: number;
      embeddingDim: number;
      jinaModel: string;
      jinaTask: string;
      threshold: number;
      topClustersForLlm: number;
      recencyHalfLifeHours: number;
      useDescription: boolean;
      ms: { embed: number; cluster: number; total: number };
      clusterCount: number;
      singletonClusters: number;
      multiMemberClusters: number;
      allSingletons: boolean;
      selectionMode: 'top_clusters_v2' | 'heuristic_fallback';
      clustersRanked: Array<{
        rank: number;
        size: number;
        score: number;
        uniqueSources: number;
        maxPubDate: string;
        inTopClusterBatch: boolean;
        memberIndices: number[];
        membersPreview: Array<{
          idx: number;
          title: string;
          source: string;
          pubDate: string;
        }>;
      }>;
      llmCandidateCount: number;
      candidateIndices: number[];
      llmCandidatesPreview: Array<{
        id: string;
        link: string;
        title: string;
        source: string;
        pubDate: string;
      }>;
      embedTextSampleFirst: string;
    }
  | {
      ok: true;
      skippedEmbeddings: true;
      reason: string;
      articleCount: number;
      fallbackTopN: number;
      heuristicTop5: Array<{
        idx: number;
        id: string;
        title: string;
        source: string;
        pubDate: string;
      }>;
    }
  | { ok: false; error: string; code: 'production' | 'embed_failed' };

const RSS_URL = "https://rss-feed-aggrigator.onrender.com/rss";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

// Helper strictly for server side
function extractSource(link: string): string {
  try {
    if (link && link !== "#") {
      const url = new URL(link);
      return url.hostname.replace('www.', '').toUpperCase();
    }
  } catch {
    // ignore
  }
  return "UNKNOWN_NODE";
}

/** Strip optional CDATA wrapper from a single tag body. */
function stripCdataInner(s: string): string {
  const m = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return m ? m[1].trim() : s.trim();
}

/**
 * Best-effort RSS/Atom date from an <item> block.
 * Tries pubDate (incl. CDATA), dc:date, updated.
 */
function extractPubDateRawFromItem(item: string): string | null {
  const patterns: RegExp[] = [
    /<pubDate>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/pubDate>/i,
    /<pubDate>([\s\S]*?)<\/pubDate>/i,
    /<dc:date>([\s\S]*?)<\/dc:date>/i,
    /<(?:atom:)?updated>([\s\S]*?)<\/(?:atom:)?updated>/i,
  ];
  for (const p of patterns) {
    const m = item.match(p);
    if (m?.[1]) {
      const inner = stripCdataInner(m[1]);
      if (inner) return inner;
    }
  }
  return null;
}

function parseRssDateToIso(raw: string): string | null {
  const cleaned = stripCdataInner(raw);
  const d = new Date(cleaned);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function extractCompletionText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const root = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = root.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

async function requestOpenRouter(messages: ChatMessage[], temperature: number): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OpenRouter API Key is missing in env");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "stepfun/step-3.5-flash:free",
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OPENROUTER_ERROR ${response.status}: ${text || response.statusText}`);
  }

  return extractCompletionText(await response.json());
}

async function requestNvidia(messages: ChatMessage[], temperature: number): Promise<string> {
  const apiKey = process.env.Nvidia_API_KEY || process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA API key missing (Nvidia_API_KEY)");
  }

  const response = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "stepfun-ai/step-3.5-flash",
      messages,
      temperature,
      top_p: 0.9,
      max_tokens: 16384,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NVIDIA_ERROR ${response.status}: ${text || response.statusText}`);
  }

  return extractCompletionText(await response.json());
}

/**
 * Chat completion: default OpenRouter → NVIDIA on failure.
 * Set CHAT_PREFER_NVIDIA=1 (or true) to call NVIDIA first and avoid free-tier OpenRouter 429s / extra latency.
 */
async function chatWithFallback(messages: ChatMessage[], temperature: number): Promise<string> {
  const preferNvidia =
    process.env.CHAT_PREFER_NVIDIA === "1" ||
    process.env.CHAT_PREFER_NVIDIA?.toLowerCase() === "true";

  if (preferNvidia) {
    try {
      return await requestNvidia(messages, temperature);
    } catch (nvidiaError) {
      console.warn("NVIDIA chat failed, retrying with OpenRouter:", nvidiaError);
      return await requestOpenRouter(messages, temperature);
    }
  }

  try {
    return await requestOpenRouter(messages, temperature);
  } catch (openRouterError) {
    console.warn("OpenRouter failed, retrying with NVIDIA provider:", openRouterError);
    return await requestNvidia(messages, temperature);
  }
}

function envNum(name: string, defaultVal: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return defaultVal;
  const n = Number(v);
  return Number.isFinite(n) ? n : defaultVal;
}

function envBool(name: string, defaultVal: boolean): boolean {
  const v = process.env[name]?.toLowerCase();
  if (v === undefined || v === "") return defaultVal;
  return v === "1" || v === "true" || v === "yes";
}

/** Fisher–Yates shuffle (returns a new array). */
function shuffleArray<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

function formatRelativeAgo(pubDate: string, nowMs: number): string {
  const h = (nowMs - new Date(pubDate).getTime()) / (1000 * 3600);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 72) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function resolveArticleByUrl(candidates: Article[], url: string): Article | undefined {
  const u = url.trim();
  const exact = candidates.find((a) => a.link === u);
  if (exact) return exact;
  return candidates.find(
    (a) =>
      (u.length > 0 && (u.includes(a.link) || a.link.includes(u))) || a.id === u
  );
}

function parseWinnerFromLlmResponse(content: string, candidates: Article[]): Article | null {
  const trimmed = content.trim();
  const jsonBlock = trimmed.match(/\{[\s\S]*\}/);
  if (jsonBlock) {
    try {
      const j = JSON.parse(jsonBlock[0]) as {
        winner_url?: string;
        url?: string;
        winner_index?: number | string;
        article?: number | string;
      };
      const url = j.winner_url?.trim();
      if (url) {
        const hit = resolveArticleByUrl(candidates, url);
        if (hit) return hit;
      }
      const altUrl = typeof j.url === "string" ? j.url.trim() : "";
      if (altUrl) {
        const hit = resolveArticleByUrl(candidates, altUrl);
        if (hit) return hit;
      }
      const rawIndex = j.winner_index ?? j.article;
      const parsedIndex =
        typeof rawIndex === "number"
          ? rawIndex
          : typeof rawIndex === "string"
            ? Number.parseInt(rawIndex, 10)
            : Number.NaN;
      if (Number.isFinite(parsedIndex)) {
        const idx = parsedIndex - 1;
        if (idx >= 0 && idx < candidates.length) {
          return candidates[idx] ?? null;
        }
      }
    } catch {
      // ignore
    }
  }

  const numbered = trimmed.match(/article\s*(\d{1,3})/i);
  if (numbered) {
    const idx = Number.parseInt(numbered[1] || "", 10) - 1;
    if (idx >= 0 && idx < candidates.length) {
      return candidates[idx] ?? null;
    }
  }

  const inlineUrl = trimmed.match(/https?:\/\/\S+/i)?.[0];
  if (inlineUrl) {
    const hit = resolveArticleByUrl(candidates, inlineUrl);
    if (hit) return hit;
  }

  return null;
}

/** Fallback path: larger list when embeddings unavailable — same JSON shape as main path. */
async function llmPickFromArticleLines(articles: Article[]): Promise<Article | null> {
  if (articles.length === 0) return null;
  const nowMs = Date.now();
  const lines = articles.map(
    (a, i) =>
      `Article ${i + 1}: "${a.title.replace(/"/g, '\\"')}" — ${normalizeSourceKey(a.link)} — ${formatRelativeAgo(a.pubDate, nowMs)}`
  );
  const promptText = `${lines.join("\n")}

Which single article best represents today's most viral AI story?
Return ONLY valid JSON in one of these forms:
{"winner_url":"<exact article URL from the list>","reason":"<one sentence>"}
or
{"winner_index":<article number from list>,"reason":"<one sentence>"}`;

  const content = await chatWithFallback([{ role: "user", content: promptText }], 0.5);
  return parseWinnerFromLlmResponse(content, articles);
}

/** Candidates already ranked / deduped — compact lines + JSON winner_url. */
async function llmPickFromCandidates(
  candidates: Article[],
  nowMs: number
): Promise<Article | null> {
  if (candidates.length === 0) return null;
  const lines = candidates.map(
    (a, i) =>
      `Article ${i + 1}: "${a.title.replace(/"/g, '\\"')}" — ${normalizeSourceKey(a.link)} — ${formatRelativeAgo(a.pubDate, nowMs)}`
  );
  const promptText = `${lines.join("\n")}

Which single article best represents today's most viral AI story?
Return ONLY valid JSON in one of these forms:
{"winner_url":"<exact article URL from the list>","reason":"<one sentence>"}
or
{"winner_index":<article number from list>,"reason":"<one sentence>"}`;

  const content = await chatWithFallback([{ role: "user", content: promptText }], 0.5);
  return parseWinnerFromLlmResponse(content, candidates);
}

export async function fetchFeedsAction(): Promise<Article[]> {
  try {
    const res = await fetch(RSS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Fetch failed");
    
    const xmlText = await res.text();
    // Since DOMParser is not available in Node, we will use a raw regex/string split approach
    // or we'd need a package like rss-parser. 
    // For a lightweight approach without installing packages, regex works for this exact feed structure.
    
    const items = xmlText.split("<item>").slice(1);
    let missingPubDateCount = 0;
    const articles: Article[] = items.map((item, index) => {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
      const title = titleMatch ? titleMatch[1] : "UNTITLED_RECORD";
      
      const linkMatch = item.match(/<link>(.*?)<\/link>/);
      const link = linkMatch ? linkMatch[1] : "#";
      
      const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || item.match(/<description>([\s\S]*?)<\/description>/);
      const description = descMatch ? descMatch[1] : "ERR_NO_DATA";
      
      const rawDate = extractPubDateRawFromItem(item);
      let pubDateIso: string;
      if (rawDate) {
        const parsed = parseRssDateToIso(rawDate);
        pubDateIso = parsed ?? new Date().toISOString();
        if (!parsed) missingPubDateCount++;
      } else {
        missingPubDateCount++;
        pubDateIso = new Date().toISOString();
      }
      
      const guidMatch = item.match(/<guid(?:[^>]*)>(.*?)<\/guid>/);
      const guid = guidMatch ? guidMatch[1] : String(index);

      return {
        id: guid,
        title,
        link,
        description,
        pubDate: pubDateIso,
        source: extractSource(link)
      };
    });

    if (missingPubDateCount > 0 && process.env.NODE_ENV === "development") {
      console.warn(
        `[fetchFeedsAction] ${missingPubDateCount} item(s) had missing/unparseable pubDate — using fetch time. Check RSS <pubDate> / dc:date.`
      );
    }

    // Sort descending
    articles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    
    return articles;
  } catch (e) {
    console.error("RSS fetch error", e);
    return [];
  }
}

export async function pickViralArticleAction(articles: Article[]): Promise<Article | null> {
  if (!articles || articles.length === 0) return null;

  const nowMs = Date.now();
  /** Newest-first RSS order: take head, shuffle before LLM to reduce position bias. */
  const poolSize = Math.max(1, Math.floor(envNum("VIRAL_LLM_POOL_SIZE", 30)));
  const fallbackTopN = Math.max(1, Math.floor(envNum("VIRAL_FALLBACK_TOP_N", 100)));

  const pool = articles.slice(0, Math.min(poolSize, articles.length));
  const shuffled = shuffleArray(pool);
  const heuristicPool = topArticlesByHeuristic(pool as ArticleLike[], nowMs, 72, 1)
    .map((idx) => pool[idx])
    .filter(Boolean);

  try {
    const winner = await llmPickFromCandidates(shuffled, nowMs);
    return winner || heuristicPool[0] || shuffled[0] || null;
  } catch (err) {
    console.error("Viral LLM error; falling back to larger shuffled slice:", err);
    const fb = articles.slice(0, Math.min(fallbackTopN, articles.length));
    const llmFallback = await llmPickFromArticleLines(shuffleArray(fb));
    if (llmFallback) return llmFallback;
    const heuristicFallback = topArticlesByHeuristic(fb as ArticleLike[], nowMs, 72, 1)
      .map((idx) => fb[idx])
      .filter(Boolean)[0];
    return heuristicFallback || fb[0] || null;
  }
}

function clusterKey(indices: number[]): string {
  return [...indices].sort((a, b) => a - b).join(",");
}

/**
 * TEMP / dev: run Jina embed + clustering + candidate pick — no LLM. Use /viral-viz to inspect.
 * Disabled in production builds.
 */
export async function previewViralPipelineAction(
  articles: Article[]
): Promise<ViralPipelinePreviewResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "Pipeline preview is disabled in production.", code: "production" };
  }

  if (!articles || articles.length === 0) {
    return {
      ok: true,
      skippedEmbeddings: true,
      reason: "No articles passed in.",
      articleCount: 0,
      fallbackTopN: 0,
      heuristicTop5: [],
    };
  }

  const nowMs = Date.now();
  const threshold = envNum("VIRAL_SIM_THRESHOLD", 0.82);
  const halfLife = envNum("VIRAL_RECENCY_HALF_LIFE_HOURS", 72);
  const topClustersForLlm = Math.max(1, Math.floor(envNum("VIRAL_TOP_CLUSTERS", 5)));
  const useDescription = envBool("VIRAL_EMBED_USE_DESCRIPTION", false);
  const fallbackTopN = Math.max(1, Math.floor(envNum("VIRAL_FALLBACK_TOP_N", 100)));
  const jinaKey = process.env.JINA_API_KEY?.trim();
  const jinaModelOpt = process.env.JINA_EMBED_MODEL?.trim();
  const jinaTaskOpt = process.env.JINA_EMBED_TASK?.trim();
  const jinaModelDisplay = jinaModelOpt || "jina-embeddings-v5-text-small";
  const jinaTaskDisplay = jinaTaskOpt || "retrieval.query";
  const jinaChunk = Math.max(1, Math.floor(envNum("JINA_EMBED_CHUNK_SIZE", 64)));

  const asLike = articles as ArticleLike[];

  if (!jinaKey) {
    const idxs = topArticlesByHeuristic(asLike, nowMs, halfLife, 5);
    return {
      ok: true,
      skippedEmbeddings: true,
      reason: "JINA_API_KEY missing — real pipeline would fall back to top " + fallbackTopN + " by recency for LLM.",
      articleCount: articles.length,
      fallbackTopN,
      heuristicTop5: idxs.map((idx) => ({
        idx,
        id: articles[idx].id,
        title: articles[idx].title,
        source: articles[idx].source,
        pubDate: articles[idx].pubDate,
      })),
    };
  }

  const t0 = Date.now();
  try {
    const texts = articles.map((a) =>
      buildEmbedText(a.title, a.description, useDescription)
    );
    const tEmbedStart = Date.now();
    const embeddings = await embedTextsJina(texts, {
      apiKey: jinaKey,
      ...(jinaModelOpt ? { model: jinaModelOpt } : {}),
      ...(jinaTaskOpt ? { task: jinaTaskOpt } : {}),
      chunkSize: jinaChunk,
    });
    const embedMs = Date.now() - tEmbedStart;

    const tClusterStart = Date.now();
    const clusters = clusterByThreshold(embeddings, threshold);
    const clusterMs = Date.now() - tClusterStart;

    let candidateIndices = pickLlmCandidateIndices(
      clusters,
      asLike,
      nowMs,
      topClustersForLlm
    );
    let usedHeuristic = false;
    if (candidateIndices.length === 0) {
      candidateIndices = topArticlesByHeuristic(asLike, nowMs, halfLife, 15);
      usedHeuristic = true;
    }

    const singletonClusters = clusters.filter((c) => c.length === 1).length;
    const multiMemberClusters = clusters.length - singletonClusters;

    const scoredClusters = clusters.map((memberIndices) => ({
      memberIndices,
      score: scoreClusterViral(memberIndices, asLike, nowMs),
    }));
    scoredClusters.sort(
      (a, b) =>
        b.score - a.score ||
        b.memberIndices.length - a.memberIndices.length ||
        maxPubDateMs(b.memberIndices, asLike) - maxPubDateMs(a.memberIndices, asLike)
    );

    const topBatchKeys = new Set(
      scoredClusters
        .filter((r) => r.score > 0)
        .slice(0, topClustersForLlm)
        .map((r) => clusterKey(r.memberIndices))
    );

    const previewLimit = 40;
    const clustersRanked = scoredClusters.slice(0, previewLimit).map((row, rank) => {
      const memberIndices = row.memberIndices;
      const maxPub = maxPubDateMs(memberIndices, asLike);
      const uniqueSources = new Set(
        memberIndices.map((i) => normalizeSourceKey(asLike[i].link))
      ).size;
      const previewN = Math.min(12, memberIndices.length);
      const sortedByDate = [...memberIndices].sort(
        (i, j) =>
          new Date(asLike[j].pubDate).getTime() - new Date(asLike[i].pubDate).getTime()
      );
      return {
        rank: rank + 1,
        size: memberIndices.length,
        score: row.score,
        uniqueSources,
        maxPubDate: new Date(maxPub).toISOString(),
        inTopClusterBatch: topBatchKeys.has(clusterKey(memberIndices)),
        memberIndices,
        membersPreview: sortedByDate.slice(0, previewN).map((idx) => ({
          idx,
          title: articles[idx].title.slice(0, 200),
          source: articles[idx].source,
          pubDate: articles[idx].pubDate,
        })),
      };
    });

    const llmCandidatesPreview = candidateIndices.map((i) => ({
      id: articles[i].id,
      link: articles[i].link,
      title: articles[i].title,
      source: articles[i].source,
      pubDate: articles[i].pubDate,
    }));

    return {
      ok: true,
      skippedEmbeddings: false,
      articleCount: articles.length,
      embeddingDim: embeddings[0]?.length ?? 0,
      jinaModel: jinaModelDisplay,
      jinaTask: jinaTaskDisplay,
      threshold,
      topClustersForLlm,
      recencyHalfLifeHours: halfLife,
      useDescription,
      ms: { embed: embedMs, cluster: clusterMs, total: Date.now() - t0 },
      clusterCount: clusters.length,
      singletonClusters,
      multiMemberClusters,
      allSingletons: clusters.every((c) => c.length === 1),
      selectionMode: usedHeuristic ? "heuristic_fallback" : "top_clusters_v2",
      clustersRanked,
      llmCandidateCount: candidateIndices.length,
      candidateIndices,
      llmCandidatesPreview,
      embedTextSampleFirst: texts[0]?.slice(0, 280) ?? "",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, code: "embed_failed" };
  }
}

export async function fetchFullArticleAction(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1 Googlebot/2.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const doc = new JSDOM(html, { url });
    
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    return article ? article : null;
  } catch (e: unknown) {
    console.error("Failed to fetch full article", e);
    return null;
  }
}

/**
 * Extracts a YouTube video ID from any common YouTube URL format.
 * Handles: youtu.be/<id>, youtube.com/watch?v=<id>, youtube.com/shorts/<id>, etc.
 */
function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    // youtu.be/<id>
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return id && id.length === 11 ? id : null;
    }
    // youtube.com/watch?v=<id>
    const v = u.searchParams.get('v');
    if (v && v.length === 11) return v;
    // youtube.com/shorts/<id> or /embed/<id>
    const pathParts = u.pathname.split('/').filter(Boolean);
    const idx = pathParts.findIndex(p => p === 'shorts' || p === 'embed' || p === 'v');
    if (idx !== -1 && pathParts[idx + 1]?.length === 11) return pathParts[idx + 1];
  } catch {
    // bare video ID passed directly
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  }
  return null;
}

export async function fetchYouTubeTranscriptAction(
  youtubeUrl: string
): Promise<{ ok: true; transcript: string; title: string; videoId: string } | { ok: false; error: string }> {
  const apiKey = process.env.YOUTUBE_TRANSCRIPT_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'YOUTUBE_TRANSCRIPT_API_KEY is not configured in .env' };
  }

  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) {
    return { ok: false, error: `Could not extract a valid YouTube video ID from: ${youtubeUrl}` };
  }

  try {
    const response = await fetch('https://www.youtube-transcript.io/api/transcripts', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: [videoId] }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `Transcript API error ${response.status}: ${errText || response.statusText}` };
    }

    // The API returns an array; each element has a `text` field (full transcript)
    // and optionally a `title`.
    const data = await response.json() as Array<{
      id?: string;
      text?: string;
      title?: string;
      tracks?: Array<{ transcript?: Array<{ text?: string }> }>;
    }>;

    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry) {
      return { ok: false, error: 'No transcript data returned by API.' };
    }

    // Prefer the top-level `text` field (full concatenated transcript)
    let transcript = typeof entry.text === 'string' ? entry.text.trim() : '';

    // Fallback: stitch together tracks[0].transcript[*].text
    if (!transcript && Array.isArray(entry.tracks) && entry.tracks[0]?.transcript) {
      transcript = entry.tracks[0].transcript
        .map((seg) => seg.text ?? '')
        .join(' ')
        .trim();
    }

    if (!transcript) {
      return { ok: false, error: 'Transcript is empty or unavailable for this video.' };
    }

    const title = typeof entry.title === 'string' ? entry.title : `YouTube Video ${videoId}`;
    return { ok: true, transcript, title, videoId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Network error fetching transcript: ${msg}` };
  }
}

export async function generateScriptAction(articleText: string): Promise<string | null> {
  try {
    const systemPrompt = `You are a script writer for a short-form AI and tech news channel. Scripts are published as 60-second vertical videos for Instagram Reels and YouTube Shorts.

## Voice & Persona
Write as a sharp, opinionated tech insider — not a journalist neutrally reporting facts, but a practitioner with a real point of view. The audience is curious, ambitious, and plugged into the AI/startup world. Speak to them as peers, not students. Confident. Occasionally personal. Never preachy.

## Script Structure
1. **Hook** (1–2 sentences): Open with a named person, company, model, or product that just did something notable. Create immediate "wait, what?" energy. Never open with context-setting or "in this video."
2. **The What** (3–5 sentences): Explain what actually happened. Ground it in specifics — model names, dollar figures, parameter counts, product features, company names. Make the unfamiliar feel real.
3. **The Pivot** (1–2 sentences): Reframe with a "but here's the thing" turn. Signal that the obvious read isn't the whole story. Use transitions like: "But that's not even the impressive part", "Here's the twist", "And here's where it gets interesting", "Which does make you wonder."
4. **The Real Takeaway** (2–4 sentences): Deliver the actual insight — what this signals, what it means for the audience, what to do or think about it. This is where your opinion lives. Be direct. No hedging.
5. **Close** (1 sentence, optional): A call to action, a provocative lingering thought, or a personal stake. Never summarize what you just said.

## Style Rules
- **Rhythm**: Alternate short punchy sentences with longer explanatory ones. Never stack more than 2 long sentences in a row.
- **Concrete always**: Replace every vague claim with a number, name, or specific detail. "A lot of data" → "thousands of data points, every single minute."
- **The ellipsis pause**: Use "..." once per script for a single dramatic beat on the most surprising claim.
- **Contrast pairs**: Frame insights as contrasts — who wins vs. who loses, what's obvious vs. what's real, hype vs. reality.
- **Personal inserts**: At least one first-person opinion or presence. ("Here's what I actually think", "I'll see you there", "Which does make you wonder.")
- **Parenthetical nuance**: Use (parentheses) to add a quick aside without breaking pace.
- **No filler**: Cut "basically", "essentially", "it's worth noting", and all throat-clearing openers.
- **Exclamation marks**: Maximum one per script. Only when the energy genuinely demands it.
- **Word count**: 150–200 words. Every sentence earns its place.

## Tone Calibration by Story Type
- **Model/product launch**: Lead with capability, ground in specs, end with what it means for regular people or builders.
- **Industry news** (funding, acquisitions, policy): Lead with the surprising fact, explain the "why now", end with the signal it sends.
- **Jobs/society/AI impact**: Lead with the provocative claim, add nuance, end with a practical or philosophical reframe — never doomer, never naive.
- **Startup/founder stories**: Lead with the product or traction number, tell the "weird idea that works" arc, end with the larger pattern it represents.

## Hard Rules
- No generic AI hype words: "revolutionary", "game-changing", "groundbreaking", "the future is here"
- No passive voice
- No ending on a throwaway rhetorical question
- No summarizing the script in the final line
- Do not start consecutive sentences with the same word
- Plain prose only — no headers, bullets, or stage directions
- Write exactly as it will be spoken aloud
- OUTPUT ONLY THE SCRIPT TEXT. Do not include any introductory text, concluding text, markdown formatting, or explanations. Just the raw script.`;

    return await chatWithFallback(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Write a 60-second video script based on the following article: \n\n${articleText}` },
      ],
      0.7
    );
  } catch (err) {
    console.error("Script generation error:", err);
    throw err;
  }
}

/**
 * Semantic clustering for viral article pre-selection (union-find on cosine threshold).
 * Embeddings must be L2-normalized so cosine similarity = dot product.
 */

export function l2Normalize(values: number[]): number[] {
  let sumSq = 0;
  for (let i = 0; i < values.length; i++) sumSq += values[i] * values[i];
  const n = Math.sqrt(sumSq);
  if (n === 0) return values.slice();
  const out = new Array<number>(values.length);
  for (let i = 0; i < values.length; i++) out[i] = values[i] / n;
  return out;
}

/** Dot product (cosine if vectors are L2-normalized). */
export function dotProduct(a: number[], b: number[]): number {
  let s = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

export class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }

  find(i: number): number {
    if (this.parent[i] !== i) this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }

  union(a: number, b: number): void {
    let ra = this.find(a);
    let rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    if (this.rank[ra] === this.rank[rb]) this.rank[ra]++;
  }

  /** cluster root -> member indices */
  components(): Map<number, number[]> {
    const map = new Map<number, number[]>();
    for (let i = 0; i < this.parent.length; i++) {
      const r = this.find(i);
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(i);
    }
    return map;
  }
}

/**
 * Build clusters: connect i,j when similarity >= threshold (embeddings must be normalized).
 */
export function clusterByThreshold(
  embeddings: number[][],
  threshold: number
): number[][] {
  const n = embeddings.length;
  const uf = new UnionFind(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (dotProduct(embeddings[i], embeddings[j]) >= threshold) {
        uf.union(i, j);
      }
    }
  }
  return [...uf.components().values()];
}

export function hoursSince(isoDate: string, nowMs: number): number {
  const t = new Date(isoDate).getTime();
  return (nowMs - t) / (1000 * 60 * 60);
}

/** exp decay: newer => larger boost. Uses hours since newest article in set. */
export function recencyBoostFromNewestHours(hoursSinceNewest: number, halfLifeHours: number): number {
  if (hoursSinceNewest < 0) return 1;
  return Math.exp(-(Math.log(2) * hoursSinceNewest) / halfLifeHours);
}

export type ArticleLike = {
  id: string;
  title: string;
  source: string;
  pubDate: string;
  link: string;
};

/**
 * Normalize host for viral scoring: HF papers mirror arXiv → same bucket as arxiv.org.
 */
export function normalizeSourceKey(link: string): string {
  if (!link || link === "#") return "unknown";
  if (link.includes("huggingface.co/papers")) {
    return "arxiv.org";
  }
  try {
    const u = new URL(link);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "unknown";
  }
}

/**
 * Viral cluster score (3 signals): uniqueSources≥2, recency buckets (<72h), score = uniqueSources × recencyScore.
 * Single-source or older than 72h → 0.
 */
export function scoreClusterViral(memberIndices: number[], articles: ArticleLike[], nowMs: number): number {
  if (memberIndices.length === 0) return 0;

  const uniqueSources = new Set(
    memberIndices.map((i) => normalizeSourceKey(articles[i].link))
  ).size;
  if (uniqueSources < 2) return 0;

  let newestPub = 0;
  for (const i of memberIndices) {
    newestPub = Math.max(newestPub, new Date(articles[i].pubDate).getTime());
  }
  const ageInHours = (nowMs - newestPub) / (1000 * 3600);
  let recencyScore = 0;
  if (ageInHours < 24) recencyScore = 3;
  else if (ageInHours < 48) recencyScore = 2;
  else if (ageInHours < 72) recencyScore = 1;
  else recencyScore = 0;
  if (recencyScore === 0) return 0;

  return uniqueSources * recencyScore;
}

/**
 * Top-N clusters by scoreClusterViral; from each cluster, newest-first, one article per normalizeSourceKey.
 */
export function pickLlmCandidateIndices(
  clusters: number[][],
  articles: ArticleLike[],
  nowMs: number,
  topClusterCount: number
): number[] {
  const scored = clusters
    .map((cluster) => ({
      cluster,
      score: scoreClusterViral(cluster, articles, nowMs),
    }))
    .filter((c) => c.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.cluster.length - a.cluster.length ||
        maxPubDateMs(b.cluster, articles) - maxPubDateMs(a.cluster, articles)
    );

  const top = scored.slice(0, topClusterCount);
  const out: number[] = [];
  for (const { cluster } of top) {
    const sorted = [...cluster].sort(
      (i, j) =>
        new Date(articles[j].pubDate).getTime() - new Date(articles[i].pubDate).getTime()
    );
    const seenSources = new Set<string>();
    for (const idx of sorted) {
      const src = normalizeSourceKey(articles[idx].link);
      if (seenSources.has(src)) continue;
      seenSources.add(src);
      out.push(idx);
    }
  }
  return out;
}

/**
 * Legacy: cluster_size * source_diversity * recency_boost (exponential).
 * Kept for tests / comparison; main pipeline uses scoreClusterViral.
 */
export function scoreCluster(
  memberIndices: number[],
  articles: ArticleLike[],
  nowMs: number,
  recencyHalfLifeHours: number
): number {
  const clusterSize = memberIndices.length;
  if (clusterSize === 0) return 0;
  const sources = new Set<string>();
  let maxPub = 0;
  for (const idx of memberIndices) {
    const a = articles[idx];
    sources.add(a.source);
    maxPub = Math.max(maxPub, new Date(a.pubDate).getTime());
  }
  const hoursSinceNewest = (nowMs - maxPub) / (1000 * 60 * 60);
  const recency = recencyBoostFromNewestHours(hoursSinceNewest, recencyHalfLifeHours);
  const sourceDiversity = sources.size / clusterSize;
  return clusterSize * sourceDiversity * recency;
}

/** Pick up to `max` articles: sort by pubDate desc, then round-robin by source for diversity. */
export function pickRepresentatives(
  memberIndices: number[],
  articles: ArticleLike[],
  max: number
): number[] {
  const sorted = [...memberIndices].sort(
    (i, j) =>
      new Date(articles[j].pubDate).getTime() -
      new Date(articles[i].pubDate).getTime()
  );
  const bySource = new Map<string, number[]>();
  for (const idx of sorted) {
    const s = articles[idx].source;
    if (!bySource.has(s)) bySource.set(s, []);
    bySource.get(s)!.push(idx);
  }
  const sources = [...bySource.keys()].sort(
    (a, b) => (bySource.get(b)!.length) - (bySource.get(a)!.length)
  );
  const picked: number[] = [];
  let round = 0;
  while (picked.length < max && picked.length < sorted.length) {
    let added = false;
    for (const src of sources) {
      const list = bySource.get(src)!;
      if (round < list.length && picked.length < max) {
        const idx = list[round];
        if (!picked.includes(idx)) {
          picked.push(idx);
          added = true;
        }
      }
    }
    if (!added) break;
    round++;
  }
  if (picked.length < max) {
    for (const idx of sorted) {
      if (picked.length >= max) break;
      if (!picked.includes(idx)) picked.push(idx);
    }
  }
  return picked.slice(0, max);
}

/** Fallback: score each article individually (no clusters). */
export function topArticlesByHeuristic(
  articles: ArticleLike[],
  nowMs: number,
  recencyHalfLifeHours: number,
  limit: number
): number[] {
  const scored = articles.map((a, i) => {
    const h = hoursSince(a.pubDate, nowMs);
    const recency = recencyBoostFromNewestHours(h, recencyHalfLifeHours);
    const diversity = 1;
    return { i, s: recency * diversity };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.i);
}

export function maxPubDateMs(memberIndices: number[], articles: ArticleLike[]): number {
  let m = 0;
  for (const idx of memberIndices) {
    m = Math.max(m, new Date(articles[idx].pubDate).getTime());
  }
  return m;
}

/**
 * Pick highest-scoring cluster; prefers components with size >= minClusterSize.
 * If every component is a singleton, returns allSingletons so caller can use topArticlesByHeuristic.
 */
export function selectBestCluster(
  clusters: number[][],
  articles: ArticleLike[],
  nowMs: number,
  recencyHalfLifeHours: number,
  minClusterSize: number
): { best: number[]; allSingletons: boolean } {
  if (clusters.length === 0) {
    return { best: [], allSingletons: true };
  }
  const allSingletons = clusters.every((c) => c.length === 1);
  if (allSingletons) {
    return { best: [], allSingletons: true };
  }

  const viable = clusters.filter((c) => c.length >= minClusterSize);
  const toScore = viable.length > 0 ? viable : clusters;

  let best: number[] | null = null;
  let bestScore = -Infinity;
  let bestSize = -1;
  let bestMaxPub = -1;

  for (const c of toScore) {
    const sc = scoreCluster(c, articles, nowMs, recencyHalfLifeHours);
    const sz = c.length;
    const mp = maxPubDateMs(c, articles);
    if (
      sc > bestScore ||
      (sc === bestScore && sz > bestSize) ||
      (sc === bestScore && sz === bestSize && mp > bestMaxPub)
    ) {
      bestScore = sc;
      bestSize = sz;
      bestMaxPub = mp;
      best = c;
    }
  }

  return { best: best ?? [], allSingletons: false };
}

/** How many reps to send to the final LLM (3–5, or fewer if the cluster is tiny). */
export function representativeCount(clusterSize: number): number {
  if (clusterSize <= 0) return 0;
  if (clusterSize <= 2) return clusterSize;
  return Math.min(5, clusterSize);
}

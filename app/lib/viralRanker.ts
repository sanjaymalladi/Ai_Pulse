/**
 * Heuristic viral RSS scoring (freshness, source, novelty, impact, title signals, etc.).
 * Ported from the standalone AI Viral RSS Ranker HTML tool.
 */

export type ViralRankArticle = {
  title: string;
  link: string;
  description?: string;
  pubDate: string;
};

export type ViralScoreBreakdown = {
  freshness: number;
  source: number;
  novelty: number;
  impact: number;
  title: number;
  emotional: number;
  specificity: number;
  breadth: number;
  jargon: number;
  duplicate: number;
};

export type ViralRankedItem<T extends ViralRankArticle = ViralRankArticle> = {
  article: T;
  score: number;
  breakdown: ViralScoreBreakdown;
};

export type ViralHistoryEntry = {
  title: string;
};

const STOPWORDS = [
  "the", "a", "an", "and", "or", "to", "of",
  "in", "on", "for", "with", "is", "are",
  "this", "that", "by", "as", "from", "at",
];

const BIG_ENTITIES = [
  "openai", "google", "meta", "anthropic", "microsoft", "nvidia",
  "deepmind", "apple", "amazon", "gemini", "gpt", "claude", "llama", "deepseek",
];

const VIRAL_WORDS = [
  "launches", "released", "beats", "surpasses", "massive", "shocking",
  "breakthrough", "free", "open source", "dangerous", "leak", "record",
  "new model", "agi", "faster", "cheaper", "first",
];

const JARGON_WORDS = [
  "framework", "optimization", "architecture", "latent", "parameterization",
  "multimodal", "transformer", "bayesian", "diffusion", "inference",
  "fine-tuning", "regularization",
];

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fingerprint(title: string): string {
  return normalizeText(title)
    .split(" ")
    .filter((word) => word.length > 2 && !STOPWORDS.includes(word))
    .sort()
    .join(" ");
}

function tokenOverlap(a: string, b: string): number {
  const setA = new Set(a.split(" "));
  const setB = new Set(b.split(" "));
  let common = 0;
  setA.forEach((word) => {
    if (setB.has(word)) common++;
  });
  return common / Math.max(setA.size, 1);
}

export function freshnessScore(pubDate: string, nowMs: number): number {
  if (!pubDate) return 0.3;
  const published = new Date(pubDate).getTime();
  if (Number.isNaN(published)) return 0.3;
  const hours = (nowMs - published) / (1000 * 60 * 60);
  if (hours < 2) return 1;
  if (hours < 6) return 0.9;
  if (hours < 12) return 0.8;
  if (hours < 24) return 0.7;
  if (hours < 48) return 0.5;
  return 0.3;
}

function countMatches(text: string, list: readonly string[]): number {
  let count = 0;
  for (const word of list) {
    if (text.includes(word)) count++;
  }
  return count;
}

function titleStrength(title: string): number {
  let score = 0;
  const words = title.split(" ").length;
  if (words >= 6 && words <= 14) score += 0.35;
  if (/[0-9]/.test(title)) score += 0.2;
  if (title.includes(":")) score += 0.1;
  if (title.includes("?")) score += 0.1;
  if (/[A-Z]{2,}/.test(title)) score += 0.1;
  return Math.min(score, 1);
}

function specificityScore(title: string): number {
  let score = 0;
  if (/[0-9]/.test(title)) score += 0.4;
  if (title.match(/\b\d+%/)) score += 0.4;
  if (title.match(/\b\d+x\b/i)) score += 0.3;
  return Math.min(score, 1);
}

function breadthScore(text: string): number {
  const nicheWords = countMatches(text, JARGON_WORDS);
  return Math.max(0, 1 - nicheWords * 0.15);
}

export function noveltyScore(title: string, history: ViralHistoryEntry[]): number {
  const current = fingerprint(title);
  let similarity = 0;
  for (const item of history) {
    const old = fingerprint(item.title);
    similarity = Math.max(similarity, tokenOverlap(current, old));
  }
  return 1 - similarity;
}

function duplicatePenalty(title: string, all: ViralRankArticle[]): number {
  const current = fingerprint(title);
  let duplicates = 0;
  for (const item of all) {
    const fp = fingerprint(item.title);
    const overlap = tokenOverlap(current, fp);
    if (overlap > 0.75) duplicates++;
  }
  return Math.min(duplicates * 0.1, 1);
}

export function sourceWeight(link: string): number {
  if (!link || link === "#") return 0.6;
  let domain = "";
  try {
    domain = new URL(link).hostname.toLowerCase();
  } catch {
    return 0.6;
  }
  if (domain.includes("openai")) return 1;
  if (domain.includes("google")) return 1;
  if (domain.includes("deepmind")) return 1;
  if (domain.includes("techcrunch")) return 0.9;
  if (domain.includes("venturebeat")) return 0.85;
  if (domain.includes("wired")) return 0.85;
  if (domain.includes("theverge")) return 0.85;
  if (domain.includes("arxiv")) return 0.75;
  if (domain.includes("reddit")) return 0.7;
  return 0.6;
}

export function computeViralScore(
  item: ViralRankArticle,
  all: ViralRankArticle[],
  history: ViralHistoryEntry[],
  nowMs: number
): { score: number; breakdown: ViralScoreBreakdown } {
  const title = normalizeText(item.title);
  const desc = normalizeText(item.description ?? "");
  const text = `${title} ${desc}`;

  const freshness = freshnessScore(item.pubDate, nowMs);
  const source = sourceWeight(item.link);
  const novelty = noveltyScore(item.title, history);
  const impact = Math.min(countMatches(text, BIG_ENTITIES) * 0.2, 1);
  const emotional = Math.min(countMatches(text, VIRAL_WORDS) * 0.15, 1);
  const jargon = Math.min(countMatches(text, JARGON_WORDS) * 0.1, 1);
  const titleScore = titleStrength(item.title);
  const specificity = specificityScore(item.title);
  const breadth = breadthScore(text);
  const duplicate = duplicatePenalty(item.title, all);

  const final =
    0.25 * freshness +
    0.18 * source +
    0.15 * novelty +
    0.12 * impact +
    0.12 * titleScore +
    0.1 * emotional +
    0.08 * specificity +
    0.05 * breadth -
    (0.1 * jargon + 0.08 * duplicate);

  return {
    score: Math.max(0, final * 100),
    breakdown: {
      freshness,
      source,
      novelty,
      impact,
      title: titleScore,
      emotional,
      specificity,
      breadth,
      jargon,
      duplicate,
    },
  };
}

/** Dedupe by title fingerprint, then score and sort descending. */
export function rankArticlesByViralScore<T extends ViralRankArticle>(
  articles: T[],
  options?: { nowMs?: number; history?: ViralHistoryEntry[] }
): ViralRankedItem<T>[] {
  const nowMs = options?.nowMs ?? Date.now();
  const history = options?.history ?? [];

  const seen = new Set<string>();
  const unique: T[] = [];
  for (const article of articles) {
    const fp = fingerprint(article.title);
    if (seen.has(fp)) continue;
    seen.add(fp);
    unique.push(article);
  }

  const ranked = unique.map((article) => {
    const { score, breakdown } = computeViralScore(article, unique, history, nowMs);
    return { article, score, breakdown };
  });

  ranked.sort((a, b) => b.score - a.score || b.article.pubDate.localeCompare(a.article.pubDate));
  return ranked;
}

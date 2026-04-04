import type { SegmentedScene, TimingWord } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWord(word: string) {
  return word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "");
}

function extractKeywords(text: string) {
  const stopWords = new Set(["the", "and", "for", "with", "that", "this", "from", "have", "your", "they", "will", "into", "just", "about", "what", "when", "where", "their", "there", "which"]);
  const freq = new Map<string, number>();
  for (const raw of text.split(/\s+/)) {
    const word = normalizeWord(raw).toLowerCase();
    if (word.length < 4 || stopWords.has(word)) continue;
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([word]) => word);
}

function chooseVisualIntent(text: string, keywords: string[], sceneIndex: number) {
  const lower = text.toLowerCase();
  if (/\b(price|percent|benchmark|faster|slower|cost|revenue|million|billion)\b/.test(lower)) return "metrics and comparison";
  if (/\b(said|claims|quote|warning|ethical|argues|asks)\b/.test(lower)) return "quote and argument emphasis";
  if (/\b(how|works|pipeline|steps|flow|system|process)\b/.test(lower)) return "diagrammatic explanation";
  if (/\b(openai|google|meta|microsoft|anthropic|xai|tesla|nvidia)\b/.test(lower)) return "brand-led announcement";
  if (keywords.length > 0 && sceneIndex === 0) return `hook around ${keywords[0]}`;
  return "high-energy editorial motion";
}

export function segmentScript(script: string, timings: TimingWord[]): SegmentedScene[] {
  const usableTimings = timings.filter((t) => t.text.trim().length > 0);
  if (usableTimings.length === 0) {
    const text = script.trim() || "No script available.";
    const keywords = extractKeywords(text);
    return [{ sceneId: "scene-1", startSec: 0, endSec: 6, voiceText: text, keywords, importance: 1, visualIntent: chooseVisualIntent(text, keywords, 0) }];
  }

  const totalDuration = usableTimings[usableTimings.length - 1].end;
  const targetScenes = clamp(Math.round(totalDuration / 6), 6, 12);
  const wordsPerScene = Math.max(8, Math.ceil(usableTimings.length / targetScenes));
  const segments: SegmentedScene[] = [];

  for (let i = 0; i < usableTimings.length; i += wordsPerScene) {
    const chunk = usableTimings.slice(i, i + wordsPerScene);
    if (chunk.length === 0) continue;
    const voiceText = chunk.map((word) => word.text).join(" ").trim();
    const keywords = extractKeywords(voiceText);
    const index = segments.length;
    segments.push({
      sceneId: `scene-${index + 1}`,
      startSec: chunk[0].start,
      endSec: chunk[chunk.length - 1].end,
      voiceText,
      keywords,
      importance: clamp(1 - index * 0.06, 0.45, 1),
      visualIntent: chooseVisualIntent(voiceText, keywords, index),
    });
  }

  return segments.slice(0, 12);
}

/** Client-side novelty memory for viral ranker (mirrors HTML localStorage history). */

import type { ViralHistoryEntry } from "./viralRanker";

const STORAGE_KEY = "viral_history";
const MAX_ENTRIES = 3000;

export function getViralHistory(): ViralHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ViralHistoryEntry =>
        !!item && typeof item === "object" && typeof (item as ViralHistoryEntry).title === "string"
      )
      .map((item) => ({ title: item.title }));
  } catch {
    return [];
  }
}

export function saveViralHistory(entries: ViralHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    const merged = [...getViralHistory(), ...entries];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged.slice(-MAX_ENTRIES)));
  } catch {
    // ignore quota / private mode
  }
}

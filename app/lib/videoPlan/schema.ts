import {
  ASSET_KINDS,
  ASSET_SOURCES,
  FALLBACK_MODES,
  MOTION_BITS,
  MOTION_LEVELS,
  SCENE_TEMPLATES,
  type SceneAssetRequest,
  type ScenePlan,
  type VideoPlan,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isSceneAssetRequest(value: unknown): value is SceneAssetRequest {
  if (!isRecord(value)) return false;
  return (
    typeof value.query === "string" &&
    ASSET_KINDS.includes(value.kind as (typeof ASSET_KINDS)[number]) &&
    typeof value.required === "boolean" &&
    ["hero", "supporting", "brand"].includes(String(value.role))
  );
}

export function isScenePlan(value: unknown): value is ScenePlan {
  if (!isRecord(value)) return false;
  return (
    typeof value.sceneId === "string" &&
    typeof value.startSec === "number" &&
    typeof value.endSec === "number" &&
    typeof value.voiceText === "string" &&
    SCENE_TEMPLATES.includes(value.template as (typeof SCENE_TEMPLATES)[number]) &&
    typeof value.visualIntent === "string" &&
    Array.isArray(value.keywords) &&
    value.keywords.every((k) => typeof k === "string") &&
    MOTION_LEVELS.includes(value.motionLevel as (typeof MOTION_LEVELS)[number]) &&
    (value.motionBit === undefined || MOTION_BITS.includes(value.motionBit as (typeof MOTION_BITS)[number])) &&
    (value.motionBitId === undefined || typeof value.motionBitId === "string") &&
    Array.isArray(value.assets) &&
    value.assets.every(isSceneAssetRequest) &&
    (value.requiredUserAssets === undefined ||
      (Array.isArray(value.requiredUserAssets) && value.requiredUserAssets.every(isSceneAssetRequest))) &&
    Array.isArray(value.resolvedAssets) &&
    value.resolvedAssets.every((asset) => {
      if (!isRecord(asset)) return false;
      return (
        ASSET_KINDS.includes(asset.kind as (typeof ASSET_KINDS)[number]) &&
        ASSET_SOURCES.includes(asset.source as (typeof ASSET_SOURCES)[number]) &&
        typeof asset.verified === "boolean" &&
        typeof asset.confidence === "number" &&
        typeof asset.reason === "string"
      );
    }) &&
    FALLBACK_MODES.includes(value.fallbackMode as (typeof FALLBACK_MODES)[number])
  );
}

export function isVideoPlan(value: unknown): value is VideoPlan {
  if (!isRecord(value) || value.version !== 1) return false;
  if (!isRecord(value.meta) || !isRecord(value.globalAssets)) return false;
  return (
    typeof value.meta.durationSec === "number" &&
    value.meta.stylePack === "tech-news-bold" &&
    value.meta.aspectRatio === "9:16" &&
    Array.isArray(value.scenes) &&
    value.scenes.every(isScenePlan) &&
    Array.isArray(value.globalAssets.palette) &&
    value.globalAssets.palette.every((c) => typeof c === "string") &&
    value.globalAssets.textureMode === "soft-noise"
  );
}

export function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

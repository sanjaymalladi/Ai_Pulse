import { DEFAULT_TEMPLATE_SEQUENCE } from "./templateCatalog";
import { isVideoPlan } from "./schema";
import type { SceneAssetRequest, ScenePlan, SegmentedScene, VideoPlan } from "./types";

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function clipText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string" || value.trim().length === 0) return fallback;
  return value.trim().slice(0, maxLength);
}

function inferAssets(segment: SegmentedScene, template: ScenePlan["template"]): SceneAssetRequest[] {
  const text = `${segment.voiceText} ${segment.keywords.join(" ")}`.toLowerCase();
  const assets: SceneAssetRequest[] = [];
  if (template === "hero_logo_statement" || /\b(openai|google|meta|microsoft|anthropic|nvidia|tesla)\b/.test(text)) {
    assets.push({ kind: "logo", query: segment.keywords[0] || segment.voiceText.split(/\s+/).slice(0, 2).join(" "), required: false, role: "brand" });
  }
  if ((template === "image_card_focus" || /\b(model|chip|robot|factory|phone|device|datacenter|server|car|founder|ceo|product)\b/.test(text)) && segment.keywords.length > 0) {
    assets.push({ kind: "image", query: segment.keywords.slice(0, 3).join(" "), required: false, role: "hero" });
  }
  return assets.slice(0, 1);
}

export function buildFallbackPlan(segments: SegmentedScene[], title?: string): VideoPlan {
  const durationSec = Math.max(6, segments[segments.length - 1]?.endSec || 30);
  return {
    version: 1,
    meta: { title, durationSec, stylePack: "tech-news-bold", aspectRatio: "9:16" },
    globalAssets: { palette: ["#050816", "#a7ff5a", "#7dd3fc", "#ff8fab", "#f59e0b"], textureMode: "soft-noise" },
    scenes: segments.map((segment, index) => {
      const template = DEFAULT_TEMPLATE_SEQUENCE[index % DEFAULT_TEMPLATE_SEQUENCE.length];
      return {
        sceneId: segment.sceneId,
        startSec: segment.startSec,
        endSec: Math.max(segment.startSec + 1, segment.endSec),
        voiceText: segment.voiceText,
        template,
        visualIntent: segment.visualIntent,
        headline: clipText(segment.voiceText.split(/\s+/).slice(0, 7).join(" "), segment.voiceText, 40),
        subhead: clipText(segment.keywords.join(" | "), "", 56),
        keywords: segment.keywords,
        motionLevel: index % 3 === 0 ? "high" : "medium",
        motionBit: template === "stat_compare" ? "animated-counter" : index % 2 === 0 ? "animated-text" : "gradient-transition",
        motionBitId: undefined,
        assets: inferAssets(segment, template),
        resolvedAssets: [],
        requiredUserAssets: [],
        fallbackMode: "retry_then_internal",
      } satisfies ScenePlan;
    }),
  };
}

export function normalizePlan(rawPlan: unknown, segments: SegmentedScene[], script: string): VideoPlan {
  if (isVideoPlan(rawPlan)) {
    return {
      ...rawPlan,
      scenes: rawPlan.scenes.map((scene, index) => ({
        ...scene,
        sceneId: scene.sceneId || `scene-${index + 1}`,
        startSec: Number.isFinite(scene.startSec) ? scene.startSec : segments[index]?.startSec || index * 5,
        endSec: Number.isFinite(scene.endSec) ? Math.max(scene.startSec + 0.8, scene.endSec) : segments[index]?.endSec || (index + 1) * 5,
        voiceText: scene.voiceText || segments[index]?.voiceText || "",
        visualIntent: scene.visualIntent || segments[index]?.visualIntent || "editorial animation",
        headline: scene.headline?.slice(0, 40),
        subhead: scene.subhead?.slice(0, 70),
        keywords: scene.keywords.slice(0, 6),
        motionBit:
          scene.motionBit === "animated-text" || scene.motionBit === "gradient-transition" || scene.motionBit === "animated-counter"
            ? scene.motionBit
            : undefined,
        motionBitId: typeof scene.motionBitId === "string" ? scene.motionBitId : undefined,
        assets: scene.assets.slice(0, 2),
        resolvedAssets: [],
        requiredUserAssets: [],
      })),
    };
  }

  const record = rawPlan && typeof rawPlan === "object" ? (rawPlan as Record<string, unknown>) : null;
  const scenesRaw = toArray<Record<string, unknown>>(record?.scenes);
  if (scenesRaw.length === 0) return buildFallbackPlan(segments, script.split(".")[0]?.slice(0, 80));

  const base = buildFallbackPlan(segments, script.split(".")[0]?.slice(0, 80));
  base.scenes = base.scenes.map((fallbackScene, index) => {
    const rawScene = scenesRaw[index] || {};
    return {
      ...fallbackScene,
      template:
        typeof rawScene.template === "string" && DEFAULT_TEMPLATE_SEQUENCE.includes(rawScene.template as ScenePlan["template"])
          ? (rawScene.template as ScenePlan["template"])
          : fallbackScene.template,
      visualIntent: clipText(rawScene.visualIntent, fallbackScene.visualIntent, 80),
      headline: clipText(rawScene.headline, fallbackScene.headline || "", 40),
      subhead: clipText(rawScene.subhead, fallbackScene.subhead || "", 70),
      motionLevel: rawScene.motionLevel === "low" || rawScene.motionLevel === "medium" || rawScene.motionLevel === "high" ? rawScene.motionLevel : fallbackScene.motionLevel,
      motionBit:
        rawScene.motionBit === "animated-text" || rawScene.motionBit === "gradient-transition" || rawScene.motionBit === "animated-counter"
          ? rawScene.motionBit
          : fallbackScene.motionBit,
      motionBitId: typeof rawScene.motionBitId === "string" ? rawScene.motionBitId : fallbackScene.motionBitId,
      fallbackMode:
        rawScene.fallbackMode === "internal_only" || rawScene.fallbackMode === "retry_then_internal" || rawScene.fallbackMode === "user_upload_optional"
          ? rawScene.fallbackMode
          : fallbackScene.fallbackMode,
      keywords: toArray<string>(rawScene.keywords).filter((k) => typeof k === "string").slice(0, 6),
      assets: toArray<SceneAssetRequest>(rawScene.assets).filter((asset) => asset && typeof asset.query === "string").slice(0, 2),
      requiredUserAssets: [],
    };
  });

  return base;
}

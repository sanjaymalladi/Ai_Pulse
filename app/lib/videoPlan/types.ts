export const VIDEO_PLAN_VERSION = 1 as const;

export const SCENE_TEMPLATES = [
  "hero_logo_statement",
  "kinetic_typography",
  "image_card_focus",
  "stat_compare",
  "quote_reveal",
  "diagram_flow",
  "ambient_transition_bridge",
] as const;

export const ASSET_KINDS = ["logo", "image", "video", "icon"] as const;
export const FALLBACK_MODES = ["internal_only", "retry_then_internal", "user_upload_optional"] as const;
export const MOTION_LEVELS = ["low", "medium", "high"] as const;
export const ASSET_SOURCES = ["logo_dev", "pixabay", "internal"] as const;
export const MOTION_BITS = ["animated-text", "gradient-transition", "animated-counter"] as const;

export type SceneTemplate = (typeof SCENE_TEMPLATES)[number];
export type AssetKind = (typeof ASSET_KINDS)[number];
export type FallbackMode = (typeof FALLBACK_MODES)[number];
export type MotionLevel = (typeof MOTION_LEVELS)[number];
export type AssetSource = (typeof ASSET_SOURCES)[number];
export type MotionBitHint = (typeof MOTION_BITS)[number];

export type TimingWord = {
  text: string;
  start: number;
  end: number;
};

export type SceneAssetRequest = {
  kind: AssetKind;
  query: string;
  required: boolean;
  role: "hero" | "supporting" | "brand";
};

export type ResolvedAsset = {
  kind: AssetKind;
  source: AssetSource;
  url?: string;
  localPath?: string;
  previewUrl?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  providerId?: string;
  verified: boolean;
  confidence: number;
  reason: string;
};

export type ScenePlan = {
  sceneId: string;
  startSec: number;
  endSec: number;
  voiceText: string;
  template: SceneTemplate;
  visualIntent: string;
  headline?: string;
  subhead?: string;
  keywords: string[];
  motionLevel: MotionLevel;
  motionBit?: MotionBitHint;
  motionBitId?: string;
  assets: SceneAssetRequest[];
  resolvedAssets: ResolvedAsset[];
  requiredUserAssets?: SceneAssetRequest[];
  fallbackMode: FallbackMode;
};

export type GlobalAssets = {
  palette: string[];
  textureMode: "soft-noise";
};

export type VideoPlan = {
  version: 1;
  meta: {
    title?: string;
    durationSec: number;
    stylePack: "tech-news-bold";
    aspectRatio: "9:16";
  };
  scenes: ScenePlan[];
  globalAssets: GlobalAssets;
};

export type SegmentedScene = {
  sceneId: string;
  startSec: number;
  endSec: number;
  voiceText: string;
  keywords: string[];
  importance: number;
  visualIntent: string;
};

export type PlannerInput = {
  script: string;
  timings: TimingWord[];
  segments: SegmentedScene[];
};

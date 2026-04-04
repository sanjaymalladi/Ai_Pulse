import type { SceneAssetRequest, TimingWord, VideoPlan } from "./types";

export type AssetBriefItem = SceneAssetRequest & {
  sceneId: string;
  sceneWindow: string;
  visualIntent: string;
};

function dedupeAssetBrief(items: AssetBriefItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}|${item.query}|${item.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildAssetBrief(videoPlan: VideoPlan): AssetBriefItem[] {
  const items = videoPlan.scenes.flatMap((scene) =>
    scene.assets.map((asset) => ({
      ...asset,
      sceneId: scene.sceneId,
      sceneWindow: `${scene.startSec.toFixed(1)}s - ${scene.endSec.toFixed(1)}s`,
      visualIntent: scene.visualIntent,
    })),
  );

  return dedupeAssetBrief(items);
}

export function buildDirectorPrompt({
  script,
  timings,
  videoPlan,
}: {
  script: string;
  timings: TimingWord[];
  videoPlan: VideoPlan;
}) {
  const assetBrief = buildAssetBrief(videoPlan);
  const timingWindow = timings.length
    ? `${timings[0]?.start.toFixed(2)}s to ${timings[timings.length - 1]?.end.toFixed(2)}s`
    : `0.00s to ${videoPlan.meta.durationSec.toFixed(2)}s`;

  return `You are directing a single full-length silent 9:16 video for a spoken AI news script.

Goal:
- Create one complete silent video matching the provided narration timing.
- The final spoken audio will be added later in post.
- Prefer animation, diagrams, product/logo motion, camera moves, comparisons, and figures.
- Keep on-screen text minimal.

Hard constraints:
- Output target: Remotion React/TSX composition for a full ${videoPlan.meta.durationSec.toFixed(1)} second vertical video.
- Aspect ratio: 9:16
- Keep the first scene top-weighted and leave the lower half visually quiet for an avatar overlay.
- Use dark, premium visuals.
- Low text density: max 0 to 5 words on screen at a time unless a metric or label is essential.
- Do not rely on placeholders. Use the provided assets or strong abstract motion.
- Use remotion-bits style motion patterns where useful: animated text, counters, staggered motion, particles, gradients, scrolling columns, scene-3d.

Script timing window:
- ${timingWindow}

Full script:
${script}

Scene plan:
${videoPlan.scenes
  .map(
    (scene, index) => `${index + 1}. ${scene.sceneId}
- Time: ${scene.startSec.toFixed(1)}s - ${scene.endSec.toFixed(1)}s
- Template intent: ${scene.template}
- Visual intent: ${scene.visualIntent}
- Headline: ${scene.headline || "none"}
- Subhead: ${scene.subhead || "none"}
- Keywords: ${scene.keywords.join(", ") || "none"}
- Motion level: ${scene.motionLevel}
- Motion bit hint: ${scene.motionBitId || scene.motionBit || "auto"}`
  )
  .join("\n\n")}

Required asset brief:
${assetBrief.length > 0
  ? assetBrief
      .map(
        (asset, index) => `${index + 1}. ${asset.kind.toUpperCase()} for ${asset.sceneId}
- Query: ${asset.query}
- Role: ${asset.role}
- Required: ${asset.required ? "yes" : "optional"}
- Scene window: ${asset.sceneWindow}
- Why: ${asset.visualIntent}`,
      )
      .join("\n\n")
  : "- No external assets strictly required. Use diagrams, motion graphics, gradients, counters, and abstract systems visuals."}

What to produce:
- A single coherent Remotion composition for the full video
- Scene-by-scene visual transitions aligned to the scene windows above
- Minimal text overlays
- Motion-heavy visuals that support the spoken narration instead of repeating it
- Strong diagrams, flows, brand/logo usage, UI cards, metric callouts, and editorial motion

Important:
- This video should be silent because final voiceover will be muxed later.
- Avoid generic stock-video pacing.
- Favor premium, dense motion graphics over static cards.
- Keep the first scene avatar-safe in the lower half.
`;
}
